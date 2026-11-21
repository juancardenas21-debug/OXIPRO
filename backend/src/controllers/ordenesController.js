const ordenes = require('../repositories/ordenRepository');

const TIPOS = ['PREVENTIVO', 'CORRECTIVO', 'CALIBRACION'];
const RESULTADOS = ['APROBADO', 'NO_APROBADO'];
const esId = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
const esTexto = (v) => typeof v === 'string' && v.trim().length > 0;
const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const noEsPasada = (v) => {
  const hoy = new Date();
  return new Date(v + 'T00:00:00') >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
};

const ERRORES = {
  NO_EXISTE: [404, 'No encontrado'],
  SIN_PERMISO: [403, 'No tienes permiso para esta acción'],
  ESTADO_NO_PERMITE: [409, 'La acción no es posible en el estado actual'],
  DUPLICADO: [409, 'Ya existe un registro igual'],
  NO_APROBADA: [409, 'La prueba de hermeticidad no fue aprobada'],
};

function responder(res, error) {
  const conocido = ERRORES[error.message] || (error.code === 'ER_DUP_ENTRY' ? ERRORES.DUPLICADO : null);
  if (conocido) return res.status(conocido[0]).json({ error: conocido[1] });
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
}

async function crearEquipo(req, res) {
  try {
    if (Number(req.params.id) !== req.usuario.id) {
      return res.status(403).json({ error: 'Solo puedes registrar equipos a tu nombre' });
    }
    const { tipoEquipo, marca, numeroSerie } = req.body;
    if (!esTexto(tipoEquipo) || !esTexto(marca) || !esTexto(numeroSerie)) {
      return res.status(400).json({ error: 'Tipo de equipo, marca y número de serie son obligatorios' });
    }
    const idEquipo = await ordenes.crearEquipo(req.usuario.id, { tipoEquipo, marca, numeroSerie });
    res.status(201).json({ idEquipo });
  } catch (error) {
    responder(res, error);
  }
}

async function listarEquipos(req, res) {
  try {
    if (Number(req.params.id) !== req.usuario.id) {
      return res.status(403).json({ error: 'Solo puedes ver tus equipos' });
    }
    res.json(await ordenes.listarEquipos(req.usuario.id));
  } catch (error) {
    responder(res, error);
  }
}

async function crear(req, res) {
  try {
    const { idEquipo, tipoMantenimiento, descripcionFalla, fechaPreferida } = req.body;
    if (!esId(idEquipo) || !TIPOS.includes(tipoMantenimiento) || !esTexto(descripcionFalla)) {
      return res.status(400).json({ error: 'Equipo, tipo de servicio y descripción de la falla son obligatorios' });
    }
    if (!esFecha(fechaPreferida) || !noEsPasada(fechaPreferida)) {
      return res.status(400).json({ error: 'La fecha preferida debe ser válida (AAAA-MM-DD) y no anterior a hoy' });
    }
    const equipo = await ordenes.obtenerEquipo(idEquipo);
    if (!equipo || equipo.idCliente !== req.usuario.id) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    const idOrden = await ordenes.crear({
      idCliente: req.usuario.id, idEquipo, tipoMantenimiento, descripcionFalla, fechaPreferida,
    });
    res.status(201).json({ idOrden, estado: 'SOLICITADA' });
  } catch (error) {
    responder(res, error);
  }
}

async function listar(req, res) {
  try {
    res.json(await ordenes.listar({ rol: req.usuario.rol, idUsuario: req.usuario.id, estado: req.query.estado }));
  } catch (error) {
    responder(res, error);
  }
}

function puedeVer(orden, usuario) {
  if (usuario.rol === 'ADMIN') return true;
  if (usuario.rol === 'CLIENTE') return orden.idCliente === usuario.id;
  return orden.idTecnico === usuario.id;
}

