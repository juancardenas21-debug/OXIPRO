const pool = require('../db');

const COLS = `u.id_usuario AS idCliente, u.nombre, u.apellido, u.tipo_doc AS tipoDoc, u.documento,
  u.telefono, u.correo, c.direccion, u.estado`;

async function listar({ texto, estado }) {
  const condiciones = [];
  const valores = [];
  if (texto) {
    const patron = `%${texto}%`;
    condiciones.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.documento LIKE ? OR u.correo LIKE ?)');
    valores.push(patron, patron, patron, patron);
  }
  if (estado) { condiciones.push('u.estado = ?'); valores.push(estado); }
  const donde = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  const [filas] = await pool.query(
    `SELECT ${COLS} FROM usuario u JOIN cliente c ON c.id_cliente = u.id_usuario ${donde} ORDER BY u.apellido, u.nombre`,
    valores
  );
  return filas;
}

async function obtener(id) {
  const [filas] = await pool.query(
    `SELECT ${COLS} FROM usuario u JOIN cliente c ON c.id_cliente = u.id_usuario WHERE u.id_usuario = ?`,
    [id]
  );
  return filas[0];
}

async function existeDuplicado(documento, correo, excluirId) {
  const [filas] = await pool.query(
    'SELECT id_usuario FROM usuario WHERE (documento = ? OR correo = ?) AND id_usuario <> ?',
    [documento, correo, excluirId]
  );
  return filas.length > 0;
}

async function actualizar(id, d) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query(
      `UPDATE usuario SET nombre = ?, apellido = ?, tipo_doc = ?, documento = ?, telefono = ?, correo = ?
       WHERE id_usuario = ?`,
      [d.nombre, d.apellido, d.tipoDoc, d.documento, d.telefono, d.correo, id]
    );
    await conexion.query('UPDATE cliente SET direccion = ? WHERE id_cliente = ?', [d.direccion, id]);
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function inactivar(id) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [filas] = await conexion.query(
      'SELECT u.estado FROM usuario u JOIN cliente c ON c.id_cliente = u.id_usuario WHERE u.id_usuario = ? FOR UPDATE',
      [id]
    );
    if (!filas[0]) throw new Error('NO_EXISTE');
    if (filas[0].estado === 'INACTIVO') throw new Error('YA_INACTIVO');
    const [[abiertos]] = await conexion.query(
      `SELECT
         (SELECT COUNT(*) FROM pedido WHERE id_cliente = ? AND estado NOT IN ('ENTREGADO', 'CANCELADO')) AS pedidos,
         (SELECT COUNT(*) FROM orden_servicio WHERE id_cliente = ? AND estado NOT IN ('ENTREGADA', 'CANCELADA')) AS ordenes`,
      [id, id]
    );
    if (abiertos.pedidos > 0 || abiertos.ordenes > 0) {
      const error = new Error('TIENE_ABIERTOS');
      error.pedidos = abiertos.pedidos;
      error.ordenes = abiertos.ordenes;
      throw error;
    }
    await conexion.query("UPDATE usuario SET estado = 'INACTIVO' WHERE id_usuario = ?", [id]);
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = { listar, obtener, existeDuplicado, actualizar, inactivar };