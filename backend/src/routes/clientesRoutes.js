const express = require('express');
const { registrarCliente, listar, detalle, actualizar, inactivar } = require('../controllers/clientesController');
const ordenesController = require('../controllers/ordenesController');
const { autenticar, soloRoles } = require('../middlewares/auth');

const router = express.Router();
router.post('/', registrarCliente);
router.get('/', autenticar, soloRoles('ADMIN'), listar);
router.get('/:id/equipos', autenticar, soloRoles('CLIENTE'), ordenesController.listarEquipos);
router.post('/:id/equipos', autenticar, soloRoles('CLIENTE'), ordenesController.crearEquipo);
router.get('/:id', autenticar, soloRoles('ADMIN', 'CLIENTE'), detalle);
router.put('/:id', autenticar, soloRoles('ADMIN', 'CLIENTE'), actualizar);
router.patch('/:id/inactivar', autenticar, soloRoles('ADMIN'), inactivar);

module.exports = router;