const pool = require('../db');

const COLUMNAS = `id_producto AS idProducto, nombre, categoria, descripcion, precio,
  stock, stock_minimo AS stockMinimo, estado`;

async function existeNombreCategoria(nombre, categoria, excluirId = 0) {
  const [filas] = await pool.query(
    'SELECT id_producto FROM producto WHERE nombre = ? AND categoria = ? AND id_producto <> ?',
    [nombre, categoria, excluirId]
  );
  return filas.length > 0;
}

async function crear(p) {
  const [r] = await pool.query(
    `INSERT INTO producto (nombre, categoria, descripcion, precio, stock, stock_minimo, estado)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVO')`,
    [p.nombre, p.categoria, p.descripcion, p.precio, p.stock, p.stockMinimo]
  );
  return r.insertId;
}

async function obtener(id) {
  const [filas] = await pool.query(`SELECT ${COLUMNAS} FROM producto WHERE id_producto = ?`, [id]);
  return filas[0];
}

async function actualizar(id, p) {
  await pool.query(
    `UPDATE producto SET nombre = ?, categoria = ?, descripcion = ?, precio = ?, stock = ?, stock_minimo = ?
     WHERE id_producto = ?`,
    [p.nombre, p.categoria, p.descripcion, p.precio, p.stock, p.stockMinimo, id]
  );
}

async function inactivar(id) {
  await pool.query("UPDATE producto SET estado = 'INACTIVO' WHERE id_producto = ?", [id]);
}

async function buscar(f, esAdmin) {
  const condiciones = [];
  const valores = [];
  if (!esAdmin) condiciones.push("estado = 'ACTIVO'");
  if (f.texto) {
    condiciones.push('(nombre LIKE ? OR descripcion LIKE ?)');
    valores.push(`%${f.texto}%`, `%${f.texto}%`);
  }
  if (f.categoria) { condiciones.push('categoria = ?'); valores.push(f.categoria); }
  if (f.precioMin) { condiciones.push('precio >= ?'); valores.push(f.precioMin); }
  if (f.precioMax) { condiciones.push('precio <= ?'); valores.push(f.precioMax); }
  if (f.soloDisponibles === 'true') condiciones.push('stock > 0');
  const donde = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM producto ${donde} ORDER BY nombre`,
    valores
  );
  return filas;
}

module.exports = { existeNombreCategoria, crear, obtener, actualizar, inactivar, buscar };