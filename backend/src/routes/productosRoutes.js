const express = require('express');
const c = require('../controllers/productosController');
const { autenticar, autenticarOpcional, soloRoles } = require('../middlewares/auth');

const router = express.Router();
router.get('/', autenticarOpcional, c.listar);
router.get('/:id', autenticarOpcional, c.detalle);
router.post('/', autenticar, soloRoles('ADMIN'), c.crear);
router.put('/:id', autenticar, soloRoles('ADMIN'), c.actualizar);
router.patch('/:id/inactivar', autenticar, soloRoles('ADMIN'), c.inactivar);

module.exports = router;