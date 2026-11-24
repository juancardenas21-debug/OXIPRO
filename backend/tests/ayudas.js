const bcrypt = require('bcryptjs');
const request = require('supertest');
const pool = require('../src/db');
const app = require('../src/app');

const CLAVE = 'clave1234';
const CORREOS = {
  admin: 'admin@test.com',
  ana: 'ana@test.com',
  luis: 'luis@test.com',
  tecnico: 'tecnico@test.com',
};

const auth = (token) => ({ Authorization: 'Bearer ' + token });

function fechaFutura(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local
}

// Protección: nunca se borra nada si la base no es de pruebas
function exigirBasePruebas() {
  if (!/_test$/.test(process.env.DB_NAME || '')) {
    throw new Error('Las pruebas solo pueden usar una base cuyo nombre termine en _test');
  }
}

async function limpiar() {
  exigirBasePruebas();
  const tablas = ['certificado', 'informe_tecnico', 'orden_servicio', 'equipo_cliente', 'factura', 'pago',
    'detalle_pedido', 'pedido', 'producto', 'tecnico', 'cliente', 'usuario'];
  for (const tabla of tablas) await pool.query(`DELETE FROM ${tabla}`);
}

async function crearUsuario({ rol, nombre, correo, documento }) {
  const hash = bcrypt.hashSync(CLAVE, 4);
  const [r] = await pool.query(
    `INSERT INTO usuario (nombre, apellido, tipo_doc, documento, telefono, correo, password_hash, rol, estado)
     VALUES (?, 'Prueba', 'CC', ?, '3000000000', ?, ?, ?, 'ACTIVO')`,
    [nombre, documento, correo, hash, rol]
  );
  const id = r.insertId;
  if (rol === 'CLIENTE') await pool.query('INSERT INTO cliente (id_cliente, direccion) VALUES (?, ?)', [id, 'Calle 1 # 2-3']);
  if (rol === 'TECNICO') await pool.query('INSERT INTO tecnico (id_tecnico, especialidad) VALUES (?, ?)', [id, 'Reguladores']);
  return id;
}

async function crearProducto({ nombre, precio, stock, stockMinimo = 1 }) {
  const [r] = await pool.query(
    `INSERT INTO producto (nombre, categoria, descripcion, precio, stock, stock_minimo, estado)
     VALUES (?, 'Reguladores', 'Producto de prueba', ?, ?, ?, 'ACTIVO')`,
    [nombre, precio, stock, stockMinimo]
  );
  return r.insertId;
}

async function iniciarSesion(correo) {
  const r = await request(app).post('/auth/login').send({ correo, password: CLAVE });
  return r.body.token;
}

async function stockDe(idProducto) {
  const [[fila]] = await pool.query('SELECT stock FROM producto WHERE id_producto = ?', [idProducto]);
  return fila.stock;
}

// Deja la base de pruebas en un estado conocido: 4 usuarios y 2 productos
async function escenario() {
  await limpiar();
  const adminId = await crearUsuario({ rol: 'ADMIN', nombre: 'Admin', correo: CORREOS.admin, documento: '1000000001' });
  const anaId = await crearUsuario({ rol: 'CLIENTE', nombre: 'Ana', correo: CORREOS.ana, documento: '1000000002' });
  const luisId = await crearUsuario({ rol: 'CLIENTE', nombre: 'Luis', correo: CORREOS.luis, documento: '1000000003' });
  const tecnicoId = await crearUsuario({ rol: 'TECNICO', nombre: 'Carlos', correo: CORREOS.tecnico, documento: '1000000004' });
  const p1 = await crearProducto({ nombre: 'Regulador de prueba', precio: '100000.00', stock: 10 });
  const p2 = await crearProducto({ nombre: 'Soplete de prueba', precio: '50000.00', stock: 5 });
  return {
    adminId, anaId, luisId, tecnicoId, p1, p2,
    adminT: await iniciarSesion(CORREOS.admin),
    anaT: await iniciarSesion(CORREOS.ana),
    luisT: await iniciarSesion(CORREOS.luis),
    tecnicoT: await iniciarSesion(CORREOS.tecnico),
  };
}

async function cerrar() {
  await pool.end();
}

module.exports = { CLAVE, CORREOS, auth, fechaFutura, escenario, stockDe, cerrar };
