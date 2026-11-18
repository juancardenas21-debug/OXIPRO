const express = require('express');
const c = require('../controllers/pedidosController');
const { autenticar, soloRoles } = require('../middlewares/auth');

const router = express.Router();
router.use(autenticar);
router.post('/', soloRoles('CLIENTE'), c.crear);
router.get('/', soloRoles('CLIENTE', 'ADMIN'), c.listar);
router.get('/:id', soloRoles('CLIENTE', 'ADMIN'), c.detalle);

module.exports = router;