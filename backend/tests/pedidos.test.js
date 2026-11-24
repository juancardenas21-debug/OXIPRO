const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db');
const { auth, escenario, stockDe, cerrar } = require('./ayudas');

let e;
beforeEach(async () => { e = await escenario(); });
afterAll(cerrar);

const pedir = (token, lineas, metodoPago = 'TRANSFERENCIA') =>
  request(app).post('/pedidos').set(auth(token)).send({ direccionEntrega: 'Calle 1 # 2-3', metodoPago, lineas });

describe('crear pedido y stock', () => {
  test('crear un pedido descuenta el stock y calcula el total', async () => {
    const res = await pedir(e.anaT, [{ idProducto: e.p1, cantidad: 2 }, { idProducto: e.p2, cantidad: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('PENDIENTE');
    expect(res.body.total).toBe('250000.00');
    expect(await stockDe(e.p1)).toBe(8);
    expect(await stockDe(e.p2)).toBe(4);
    const [[pago]] = await pool.query('SELECT estado FROM pago WHERE id_pedido = ?', [res.body.idPedido]);
    expect(pago.estado).toBe('PENDIENTE');
  });

  test('si una línea no tiene stock, no se guarda nada (rollback)', async () => {
    const res = await pedir(e.anaT, [{ idProducto: e.p1, cantidad: 1 }, { idProducto: e.p2, cantidad: 999 }]);
    expect(res.status).toBe(409);
    expect(await stockDe(e.p1)).toBe(10);
    expect(await stockDe(e.p2)).toBe(5);
    const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM pedido');
    expect(c.n).toBe(0);
  });

  test('el precio enviado por el cliente se ignora', async () => {
    const res = await pedir(e.anaT, [{ idProducto: e.p1, cantidad: 1, precio: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.total).toBe('100000.00');
  });

  test('cancelar un pedido repone el stock una sola vez', async () => {
    const creado = await pedir(e.anaT, [{ idProducto: e.p1, cantidad: 2 }]);
    const id = creado.body.idPedido;
    expect(await stockDe(e.p1)).toBe(8);

    const cancelar = () => request(app).post(`/pedidos/${id}/cancelacion`).set(auth(e.anaT)).send({ motivo: 'Prueba' });
    expect((await cancelar()).status).toBe(200);
    expect(await stockDe(e.p1)).toBe(10);

    expect((await cancelar()).status).toBe(409);
    expect(await stockDe(e.p1)).toBe(10);
  });
});

describe('permisos sobre los pedidos', () => {
  test('un cliente no puede ver el pedido de otro cliente', async () => {
    const creado = await pedir(e.anaT, [{ idProducto: e.p1, cantidad: 1 }]);
    const res = await request(app).get(`/pedidos/${creado.body.idPedido}`).set(auth(e.luisT));
    expect(res.status).toBe(403);
  });

  test('un cliente no puede usar las acciones del administrador', async () => {
    const creado = await pedir(e.anaT, [{ idProducto: e.p1, cantidad: 1 }]);
    const id = creado.body.idPedido;
    const estado = await request(app).patch(`/pedidos/${id}/estado`).set(auth(e.anaT)).send({ nuevoEstado: 'EN_PREPARACION' });
    const pago = await request(app).post(`/pedidos/${id}/pago`).set(auth(e.anaT))
      .send({ metodo: 'TRANSFERENCIA', monto: '100000.00', referencia: 'X' });
    expect(estado.status).toBe(403);
    expect(pago.status).toBe(403);
  });

  test('sin token no se puede crear un pedido', async () => {
    const res = await request(app).post('/pedidos').send({});
    expect(res.status).toBe(401);
  });
});

describe('pago, factura y estados', () => {
  test('el pago manual exige el monto exacto y genera la factura', async () => {
    const creado = await pedir(e.anaT, [{ idProducto: e.p1, cantidad: 1 }]);
    const id = creado.body.idPedido;
    const pagar = (monto) => request(app).post(`/pedidos/${id}/pago`).set(auth(e.adminT))
      .send({ metodo: 'TRANSFERENCIA', monto, referencia: 'COMP-1' });

    expect((await pagar('1000.00')).status).toBe(400);
    const [[antes]] = await pool.query('SELECT estado FROM pedido WHERE id_pedido = ?', [id]);
    expect(antes.estado).toBe('PENDIENTE');

    expect((await pagar('100000.00')).status).toBe(200);
    const [[despues]] = await pool.query('SELECT estado FROM pedido WHERE id_pedido = ?', [id]);
    expect(despues.estado).toBe('PAGADO');
    const [[factura]] = await pool.query('SELECT impuestos, total_a_pagar FROM factura WHERE id_pedido = ?', [id]);
    expect(factura.total_a_pagar).toBe('100000.00');
    expect(factura.impuestos).toBe('15966.39');
  });

  test('los estados avanzan en orden y no se pueden saltar', async () => {
    const creado = await pedir(e.anaT, [{ idProducto: e.p1, cantidad: 1 }]);
    const id = creado.body.idPedido;
    await request(app).post(`/pedidos/${id}/pago`).set(auth(e.adminT))
      .send({ metodo: 'TRANSFERENCIA', monto: '100000.00', referencia: 'COMP-2' });
    const cambiar = (nuevoEstado) => request(app).patch(`/pedidos/${id}/estado`).set(auth(e.adminT)).send({ nuevoEstado });

    expect((await cambiar('ENVIADO')).status).toBe(409); // se salta EN_PREPARACION
    expect((await cambiar('EN_PREPARACION')).status).toBe(200);
    expect((await cambiar('ENVIADO')).status).toBe(200);
    expect((await cambiar('ENTREGADO')).status).toBe(200);

    const cancelar = await request(app).post(`/pedidos/${id}/cancelacion`).set(auth(e.adminT)).send({ motivo: 'Prueba' });
    expect(cancelar.status).toBe(409); // un pedido entregado no se cancela
  });
});
