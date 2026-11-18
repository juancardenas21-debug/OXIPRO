const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarios = require('../repositories/usuarioRepository');

async function login(req, res) {
  try {
    const { correo, password } = req.body;
    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }
    const usuario = await usuarios.buscarPorCorreo(correo);
    const valido = usuario
      && usuario.estado === 'ACTIVO'
      && await bcrypt.compare(password, usuario.password_hash);
    if (!valido) {
      return res.status(401).json({ error: 'Datos incorrectos' });
    }
    const token = jwt.sign(
      { id: usuario.id_usuario, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login };