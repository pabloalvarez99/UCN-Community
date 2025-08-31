const User = require('../models/User');
const { asyncHandler, createResponse, sanitizeUser } = require('../utils/helpers');
const { validationResult } = require('express-validator');

// @desc    Buscar usuarios
// @route   GET /api/users
// @access  Protected
const searchUsers = asyncHandler(async (req, res) => {
  const { 
    search, 
    carrera, 
    campus, 
    año_ingreso, 
    verificado,
    page = 1, 
    limit = 20,
    sortBy = 'name',
    order = 'asc'
  } = req.query;

  // Construir filtros de búsqueda
  const filters = { isActive: true };

  // Búsqueda por texto
  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { carrera: { $regex: search, $options: 'i' } },
      { biografia: { $regex: search, $options: 'i' } }
    ];
  }

  // Filtros específicos
  if (carrera) filters.carrera = carrera;
  if (campus) filters.campus = campus;
  if (año_ingreso) filters.año_ingreso = parseInt(año_ingreso);
  if (verificado !== undefined) filters.verificado = verificado === 'true';

  // Configurar paginación
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Configurar ordenamiento
  const sortOrder = order === 'desc' ? -1 : 1;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder;

  try {
    // Ejecutar búsqueda con conteo total
    const [users, totalUsers] = await Promise.all([
      User.find(filters)
        .select('-password -verification_token -reset_password_token -login_attempts')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filters)
    ]);

    // Aplicar configuraciones de privacidad
    const sanitizedUsers = users.map(user => {
      const sanitized = { ...user };
      
      // Respetar configuraciones de privacidad
      if (!sanitized.privacy_settings?.show_email) {
        delete sanitized.email;
      }
      if (!sanitized.privacy_settings?.show_career) {
        delete sanitized.carrera;
      }
      if (!sanitized.privacy_settings?.show_campus) {
        delete sanitized.campus;
      }
      
      // Ocultar información sensible
      delete sanitized.privacy_settings;
      delete sanitized.account_locked;
      delete sanitized.lock_until;
      
      return sanitized;
    });

    const totalPages = Math.ceil(totalUsers / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json(createResponse(true, 'Usuarios encontrados', {
      users: sanitizedUsers,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalUsers,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      },
      filters: {
        search,
        carrera,
        campus,
        año_ingreso,
        verificado
      }
    }));

  } catch (error) {
    console.error('Error en búsqueda de usuarios:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Obtener perfil del usuario actual
// @route   GET /api/users/profile
// @access  Protected
const getUserProfile = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -verification_token -reset_password_token')
      .lean();

    if (!user) {
      return res.status(404).json(createResponse(false, 'Usuario no encontrado'));
    }

    // Agregar información adicional
    const userWithStats = {
      ...user,
      stats: {
        // Estas estadísticas se pueden implementar más adelante
        totalPosts: 0,
        totalChats: 0,
        joinedDate: user.fecha_registro
      }
    };

    res.json(createResponse(true, 'Perfil obtenido exitosamente', { user: userWithStats }));

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Actualizar perfil del usuario
// @route   PUT /api/users/profile
// @access  Protected
const updateUserProfile = asyncHandler(async (req, res) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createResponse(false, 'Error de validación', null, {
      errors: errors.array()
    }));
  }

  try {
    const userId = req.user.id;
    const updates = req.body;

    // Campos que se pueden actualizar
    const allowedUpdates = [
      'name',
      'biografia',
      'foto_perfil',
      'privacy_settings'
    ];

    // Filtrar solo campos permitidos
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Validaciones específicas
    if (filteredUpdates.foto_perfil) {
      const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
      if (!urlPattern.test(filteredUpdates.foto_perfil) && !filteredUpdates.foto_perfil.includes('ui-avatars.com')) {
        return res.status(400).json(createResponse(false, 'URL de imagen inválida'));
      }
    }

    if (filteredUpdates.biografia && filteredUpdates.biografia.length > 500) {
      return res.status(400).json(createResponse(false, 'La biografía no puede exceder 500 caracteres'));
    }

    // Actualizar usuario
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      filteredUpdates,
      { 
        new: true, 
        runValidators: true,
        select: '-password -verification_token -reset_password_token'
      }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json(createResponse(false, 'Usuario no encontrado'));
    }

    res.json(createResponse(true, 'Perfil actualizado exitosamente', { user: updatedUser }));

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json(createResponse(false, 'Error de validación', null, {
        errors: validationErrors
      }));
    }

    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Cambiar contraseña
