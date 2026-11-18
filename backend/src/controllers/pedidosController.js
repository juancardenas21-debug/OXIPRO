const pedidos = require('../repositories/pedidoRepository');

const METODOS = ['PASARELA', 'TRANSFERENCIA', 'EFECTIVO'];

function agrupar(lineas) {
  const porProducto = new Map();
  for (const l of lineas) {
    porProducto.set(l.idProducto, (porProducto.get(l.idProducto) || 0) + l.cantidad);
  }
  // Orden fijo por producto: evita bloqueos cruzados entre pedidos simultáneos
  return [...porProducto.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idProducto, cantidad]) => ({ idProducto, cantidad }));
}

async function crear(req, res) {
  try {
    const { lineas, direccionEntrega, metodoPago } = req.body;
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
    }
    const lineasValidas = lineas.every(
      (l) => Number.isInteger(l.idProducto) && l.idProducto > 0 && Number.isInteger(l.cantidad) && l.cantidad > 0
    );
    if (!lineasValidas) {
      return res.status(400).json({ error: 'Cada línea necesita idProducto y cantidad enteros mayores a cero' });
    }
    if (!direccionEntrega || typeof direccionEntrega !== 'string') {
      return res.status(400).json({ error: 'La dirección de entrega es obligatoria' });
    }
    if (!METODOS.includes(metodoPago)) {
      return res.status(400).json({ error: 'Método de pago no válido' });
    }
    const idPedido = await pedidos.crear({
      idCliente: req.usuario.id,
      direccionEntrega,
      metodoPago,
      lineas: agrupar(lineas),
    });
    const pedido = await pedidos.obtener(idPedido);
    res.status(201).json({ idPedido, estado: pedido.estado, total: pedido.total });
  } catch (error) {
    if (error.message === 'SIN_STOCK') {
      return res.status(409).json({
        error: 'Producto sin stock suficiente o inactivo',
        idProducto: error.idProducto,
      });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listar(req, res) {
  try {
    const esCliente = req.usuario.rol === 'CLIENTE';
    const filas = await pedidos.listar({
      idCliente: esCliente ? req.usuario.id : req.query.idCliente,
      fechaInicio: req.query.fechaInicio,
      fechaFin: req.query.fechaFin,
    });
    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function detalle(req, res) {
  try {
    const id = Number(req.params.id);
    const pedido = await pedidos.obtener(id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (req.usuario.rol === 'CLIENTE' && pedido.idCliente !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver este pedido' });
    }
    res.json({ ...pedido, lineas: await pedidos.lineasDe(id), pago: await pedidos.pagoDe(id), factura: await pedidos.facturaDe(id) });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

const SIGUIENTE = { EN_PREPARACION: 'PAGADO', ENVIADO: 'EN_PREPARACION', ENTREGADO: 'ENVIADO' };

async function cancelar(req, res) {
  try {
    const motivo = req.body.motivo;
    if (!motivo || typeof motivo !== 'string' || !motivo.trim()) {
      return res.status(400).json({ error: 'El motivo de la cancelación es obligatorio' });
    }
    const r = await pedidos.cancelar(Number(req.params.id), {
      esAdmin: req.usuario.rol === 'ADMIN',
      idUsuario: req.usuario.id,
    });
    res.json({
      mensaje: 'Pedido cancelado y stock repuesto',
      reembolsoPendiente: r.estadoAnterior !== 'PENDIENTE',
    });
  } catch (error) {
    if (error.message === 'NO_EXISTE') return res.status(404).json({ error: 'Pedido no encontrado' });
    if (error.message === 'SIN_PERMISO') return res.status(403).json({ error: 'No tienes permiso para cancelar este pedido' });
    if (error.message === 'ESTADO_NO_PERMITE') {
      return res.status(409).json({ error: 'El pedido no se puede cancelar en su estado actual', estado: error.estado });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function cambiarEstado(req, res) {
  try {
    const id = Number(req.params.id);
    const { nuevoEstado } = req.body;
    if (!Object.keys(SIGUIENTE).includes(nuevoEstado)) {
      return res.status(400).json({ error: 'Estado no válido. Usa EN_PREPARACION, ENVIADO o ENTREGADO' });
    }
    const pedido = await pedidos.obtener(id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    const ok = await pedidos.cambiarEstado(id, nuevoEstado, SIGUIENTE[nuevoEstado]);
    if (!ok) {
      return res.status(409).json({ error: 'Transición no permitida', estadoActual: pedido.estado });
    }
    res.json({ idPedido: id, estado: nuevoEstado });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function registrarPago(req, res) {
  try {
    const id = Number(req.params.id);
    const { metodo, monto, referencia } = req.body;
    if (!['TRANSFERENCIA', 'EFECTIVO'].includes(metodo)) {
      return res.status(400).json({ error: 'El método debe ser TRANSFERENCIA o EFECTIVO' });
    }
    if (!/^\d+(\.\d{1,2})?$/.test(String(monto))) {
      return res.status(400).json({ error: 'Monto no válido' });
    }
    if (!referencia || typeof referencia !== 'string') {
      return res.status(400).json({ error: 'La referencia o el comprobante es obligatorio' });
    }
    await pedidos.registrarPagoManual(id, { metodo, monto: String(monto), referencia, idAdmin: req.usuario.id });
    res.json({ mensaje: 'Pago registrado', estado: 'PAGADO', factura: await pedidos.facturaDe(id) });
  } catch (error) {
    if (error.message === 'NO_EXISTE') return res.status(404).json({ error: 'Pedido no encontrado' });
    if (error.message === 'ESTADO_NO_PERMITE') return res.status(409).json({ error: 'Solo se puede registrar el pago de pedidos PENDIENTE' });
    if (error.message === 'MONTO_DISTINTO') return res.status(400).json({ error: 'El monto no coincide con el total del pedido' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function factura(req, res) {
  try {
    const id = Number(req.params.id);
    const pedido = await pedidos.obtener(id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (req.usuario.rol === 'CLIENTE' && pedido.idCliente !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta factura' });
    }
    const f = await pedidos.facturaDe(id);
    if (!f) return res.status(404).json({ error: 'El pedido aún no tiene factura' });
    res.json(f);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { crear, listar, detalle, cancelar, cambiarEstado, registrarPago, factura };