const pool = require('../db');

const COLS = `o.id_orden AS idOrden, o.id_cliente AS idCliente, o.id_equipo AS idEquipo, o.id_tecnico AS idTecnico,
  o.fecha_solicitud AS fechaSolicitud, o.fecha_agendada AS fechaAgendada,
  o.tipo_mantenimiento AS tipoMantenimiento, o.descripcion_falla AS descripcionFalla, o.estado`;

async function crearEquipo(idCliente, d) {
  const [r] = await pool.query(
    'INSERT INTO equipo_cliente (id_cliente, tipo_equipo, marca, numero_serie) VALUES (?, ?, ?, ?)',
    [idCliente, d.tipoEquipo, d.marca, d.numeroSerie]
  );
  return r.insertId;
}

async function listarEquipos(idCliente) {
  const [filas] = await pool.query(
    'SELECT id_equipo AS idEquipo, tipo_equipo AS tipoEquipo, marca, numero_serie AS numeroSerie FROM equipo_cliente WHERE id_cliente = ?',
    [idCliente]
  );
  return filas;
}

async function obtenerEquipo(id) {
  const [filas] = await pool.query(
    'SELECT id_equipo AS idEquipo, id_cliente AS idCliente FROM equipo_cliente WHERE id_equipo = ?', [id]
  );
  return filas[0];
}

async function crear(d) {
  const [r] = await pool.query(
    `INSERT INTO orden_servicio (id_cliente, id_equipo, fecha_solicitud, fecha_agendada, tipo_mantenimiento, descripcion_falla, estado)
     VALUES (?, ?, CURDATE(), ?, ?, ?, 'SOLICITADA')`,
    [d.idCliente, d.idEquipo, d.fechaPreferida, d.tipoMantenimiento, d.descripcionFalla]
  );
  return r.insertId;
}

async function obtener(id) {
  const [filas] = await pool.query(`SELECT ${COLS} FROM orden_servicio o WHERE o.id_orden = ?`, [id]);
  return filas[0];
}

async function listar({ rol, idUsuario, estado }) {
  const condiciones = [];
  const valores = [];
  if (rol === 'CLIENTE') { condiciones.push('o.id_cliente = ?'); valores.push(idUsuario); }
  if (rol === 'TECNICO') { condiciones.push('o.id_tecnico = ?'); valores.push(idUsuario); }
  if (estado) { condiciones.push('o.estado = ?'); valores.push(estado); }
  const donde = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  const [filas] = await pool.query(
    `SELECT ${COLS} FROM orden_servicio o ${donde} ORDER BY o.id_orden DESC`, valores
  );
  return filas;
}

async function informeDe(idOrden) {
  const [filas] = await pool.query(
    `SELECT i.id_informe AS idInforme, i.diagnostico, i.repuestos_cambiados AS repuestosCambiados,
            i.resultado_hermeticidad AS resultadoHermeticidad, i.fecha_informe AS fechaInforme,
            c.id_certificado AS idCertificado, c.codigo AS codigoCertificado, c.fecha_emision AS fechaCertificado
     FROM informe_tecnico i LEFT JOIN certificado c ON c.id_informe = i.id_informe
     WHERE i.id_orden = ?`,
    [idOrden]
  );
  return filas[0] || null;
}

async function tecnicoActivo(id) {
  const [filas] = await pool.query(
    "SELECT u.id_usuario FROM usuario u JOIN tecnico t ON t.id_tecnico = u.id_usuario WHERE u.id_usuario = ? AND u.estado = 'ACTIVO'",
    [id]
  );
  return filas.length > 0;
}

async function agendar(id, fecha, idTecnico) {
  const [r] = await pool.query(
    "UPDATE orden_servicio SET fecha_agendada = ?, id_tecnico = ?, estado = 'AGENDADA' WHERE id_orden = ? AND estado = 'SOLICITADA'",
    [fecha, idTecnico, id]
  );
  return r.affectedRows === 1;
}

async function cambiarEstado(id, nuevo, anterior) {
  const [r] = await pool.query(
    'UPDATE orden_servicio SET estado = ? WHERE id_orden = ? AND estado = ?', [nuevo, id, anterior]
  );
  return r.affectedRows === 1;
}

async function cancelar(id) {
  const [r] = await pool.query(
    "UPDATE orden_servicio SET estado = 'CANCELADA' WHERE id_orden = ? AND estado IN ('SOLICITADA', 'AGENDADA')", [id]
  );
  return r.affectedRows === 1;
}

async function crearInforme(idOrden, idTecnico, d) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [f] = await c.query('SELECT id_tecnico, estado FROM orden_servicio WHERE id_orden = ? FOR UPDATE', [idOrden]);
    const o = f[0];
    if (!o) throw new Error('NO_EXISTE');
    if (o.id_tecnico !== idTecnico) throw new Error('SIN_PERMISO');
    if (o.estado !== 'EN_PROCESO') throw new Error('ESTADO_NO_PERMITE');
    const [r] = await c.query(
      `INSERT INTO informe_tecnico (id_orden, diagnostico, repuestos_cambiados, resultado_hermeticidad, fecha_informe)
       VALUES (?, ?, ?, ?, CURDATE())`,
      [idOrden, d.diagnostico, d.repuestosCambiados, d.resultadoHermeticidad]
    );
    await c.query("UPDATE orden_servicio SET estado = 'FINALIZADA' WHERE id_orden = ?", [idOrden]);
    await c.commit();
    return r.insertId;
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}

async function crearCertificado(idInforme, idTecnico) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [f] = await c.query(
      `SELECT i.resultado_hermeticidad AS resultado, o.id_tecnico AS idTecnico
       FROM informe_tecnico i JOIN orden_servicio o ON o.id_orden = i.id_orden
       WHERE i.id_informe = ? FOR UPDATE`,
      [idInforme]
    );
    const i = f[0];
    if (!i) throw new Error('NO_EXISTE');
    if (i.idTecnico !== idTecnico) throw new Error('SIN_PERMISO');
    if (i.resultado !== 'APROBADO') throw new Error('NO_APROBADA');
    const [dup] = await c.query('SELECT id_certificado FROM certificado WHERE id_informe = ?', [idInforme]);
    if (dup.length) throw new Error('DUPLICADO');
    const [r] = await c.query(
      "INSERT INTO certificado (id_informe, codigo, fecha_emision) VALUES (?, CONCAT('T', UNIX_TIMESTAMP(), FLOOR(RAND() * 1000000)), NOW())",
      [idInforme]
    );
    const codigo = `CERT-${new Date().getFullYear()}-${String(r.insertId).padStart(5, '0')}`;
    await c.query('UPDATE certificado SET codigo = ? WHERE id_certificado = ?', [codigo, r.insertId]);
    await c.commit();
    return { idCertificado: r.insertId, codigo };
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}

module.exports = {
  crearEquipo, listarEquipos, obtenerEquipo, crear, obtener, listar, informeDe,
  tecnicoActivo, agendar, cambiarEstado, cancelar, crearInforme, crearCertificado,
};