const jwt = require('jsonwebtoken');
const pool = require('../db');

async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta el token de sesión' });
  }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Sesión inválida o vencida' });
  }
  try {
    const [filas] = await pool.query('SELECT estado FROM usuario WHERE id_usuario = ?', [req.usuario.id]);
    if (!filas[0] || filas[0].estado !== 'ACTIVO') {
      return res.status(401).json({ error: 'Cuenta inactiva o inexistente' });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

function autenticarOpcional(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo === 'Bearer' && token) {
    try {
      req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // token inválido: se trata como visitante
    }
  }
  next();
}

function soloRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

module.exports = { autenticar, autenticarOpcional, soloRoles };