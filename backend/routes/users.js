const express = require('express');
const {
  searchUsers,
  getUserProfile,
  updateUserProfile,
  changePassword,
  getUserById,
  getSuggestedUsers
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { 
  updateProfileValidation,
  changePasswordValidation,
  handleValidationErrors
} = require('../validators/userValidators');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting para búsquedas
const searchLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 búsquedas por IP cada 15 minutos
  message: {
    success: false,
    message: 'Demasiadas búsquedas. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para actualización de perfil
const updateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // máximo 5 actualizaciones por IP por minuto
  message: {
    success: false,
    message: 'Demasiadas actualizaciones. Intenta de nuevo en un minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para cambio de contraseña
const passwordLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3, // máximo 3 cambios de contraseña cada 15 minutos
  message: {
    success: false,
    message: 'Demasiados intentos de cambio de contraseña. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar protección a todas las rutas
router.use(protect);

// @route   GET /api/users
// @desc    Buscar usuarios con filtros
// @access  Protected
// @query   search, carrera, campus, año_ingreso, verificado, page, limit, sortBy, order
router.get('/', searchLimit, searchUsers);

// @route   GET /api/users/profile
// @desc    Obtener perfil del usuario actual
// @access  Protected
router.get('/profile', getUserProfile);

// @route   PUT /api/users/profile
// @desc    Actualizar perfil del usuario actual
// @access  Protected
router.put('/profile', 
  updateLimit,
  updateProfileValidation,
  handleValidationErrors,
  updateUserProfile
);

// @route   PUT /api/users/password
// @desc    Cambiar contraseña del usuario actual
// @access  Protected
router.put('/password',
  passwordLimit,
  changePasswordValidation,
  handleValidationErrors,
  changePassword
);

// @route   GET /api/users/suggestions
// @desc    Obtener usuarios sugeridos para conectar
// @access  Protected
router.get('/suggestions', getSuggestedUsers);

// @route   GET /api/users/:id
// @desc    Obtener perfil público de un usuario específico
// @access  Protected
router.get('/:id', getUserById);

module.exports = router;