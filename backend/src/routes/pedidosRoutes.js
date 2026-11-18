const express = require('express');
const c = require('../controllers/pedidosController');
const { autenticar, soloRoles } = require('../middlewares/auth');

const router = express.Router();
router.use(autenticar);
router.post('/', soloRoles('CLIENTE'), c.crear);
router.get('/', soloRoles('CLIENTE', 'ADMIN'), c.listar);
router.get('/:id', soloRoles('CLIENTE', 'ADMIN'), c.detalle);
router.post('/:id/cancelacion', soloRoles('CLIENTE', 'ADMIN'), c.cancelar);
router.patch('/:id/estado', soloRoles('ADMIN'), c.cambiarEstado);
router.post('/:id/pago', soloRoles('ADMIN'), c.registrarPago);
router.get('/:id/factura', soloRoles('CLIENTE', 'ADMIN'), c.factura);

module.exports = router;