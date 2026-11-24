// Se ejecuta antes de cada archivo de pruebas.
// Fuerza el uso de la base de datos de pruebas, nunca la de la demo.
require('dotenv').config();
process.env.DB_NAME = 'oxipro_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas';
