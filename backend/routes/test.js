const express = require('express');
const User = require('../models/User');
const router = express.Router();

/**
 * @route   GET /api/test/users
 * @desc    Obtener todos los usuarios UCN para testing
 * @access  Public (solo para desarrollo)
 */
router.get('/users', async (req, res) => {
  try {
    // Obtener todos los usuarios con información básica
    const users = await User.find({})
      .select('rut email nombre apellidos name carrera facultad role año_ingreso alianza verificado accountStatus fecha_registro campus')
      .sort({ fecha_registro: -1 });

    // Estadísticas rápidas
    const stats = {
      total: users.length,
      estudiantes: users.filter(u => u.role === 'student').length,
      profesores: users.filter(u => u.role === 'professor').length,
      verificados: users.filter(u => u.verificado).length,
      activos: users.filter(u => u.accountStatus === 'active').length,
      alianzaAzul: users.filter(u => u.alianza === 'Azul').length,
      alianzaBlanca: users.filter(u => u.alianza === 'Blanca').length,
      carrerasUnicas: [...new Set(users.map(u => u.carrera))].length
    };

    // Carreras representadas
    const carrerasCount = users.reduce((acc, user) => {
      acc[user.carrera] = (acc[user.carrera] || 0) + 1;
      return acc;
    }, {});

    // Años de ingreso
    const añosCount = users.reduce((acc, user) => {
      acc[user.año_ingreso] = (acc[user.año_ingreso] || 0) + 1;
      return acc;
    }, {});

    console.log(`🔍 [TEST] Consulta a usuarios - Total: ${users.length} usuarios encontrados`);

    res.status(200).json({
      success: true,
      message: `${users.length} usuarios UCN encontrados`,
      timestamp: new Date().toISOString(),
      data: {
        users: users,
        statistics: stats,
        carrerasDistribution: carrerasCount,
        añosDistribution: añosCount
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

/**
 * @route   GET /api/test/users/:id
 * @desc    Obtener usuario específico por ID
 * @access  Public (solo para desarrollo)
 */
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Usuario encontrado',
      data: { user }
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/test/users-by-carrera/:carrera
 * @desc    Obtener usuarios por carrera
 * @access  Public (solo para desarrollo)
 */
router.get('/users-by-carrera/:carrera', async (req, res) => {
  try {
    const { carrera } = req.params;
    const users = await User.find({ carrera })
      .select('nombre apellidos email carrera año_ingreso alianza')
      .sort({ nombre: 1 });

    res.status(200).json({
      success: true,
      message: `${users.length} usuarios encontrados en ${carrera}`,
      data: { 
        carrera,
        count: users.length,
        users 
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuarios por carrera:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/test/database-status
 * @desc    Verificar estado de la conexión a la base de datos
 * @access  Public (solo para desarrollo)
 */
router.get('/database-status', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Verificar conexión
    const connectionState = mongoose.connection.readyState;
    const stateNames = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    // Obtener estadísticas de la base de datos
    const usersCount = await User.countDocuments();
    const dbStats = {
      connectionState: stateNames[connectionState],
      database: mongoose.connection.db?.databaseName || 'unknown',
      host: mongoose.connection.host || 'unknown',
      port: mongoose.connection.port || 'unknown',
      totalUsers: usersCount
    };

    console.log(`🔍 [TEST] Estado de base de datos consultado: ${stateNames[connectionState]}`);

    res.status(200).json({
      success: true,
      message: 'Estado de base de datos obtenido',
      timestamp: new Date().toISOString(),
      data: dbStats
    });

  } catch (error) {
    console.error('❌ Error verificando estado de base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando estado de base de datos',
      error: error.message
    });
  }
});

module.exports = router;