async function detalle(req, res) {
  try {
    if (!esId(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const orden = await ordenes.obtener(Number(req.params.id));
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!puedeVer(orden, req.usuario)) return res.status(403).json({ error: 'No tienes permiso para ver esta orden' });
    res.json({ ...orden, informe: await ordenes.informeDe(orden.idOrden) });
  } catch (error) {
    responder(res, error);
  }
}

async function actualizar(req, res) {
  try {
    if (!esId(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const id = Number(req.params.id);
    const orden = await ordenes.obtener(id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    const { fechaAgendada, idTecnico, nuevoEstado } = req.body;

    if (req.usuario.rol === 'ADMIN') {
      if (fechaAgendada !== undefined || idTecnico !== undefined) {
        if (!esFecha(fechaAgendada) || !noEsPasada(fechaAgendada) || !esId(idTecnico)) {
          return res.status(400).json({ error: 'Se requiere fechaAgendada válida (AAAA-MM-DD) e idTecnico' });
        }
        if (!(await ordenes.tecnicoActivo(idTecnico))) {
          return res.status(400).json({ error: 'El técnico no existe o está inactivo' });
        }
        if (!(await ordenes.agendar(id, fechaAgendada, idTecnico))) {
          return res.status(409).json({ error: 'Solo se puede agendar una orden SOLICITADA', estadoActual: orden.estado });
        }
        return res.json({ idOrden: id, estado: 'AGENDADA' });
      }
      if (nuevoEstado === 'ENTREGADA') {
        if (!(await ordenes.cambiarEstado(id, 'ENTREGADA', 'FINALIZADA'))) {
          return res.status(409).json({ error: 'Transición no permitida', estadoActual: orden.estado });
        }
        return res.json({ idOrden: id, estado: 'ENTREGADA' });
      }
      return res.status(400).json({ error: 'Envía fechaAgendada e idTecnico, o nuevoEstado ENTREGADA' });
    }

    // Técnico
    if (orden.idTecnico !== req.usuario.id) {
      return res.status(403).json({ error: 'La orden no está asignada a ti' });
    }
    if (nuevoEstado !== 'EN_PROCESO') {
      return res.status(400).json({ error: 'El técnico solo puede pasar la orden a EN_PROCESO' });
    }
    if (!(await ordenes.cambiarEstado(id, 'EN_PROCESO', 'AGENDADA'))) {
      return res.status(409).json({ error: 'Transición no permitida', estadoActual: orden.estado });
    }
    res.json({ idOrden: id, estado: 'EN_PROCESO' });
  } catch (error) {
    responder(res, error);
  }
}

async function cancelar(req, res) {
  try {
    if (!esId(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    if (!esTexto(req.body.motivo)) return res.status(400).json({ error: 'El motivo es obligatorio' });
    const id = Number(req.params.id);
    const orden = await ordenes.obtener(id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (req.usuario.rol === 'CLIENTE' && orden.idCliente !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para cancelar esta orden' });
    }
    if (!(await ordenes.cancelar(id))) {
      return res.status(409).json({ error: 'Solo se puede cancelar una orden SOLICITADA o AGENDADA', estadoActual: orden.estado });
    }
    res.json({ idOrden: id, estado: 'CANCELADA' });
  } catch (error) {
    responder(res, error);
  }
}

async function crearInforme(req, res) {
  try {
    if (!esId(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const { diagnostico, repuestosCambiados, resultadoHermeticidad } = req.body;
    if (!esTexto(diagnostico) || !esTexto(repuestosCambiados) || !RESULTADOS.includes(resultadoHermeticidad)) {
      return res.status(400).json({ error: 'Diagnóstico, repuestos y resultado (APROBADO o NO_APROBADO) son obligatorios' });
    }
    const idInforme = await ordenes.crearInforme(Number(req.params.id), req.usuario.id, {
      diagnostico, repuestosCambiados, resultadoHermeticidad,
    });
    res.status(201).json({ idInforme, estadoOrden: 'FINALIZADA' });
  } catch (error) {
    responder(res, error);
  }
}

async function crearCertificado(req, res) {
  try {
    if (!esId(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const c = await ordenes.crearCertificado(Number(req.params.id), req.usuario.id);
    res.status(201).json(c);
  } catch (error) {
    responder(res, error);
  }
}

async function listarTecnicos(req, res) {
  try {
    res.json(await ordenes.listarTecnicos());
  } catch (error) {
    responder(res, error);
  }
}



module.exports = { crearEquipo, listarEquipos, crear, listar, detalle, actualizar, cancelar, crearInforme, crearCertificado,
                    listarTecnicos
};