const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta el token de sesión' });
  }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Sesión inválida o vencida' });
  }
}

function soloRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
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

module.exports = { autenticar, autenticarOpcional, soloRoles };