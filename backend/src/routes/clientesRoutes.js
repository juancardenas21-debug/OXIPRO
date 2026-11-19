const express = require('express');
const { registrarCliente } = require('../controllers/clientesController');

const router = express.Router();
router.post('/', registrarCliente);
const { autenticar, soloRoles } = require('../middlewares/auth');
const ordenesController = require('../controllers/ordenesController');

router.post('/:id/equipos', autenticar, soloRoles('CLIENTE'), ordenesController.crearEquipo);
router.get('/:id/equipos', autenticar, soloRoles('CLIENTE'), ordenesController.listarEquipos);

module.exports = router;