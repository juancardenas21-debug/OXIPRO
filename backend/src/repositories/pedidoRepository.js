const pool = require('../db');

async function crear({ idCliente, direccionEntrega, metodoPago, lineas }) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [pedido] = await conexion.query(
      "INSERT INTO pedido (id_cliente, fecha, estado, direccion_entrega, total) VALUES (?, NOW(), 'PENDIENTE', ?, 0)",
      [idCliente, direccionEntrega]
    );
    const idPedido = pedido.insertId;
    for (const l of lineas) {
      const [descuento] = await conexion.query(
        "UPDATE producto SET stock = stock - ? WHERE id_producto = ? AND estado = 'ACTIVO' AND stock >= ?",
        [l.cantidad, l.idProducto, l.cantidad]
      );
      if (descuento.affectedRows === 0) {
        const error = new Error('SIN_STOCK');
        error.idProducto = l.idProducto;
        throw error;
      }
      await conexion.query(
        `INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal)
         SELECT ?, id_producto, ?, precio, precio * ? FROM producto WHERE id_producto = ?`,
        [idPedido, l.cantidad, l.cantidad, l.idProducto]
      );
    }
    await conexion.query(
      'UPDATE pedido SET total = (SELECT SUM(subtotal) FROM detalle_pedido WHERE id_pedido = ?) WHERE id_pedido = ?',
      [idPedido, idPedido]
    );
    await conexion.query(
      "INSERT INTO pago (id_pedido, monto, metodo, estado) SELECT id_pedido, total, ?, 'PENDIENTE' FROM pedido WHERE id_pedido = ?",
      [metodoPago, idPedido]
    );
    await conexion.commit();
    return idPedido;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function obtener(id) {
  const [filas] = await pool.query(
    'SELECT id_pedido AS idPedido, id_cliente AS idCliente, fecha, estado, direccion_entrega AS direccionEntrega, total FROM pedido WHERE id_pedido = ?',
    [id]
  );
  return filas[0];
}

async function lineasDe(id) {
  const [filas] = await pool.query(
    `SELECT d.id_producto AS idProducto, p.nombre, d.cantidad, d.precio_unitario AS precioUnitario, d.subtotal
     FROM detalle_pedido d JOIN producto p ON p.id_producto = d.id_producto WHERE d.id_pedido = ?`,
    [id]
  );
  return filas;
}

async function pagoDe(id) {
  const [filas] = await pool.query(
    'SELECT metodo, estado, monto, fecha_pago AS fechaPago, referencia FROM pago WHERE id_pedido = ?',
    [id]
  );
  return filas[0] || null;
}

async function listar({ idCliente, fechaInicio, fechaFin }) {
  const condiciones = [];
  const valores = [];
  if (idCliente) { condiciones.push('id_cliente = ?'); valores.push(idCliente); }
  if (fechaInicio) { condiciones.push('fecha >= ?'); valores.push(fechaInicio); }
  if (fechaFin) { condiciones.push('fecha < DATE_ADD(?, INTERVAL 1 DAY)'); valores.push(fechaFin); }
  const donde = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  const [filas] = await pool.query(
    `SELECT id_pedido AS idPedido, id_cliente AS idCliente, fecha, estado, total FROM pedido ${donde} ORDER BY fecha DESC`,
    valores
  );
  return filas;
}

async function cancelar(id, { esAdmin, idUsuario }) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [filas] = await conexion.query(
      'SELECT id_cliente, estado FROM pedido WHERE id_pedido = ? FOR UPDATE', [id]
    );
    const pedido = filas[0];
    if (!pedido) throw new Error('NO_EXISTE');
    if (!esAdmin && pedido.id_cliente !== idUsuario) throw new Error('SIN_PERMISO');
    const permitidos = esAdmin ? ['PENDIENTE', 'PAGADO', 'EN_PREPARACION'] : ['PENDIENTE'];
    if (!permitidos.includes(pedido.estado)) {
      const error = new Error('ESTADO_NO_PERMITE');
      error.estado = pedido.estado;
      throw error;
    }
    const [lineas] = await conexion.query(
      'SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = ? ORDER BY id_producto', [id]
    );
    for (const l of lineas) {
      await conexion.query('UPDATE producto SET stock = stock + ? WHERE id_producto = ?', [l.cantidad, l.id_producto]);
    }
    await conexion.query("UPDATE pedido SET estado = 'CANCELADO' WHERE id_pedido = ?", [id]);
    await conexion.commit();
    return { estadoAnterior: pedido.estado };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function cambiarEstado(id, nuevo, anterior) {
  const [r] = await pool.query(
    'UPDATE pedido SET estado = ? WHERE id_pedido = ? AND estado = ?', [nuevo, id, anterior]
  );
  return r.affectedRows === 1;
}

async function registrarPagoManual(id, d) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [filas] = await conexion.query(
      'SELECT estado, total = CAST(? AS DECIMAL(12,2)) AS coincide FROM pedido WHERE id_pedido = ? FOR UPDATE',
      [d.monto, id]
    );
    const pedido = filas[0];
    if (!pedido) throw new Error('NO_EXISTE');
    if (pedido.estado !== 'PENDIENTE') throw new Error('ESTADO_NO_PERMITE');
    if (!pedido.coincide) throw new Error('MONTO_DISTINTO');
    await conexion.query(
      "UPDATE pago SET metodo = ?, estado = 'APROBADO', fecha_pago = NOW(), referencia = ?, registrado_por = ? WHERE id_pedido = ?",
      [d.metodo, d.referencia, d.idAdmin, id]
    );
    await conexion.query("UPDATE pedido SET estado = 'PAGADO' WHERE id_pedido = ?", [id]);
    await conexion.query(
      `INSERT INTO factura (id_pedido, fecha_emision, impuestos, total_a_pagar)
       SELECT id_pedido, NOW(), ROUND(total - total / 1.19, 2), total FROM pedido WHERE id_pedido = ?`,
      [id]
    );
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function facturaDe(id) {
  const [filas] = await pool.query(
    'SELECT id_factura AS idFactura, fecha_emision AS fechaEmision, impuestos, total_a_pagar AS totalAPagar FROM factura WHERE id_pedido = ?',
    [id]
  );
  return filas[0] || null;
}

module.exports = { crear, obtener, lineasDe, pagoDe, listar, cancelar, cambiarEstado, registrarPagoManual, facturaDe };