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
    res.json({ ...pedido, lineas: await pedidos.lineasDe(id), pago: await pedidos.pagoDe(id) });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { crear, listar, detalle };