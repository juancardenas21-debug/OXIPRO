const productos = require('../repositories/productoRepository');

function validar(b) {
  if (!b.nombre || !b.categoria) return 'Nombre y categoría son obligatorios';
  if (!(Number(b.precio) > 0)) return 'El precio debe ser mayor a cero';
  if (!Number.isInteger(b.stock) || b.stock < 0) return 'El stock debe ser un entero mayor o igual a cero';
  if (!Number.isInteger(b.stockMinimo) || b.stockMinimo < 0) return 'El stock mínimo debe ser un entero mayor o igual a cero';
  return null;
}

const conAlerta = (p) => ({ ...p, stockBajo: p.stock <= p.stockMinimo });

async function crear(req, res) {
  try {
    const error = validar(req.body);
    if (error) return res.status(400).json({ error });
    const { nombre, categoria, descripcion = '', precio, stock, stockMinimo } = req.body;
    if (await productos.existeNombreCategoria(nombre, categoria)) {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre y categoría' });
    }
    const idProducto = await productos.crear({ nombre, categoria, descripcion, precio, stock, stockMinimo });
    res.status(201).json({ idProducto });
  } catch (e) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizar(req, res) {
  try {
    const id = Number(req.params.id);
    if (!(await productos.obtener(id))) return res.status(404).json({ error: 'Producto no encontrado' });
    const error = validar(req.body);
    if (error) return res.status(400).json({ error });
    const { nombre, categoria, descripcion = '', precio, stock, stockMinimo } = req.body;
    if (await productos.existeNombreCategoria(nombre, categoria, id)) {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre y categoría' });
    }
    await productos.actualizar(id, { nombre, categoria, descripcion, precio, stock, stockMinimo });
    res.json(conAlerta(await productos.obtener(id)));
  } catch (e) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function inactivar(req, res) {
  try {
    const id = Number(req.params.id);
    if (!(await productos.obtener(id))) return res.status(404).json({ error: 'Producto no encontrado' });
    await productos.inactivar(id);
    res.json({ mensaje: 'Producto inactivado' });
  } catch (e) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listar(req, res) {
  try {
    const esAdmin = req.usuario && req.usuario.rol === 'ADMIN';
    const filas = await productos.buscar(req.query, esAdmin);
    res.json(filas.map(conAlerta));
  } catch (e) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function detalle(req, res) {
  try {
    const esAdmin = req.usuario && req.usuario.rol === 'ADMIN';
    const p = await productos.obtener(Number(req.params.id));
    if (!p || (p.estado !== 'ACTIVO' && !esAdmin)) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(conAlerta(p));
  } catch (e) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { crear, actualizar, inactivar, listar, detalle };