// @route   PUT /api/users/password
// @access  Protected
const changePassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createResponse(false, 'Error de validación', null, {
      errors: errors.array()
    }));
  }

  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Obtener usuario con contraseña
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json(createResponse(false, 'Usuario no encontrado'));
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.matchPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json(createResponse(false, 'La contraseña actual es incorrecta'));
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    // Actualizar fecha de último login
    user.last_login = new Date();
    await user.save();

    res.json(createResponse(true, 'Contraseña cambiada exitosamente'));

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Obtener perfil de otro usuario
// @route   GET /api/users/:id
// @access  Protected
const getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password -verification_token -reset_password_token -login_attempts -account_locked -lock_until')
      .lean();

    if (!user || !user.isActive) {
      return res.status(404).json(createResponse(false, 'Usuario no encontrado'));
    }

    // Aplicar configuraciones de privacidad
    const sanitizedUser = { ...user };
    
    if (!user.privacy_settings?.show_email) {
      delete sanitizedUser.email;
    }
    if (!user.privacy_settings?.show_career) {
      delete sanitizedUser.carrera;
    }
    if (!user.privacy_settings?.show_campus) {
      delete sanitizedUser.campus;
    }
    
    delete sanitizedUser.privacy_settings;

    // Agregar estadísticas básicas
    const userWithStats = {
      ...sanitizedUser,
      stats: {
        joinedDate: user.fecha_registro,
        // Estas estadísticas se pueden implementar más adelante
        totalPosts: 0,
        canMessage: user.privacy_settings?.allow_messages !== false
      }
    };

    res.json(createResponse(true, 'Usuario encontrado', { user: userWithStats }));

  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Obtener usuarios sugeridos
// @route   GET /api/users/suggestions
// @access  Protected
const getSuggestedUsers = asyncHandler(async (req, res) => {
  try {
    const currentUser = req.user;
    const { limit = 10 } = req.query;

    const limitNum = Math.min(20, Math.max(1, parseInt(limit)));

    // Buscar usuarios de la misma carrera y campus
    const suggestedUsers = await User.find({
      _id: { $ne: currentUser.id },
      isActive: true,
      verificado: true,
      $or: [
        { carrera: currentUser.carrera, campus: currentUser.campus },
        { carrera: currentUser.carrera },
        { campus: currentUser.campus }
      ]
    })
    .select('name foto_perfil carrera campus año_ingreso biografia privacy_settings')
    .limit(limitNum)
    .lean();

    // Aplicar configuraciones de privacidad y sanitizar
    const sanitizedUsers = suggestedUsers.map(user => {
      const sanitized = { ...user };
      
      if (!user.privacy_settings?.show_career) {
        delete sanitized.carrera;
      }
      if (!user.privacy_settings?.show_campus) {
        delete sanitized.campus;
      }
      
      delete sanitized.privacy_settings;
      return sanitized;
    });

    res.json(createResponse(true, 'Usuarios sugeridos obtenidos', {
      users: sanitizedUsers,
      count: sanitizedUsers.length
    }));

  } catch (error) {
    console.error('Error obteniendo usuarios sugeridos:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

module.exports = {
  searchUsers,
  getUserProfile,
  updateUserProfile,
  changePassword,
  getUserById,
  getSuggestedUsers
};