require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.get('/salud', async (req, res) => {
  try {
    const [filas] = await pool.query(
      'SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = ?',
      [process.env.DB_NAME]
    );
    res.json({ servidor: 'ok', baseDeDatos: 'ok', tablas: filas[0].tablas });
  } catch (error) {
    res.status(500).json({ servidor: 'ok', baseDeDatos: 'error', detalle: error.message });
  }
});

app.use('/clientes', require('./routes/clientesRoutes'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/productos', require('./routes/productosRoutes'));
app.use('/pedidos', require('./routes/pedidosRoutes'));
app.use('/ordenes', require('./routes/ordenesRoutes'));
app.use('/informes', require('./routes/informesRoutes'));
app.use('/tecnicos', require('./routes/tecnicosRoutes'));

app.listen(process.env.PORT, () => {
  console.log(`API en http://localhost:${process.env.PORT}`);
});