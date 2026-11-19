const express = require('express');
const c = require('../controllers/ordenesController');
const { autenticar, soloRoles } = require('../middlewares/auth');

const router = express.Router();
router.post('/:id/certificado', autenticar, soloRoles('TECNICO'), c.crearCertificado);

module.exports = router;