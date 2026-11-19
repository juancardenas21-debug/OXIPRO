const express = require('express');
const c = require('../controllers/ordenesController');
const { autenticar, soloRoles } = require('../middlewares/auth');

const router = express.Router();
router.get('/', autenticar, soloRoles('ADMIN'), c.listarTecnicos);

module.exports = router;