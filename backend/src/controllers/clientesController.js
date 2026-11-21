const bcrypt = require('bcryptjs');
const usuarios = require('../repositories/usuarioRepository');
const clientes = require('../repositories/clienteRepository');

async function registrarCliente(req, res) {
  try {
    const { nombre, apellido, tipoDoc, documento, telefono, correo, direccion, password } = req.body;
    if (!nombre || !apellido || !tipoDoc || !documento || !telefono || !correo || !direccion || !password) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
    }
    if (await usuarios.existeDocumentoOCorreo(documento, correo)) {
      return res.status(409).json({ error: 'El documento o el correo ya están registrados' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const idCliente = await usuarios.crearCliente({
      nombre, apellido, tipoDoc, documento, telefono, correo, direccion, passwordHash,
    });
    res.status(201).json({ idCliente });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

const esId = (v) => /^\d+$/.test(String(v)) && Number(v) > 0;
const esTexto = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS_DOC = ['CC', 'NIT', 'CE'];

function fallo(res, error) {
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
}

async function listar(req, res) {
  try {
    const estado = ['ACTIVO', 'INACTIVO'].includes(req.query.estado) ? req.query.estado : undefined;
    const texto = typeof req.query.texto === 'string' ? req.query.texto.trim() : '';
    res.json(await clientes.listar({ texto, estado }));
  } catch (error) {
    fallo(res, error);
  }
}

async function detalle(req, res) {
  try {
    if (!esId(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const id = Number(req.params.id);
    if (req.usuario.rol === 'CLIENTE' && req.usuario.id !== id) {
      return res.status(403).json({ error: 'Solo puedes ver tus propios datos' });
    }
    const cliente = await clientes.obtener(id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (error) {
    fallo(res, error);
  }
}

async function actualizar(req, res) {
  try {
    if (!esId(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    const id = Number(req.params.id);
    const esAdmin = req.usuario.rol === 'ADMIN';
    if (!esAdmin && req.usuario.id !== id) {
      return res.status(403).json({ error: 'Solo puedes modificar tus propios datos' });
    }
    const actual = await clientes.obtener(id);
    if (!actual) return res.status(404).json({ error: 'Cliente no encontrado' });

    const b = req.body;
    if (!esTexto(b.nombre, 60) || !esTexto(b.apellido, 60) || !esTexto(b.telefono, 15)
        || !esTexto(b.direccion, 150) || !esTexto(b.correo, 100) || !CORREO.test(b.correo.trim())) {
      return res.status(400).json({ error: 'Nombre, apellido, teléfono, correo y dirección son obligatorios y deben tener un formato válido' });
    }
    let tipoDoc = actual.tipoDoc;
    let documento = actual.documento;
    if (esAdmin) {
      if (!TIPOS_DOC.includes(b.tipoDoc) || !esTexto(b.documento, 20)) {
        return res.status(400).json({ error: 'Tipo y número de documento no válidos' });
      }
      tipoDoc = b.tipoDoc;
      documento = b.documento.trim();
    }
    const correo = b.correo.trim();
    if (await clientes.existeDuplicado(documento, correo, id)) {
      return res.status(409).json({ error: 'El documento o el correo ya pertenecen a otro usuario' });
    }
    await clientes.actualizar(id, {
      nombre: b.nombre.trim(), apellido: b.apellido.trim(), tipoDoc, documento,
      telefono: b.telefono.trim(), correo, direccion: b.direccion.trim(),
    });
    res.json(await clientes.obtener(id));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El documento o el correo ya pertenecen a otro usuario' });
    }
    fallo(res, error);
  }
}

async function inactivar(req, res) {
  try {
    if (!esId(req.params.id)) return res.status(400).json({ error: 'Id no válido' });
    await clientes.inactivar(Number(req.params.id));
    res.json({ mensaje: 'Cliente inactivado' });
  } catch (error) {
    if (error.message === 'NO_EXISTE') return res.status(404).json({ error: 'Cliente no encontrado' });
    if (error.message === 'YA_INACTIVO') return res.status(409).json({ error: 'El cliente ya está inactivo' });
    if (error.message === 'TIENE_ABIERTOS') {
      return res.status(409).json({
        error: `Tiene ${error.pedidos} pedido(s) y ${error.ordenes} orden(es) abiertos. Ciérralos o cancélalos antes de inactivar al cliente.`,
      });
    }
    fallo(res, error);
  }
}
module.exports = { registrarCliente, listar, detalle, actualizar, inactivar };