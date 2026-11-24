const request = require('supertest');
const app = require('../src/app');
const { auth, CORREOS, CLAVE, escenario, cerrar } = require('./ayudas');

let e;
beforeEach(async () => { e = await escenario(); });
afterAll(cerrar);

describe('servidor y base de datos', () => {
  test('el servidor responde y la base de pruebas tiene las 12 tablas', async () => {
    const res = await request(app).get('/salud');
    expect(res.status).toBe(200);
    expect(res.body.baseDeDatos).toBe('ok');
    expect(res.body.tablas).toBe(12);
  });
});

describe('inicio de sesión', () => {
  test('con datos correctos devuelve el token y el rol', async () => {
    const res = await request(app).post('/auth/login').send({ correo: CORREOS.ana, password: CLAVE });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.rol).toBe('CLIENTE');
  });

  test('contraseña errónea y correo inexistente dan el mismo mensaje', async () => {
    const mala = await request(app).post('/auth/login').send({ correo: CORREOS.ana, password: 'otra-clave' });
    const inexistente = await request(app).post('/auth/login').send({ correo: 'nadie@test.com', password: CLAVE });
    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mala.body.error).toBe(inexistente.body.error);
  });

  test('sin contraseña responde 400', async () => {
    const res = await request(app).post('/auth/login').send({ correo: CORREOS.ana });
    expect(res.status).toBe(400);
  });
});

describe('roles y sesión', () => {
  test('una ruta protegida sin token responde 401', async () => {
    expect((await request(app).get('/pedidos')).status).toBe(401);
  });

  test('un cliente no puede entrar a las rutas del administrador', async () => {
    expect((await request(app).get('/clientes').set(auth(e.anaT))).status).toBe(403);
    expect((await request(app).get('/tecnicos').set(auth(e.anaT))).status).toBe(403);
  });
});

describe('clientes', () => {
  const datos = {
    nombre: 'Nuevo', apellido: 'Cliente', tipoDoc: 'CC', documento: '5550001', telefono: '3001112233',
    correo: 'nuevo@test.com', direccion: 'Calle 9 # 8-7', password: 'clave1234',
  };

  test('el registro funciona y rechaza duplicados y contraseñas cortas', async () => {
    expect((await request(app).post('/clientes').send(datos)).status).toBe(201);
    expect((await request(app).post('/clientes').send(datos)).status).toBe(409);
    expect((await request(app).post('/clientes').send({ ...datos, documento: '5550002', correo: 'otro@test.com', password: 'corta' })).status).toBe(400);
  });

  test('al inactivar un cliente se bloquea su sesión de inmediato', async () => {
    const inactivar = await request(app).patch(`/clientes/${e.luisId}/inactivar`).set(auth(e.adminT));
    expect(inactivar.status).toBe(200);
    expect((await request(app).get('/pedidos').set(auth(e.luisT))).status).toBe(401); // token anterior
    expect((await request(app).post('/auth/login').send({ correo: CORREOS.luis, password: CLAVE })).status).toBe(401);
  });
});
