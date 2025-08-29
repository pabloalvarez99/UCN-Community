const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Obtener todos los usuarios (para testing)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 50, carrera, verificado } = req.query;
    
    const filter = {};
    if (carrera) filter.carrera = carrera;
    if (verificado !== undefined) filter.verificado = verificado === 'true';

    const users = await User.find(filter)
      .select('-password -emailVerificationCode -emailVerificationExpires')
      .sort({ fecha_registro: -1 })
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);
    
    const stats = {
      total: users.length,
      totalInDB: total,
      estudiantes: users.filter(u => u.role === 'student').length,
      profesores: users.filter(u => u.role === 'professor').length,
      verificados: users.filter(u => u.verificado).length,
      activos: users.filter(u => u.activo).length
    };

    const carrerasCount = users.reduce((acc, user) => {
      acc[user.carrera] = (acc[user.carrera] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: `${users.length} usuarios encontrados`,
      data: {
        users,
        statistics: stats,
        carrerasDistribution: carrerasCount
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Obtener usuario por ID
 * @access  Public (para testing)
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -emailVerificationCode -emailVerificationExpires');
    
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
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/users/search/:query
 * @desc    Buscar usuarios UCN para chat (requiere autenticación)
 * @access  Protected
 */
router.get('/search/:query', protect, async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10, carrera, campus } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'La búsqueda debe tener al menos 2 caracteres'
      });
    }
    
    // Construir filtro de búsqueda
    const searchFilter = {
      $and: [
        // Excluir al usuario actual
        { _id: { $ne: req.user.id } },
        // Solo usuarios verificados y activos
        { verificado: true },
        { activo: true },
        // Búsqueda por nombre o email
        {
          $or: [
            { name: { $regex: query.trim(), $options: 'i' } },
            { email: { $regex: query.trim(), $options: 'i' } }
          ]
        }
      ]
    };
    
    // Filtros adicionales opcionales
    if (carrera) {
      searchFilter.$and.push({ carrera: { $regex: carrera, $options: 'i' } });
    }
    
    if (campus) {
      searchFilter.$and.push({ campus: { $regex: campus, $options: 'i' } });
    }
    
    const users = await User.find(searchFilter)
      .select('name email carrera campus año_ingreso foto_perfil role verificado')
      .sort({ name: 1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      message: `${users.length} usuarios encontrados para "${query}"`,
      data: {
        users: users.map(user => ({
          id: user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          carrera: user.carrera,
          campus: user.campus,
          año_ingreso: user.año_ingreso,
          foto_perfil: user.foto_perfil,
          role: user.role,
          verificado: user.verificado
        })),
        total: users.length,
        query: query.trim()
      }
    });

  } catch (error) {
    console.error('Error buscando usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;