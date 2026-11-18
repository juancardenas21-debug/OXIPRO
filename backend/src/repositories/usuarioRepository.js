const pool = require('../db');

async function existeDocumentoOCorreo(documento, correo) {
  const [filas] = await pool.query(
    'SELECT id_usuario FROM usuario WHERE documento = ? OR correo = ?',
    [documento, correo]
  );
  return filas.length > 0;
}

async function crearCliente(d) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [resultado] = await conexion.query(
      `INSERT INTO usuario (nombre, apellido, tipo_doc, documento, telefono, correo, password_hash, rol, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'CLIENTE', 'ACTIVO')`,
      [d.nombre, d.apellido, d.tipoDoc, d.documento, d.telefono, d.correo, d.passwordHash]
    );
    await conexion.query(
      'INSERT INTO cliente (id_cliente, direccion) VALUES (?, ?)',
      [resultado.insertId, d.direccion]
    );
    await conexion.commit();
    return resultado.insertId;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function buscarPorCorreo(correo) {
  const [filas] = await pool.query(
    'SELECT id_usuario, nombre, password_hash, rol, estado FROM usuario WHERE correo = ?',
    [correo]
  );
  return filas[0];
}

module.exports = { existeDocumentoOCorreo, crearCliente, buscarPorCorreo };
