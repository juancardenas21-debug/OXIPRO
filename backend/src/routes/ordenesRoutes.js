const express = require('express');
const c = require('../controllers/ordenesController');
const { autenticar, soloRoles } = require('../middlewares/auth');

const router = express.Router();
router.use(autenticar);
router.post('/', soloRoles('CLIENTE'), c.crear);
router.get('/', soloRoles('CLIENTE', 'TECNICO', 'ADMIN'), c.listar);
router.get('/:id', soloRoles('CLIENTE', 'TECNICO', 'ADMIN'), c.detalle);
router.patch('/:id', soloRoles('ADMIN', 'TECNICO'), c.actualizar);
router.post('/:id/cancelacion', soloRoles('CLIENTE', 'ADMIN'), c.cancelar);
router.post('/:id/informe', soloRoles('TECNICO'), c.crearInforme);

module.exports = router;