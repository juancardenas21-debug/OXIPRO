const express = require('express');
const { registrarCliente } = require('../controllers/clientesController');

const router = express.Router();
router.post('/', registrarCliente);

module.exports = router;