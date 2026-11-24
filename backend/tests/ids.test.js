// Ejemplo de TDD: estas pruebas se escribieron ANTES de corregir el código.
// Un identificador que no es un número debe responder 400, no 500.
const request = require('supertest');
const app = require('../src/app');
const { auth, escenario, cerrar } = require('./ayudas');

let e;
beforeEach(async () => { e = await escenario(); });
afterAll(cerrar);

const casos = [
  ['get', '/pedidos/abc', undefined],
  ['get', '/pedidos/abc/factura', undefined],
  ['post', '/pedidos/abc/cancelacion', { motivo: 'Prueba' }],
  ['patch', '/pedidos/abc/estado', { nuevoEstado: 'EN_PREPARACION' }],
  ['post', '/pedidos/abc/pago', { metodo: 'TRANSFERENCIA', monto: '1.00', referencia: 'X' }],
];

test.each(casos)('%s %s con un id no numérico responde 400', async (metodo, ruta, cuerpo) => {
  let peticion = request(app)[metodo](ruta).set(auth(e.adminT));
  if (cuerpo) peticion = peticion.send(cuerpo);
  const res = await peticion;
  expect(res.status).toBe(400);
});
