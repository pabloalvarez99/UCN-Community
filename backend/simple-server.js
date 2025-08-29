const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const User = require('./models/User');

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    message: '🎓 UCN Community API - Servidor Simple',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET / - Este mensaje',
      'GET /api/test/users - Ver todos los usuarios UCN',
      'GET /api/test/database-status - Estado de la base de datos'
    ]
  });
});

// Ruta para ver usuarios UCN
app.get('/api/test/users', async (req, res) => {
  try {
    console.log('🔍 [TEST] Consultando usuarios UCN...');
    
    const users = await User.find({})
      .select('rut email nombre apellidos name carrera facultad role año_ingreso alianza verificado accountStatus fecha_registro campus')
      .sort({ fecha_registro: -1 });

    const stats = {
      total: users.length,
      estudiantes: users.filter(u => u.role === 'student').length,
      profesores: users.filter(u => u.role === 'professor').length,
      verificados: users.filter(u => u.verificado).length,
      activos: users.filter(u => u.accountStatus === 'active').length,
      alianzaAzul: users.filter(u => u.alianza === 'Azul').length,
      alianzaBlanca: users.filter(u => u.alianza === 'Blanca').length
    };

    const carrerasCount = users.reduce((acc, user) => {
      acc[user.carrera] = (acc[user.carrera] || 0) + 1;
      return acc;
    }, {});

    console.log(`✅ [TEST] ${users.length} usuarios encontrados`);

    res.status(200).json({
      success: true,
      message: `✅ ${users.length} usuarios UCN encontrados en MongoDB`,
      timestamp: new Date().toISOString(),
      data: {
        users: users,
        statistics: stats,
        carrerasDistribution: carrerasCount
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// Estado de la base de datos
app.get('/api/test/database-status', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    const connectionState = mongoose.connection.readyState;
    const stateNames = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    const usersCount = await User.countDocuments();
    
    const dbStats = {
      connectionState: stateNames[connectionState],
      database: mongoose.connection.db?.databaseName || 'unknown',
      host: mongoose.connection.host || 'unknown',
      port: mongoose.connection.port || 'unknown',
      totalUsers: usersCount
    };

    console.log(`🔍 [TEST] Estado BD: ${stateNames[connectionState]} - ${usersCount} usuarios`);

    res.status(200).json({
      success: true,
      message: '📊 Estado de base de datos UCN Community',
      timestamp: new Date().toISOString(),
      data: dbStats
    });

  } catch (error) {
    console.error('❌ Error verificando estado de BD:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando estado de base de datos',
      error: error.message
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 ===== UCN COMMUNITY API INICIADO =====`);
  console.log(`📍 Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`📊 MongoDB: ${process.env.MONGO_URI ? 'Configurado' : 'NO CONFIGURADO'}`);
  console.log(`🔗 Endpoints principales:`);
  console.log(`   GET http://localhost:${PORT}/`);
  console.log(`   GET http://localhost:${PORT}/api/test/users`);
  console.log(`   GET http://localhost:${PORT}/api/test/database-status`);
  console.log(`🎓 ========================================\n`);
});

module.exports = app;