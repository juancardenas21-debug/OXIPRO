const request = require('supertest');
const app = require('../src/app');
const { auth, fechaFutura, escenario, cerrar } = require('./ayudas');

let e;
beforeEach(async () => { e = await escenario(); });
afterAll(cerrar);

// Lleva una orden desde la solicitud hasta el informe técnico
async function hastaInforme(resultadoHermeticidad) {
  const equipo = await request(app).post(`/clientes/${e.anaId}/equipos`).set(auth(e.anaT))
    .send({ tipoEquipo: 'Regulador', marca: 'Harris', numeroSerie: '48213' });
  const fecha = fechaFutura(10);
  const orden = await request(app).post('/ordenes').set(auth(e.anaT)).send({
    idEquipo: equipo.body.idEquipo, tipoMantenimiento: 'CORRECTIVO',
    descripcionFalla: 'Fuga en la conexión de salida', fechaPreferida: fecha,
  });
  const idOrden = orden.body.idOrden;
  await request(app).patch(`/ordenes/${idOrden}`).set(auth(e.adminT)).send({ fechaAgendada: fecha, idTecnico: e.tecnicoId });
  await request(app).patch(`/ordenes/${idOrden}`).set(auth(e.tecnicoT)).send({ nuevoEstado: 'EN_PROCESO' });
  const informe = await request(app).post(`/ordenes/${idOrden}/informe`).set(auth(e.tecnicoT)).send({
    diagnostico: 'Se cambió el o-ring', repuestosCambiados: 'O-ring 3/8', resultadoHermeticidad,
  });
  return { idOrden, idInforme: informe.body.idInforme, equipoId: equipo.body.idEquipo };
}

describe('servicio técnico', () => {
  test('el flujo completo con prueba aprobada termina con certificado y entrega', async () => {
    const { idOrden, idInforme } = await hastaInforme('APROBADO');

    const certificado = await request(app).post(`/informes/${idInforme}/certificado`).set(auth(e.tecnicoT));
    expect(certificado.status).toBe(201);
    expect(certificado.body.codigo).toMatch(/^CERT-\d{4}-\d{5}$/);

    const consulta = await request(app).get(`/ordenes/${idOrden}`).set(auth(e.anaT));
    expect(consulta.status).toBe(200);
    expect(consulta.body.estado).toBe('FINALIZADA');
    expect(consulta.body.informe.resultadoHermeticidad).toBe('APROBADO');
    expect(consulta.body.informe.codigoCertificado).toBe(certificado.body.codigo);

    const entrega = await request(app).patch(`/ordenes/${idOrden}`).set(auth(e.adminT)).send({ nuevoEstado: 'ENTREGADA' });
    expect(entrega.status).toBe(200);
    const final = await request(app).get(`/ordenes/${idOrden}`).set(auth(e.anaT));
    expect(final.body.estado).toBe('ENTREGADA');
  });

  test('no se genera el certificado si la prueba no fue aprobada', async () => {
    const { idInforme } = await hastaInforme('NO_APROBADO');
    const res = await request(app).post(`/informes/${idInforme}/certificado`).set(auth(e.tecnicoT));
    expect(res.status).toBe(409);
  });

  test('un cliente no puede ver la orden de otro cliente', async () => {
    const { idOrden } = await hastaInforme('APROBADO');
    const res = await request(app).get(`/ordenes/${idOrden}`).set(auth(e.luisT));
    expect(res.status).toBe(403);
  });

  test('la solicitud rechaza fechas pasadas y equipos ajenos', async () => {
    const equipo = await request(app).post(`/clientes/${e.anaId}/equipos`).set(auth(e.anaT))
      .send({ tipoEquipo: 'Soplete', marca: 'Victor', numeroSerie: '777' });
    const base = { tipoMantenimiento: 'PREVENTIVO', descripcionFalla: 'Revisión', fechaPreferida: fechaFutura(5) };

    const pasada = await request(app).post('/ordenes').set(auth(e.anaT))
      .send({ ...base, idEquipo: equipo.body.idEquipo, fechaPreferida: '2020-01-01' });
    expect(pasada.status).toBe(400);

    const ajeno = await request(app).post('/ordenes').set(auth(e.luisT)).send({ ...base, idEquipo: equipo.body.idEquipo });
    expect(ajeno.status).toBe(404);
  });
});
