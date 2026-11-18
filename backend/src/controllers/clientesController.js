const bcrypt = require('bcryptjs');
const usuarios = require('../repositories/usuarioRepository');

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

module.exports = { registrarCliente };