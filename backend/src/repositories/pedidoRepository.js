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

module.exports = { crear, obtener, lineasDe, pagoDe, listar };