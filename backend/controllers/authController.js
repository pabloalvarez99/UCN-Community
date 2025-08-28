const User = require('../models/User');
const { generateTokens } = require('../utils/helpers');
const { createResponse, logAction } = require('../utils/helpers');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const register = async (req, res) => {
  try {
    const { name, email, password, carrera, año_ingreso, campus, biografia } = req.body;
    
    // Usar email validado del middleware
    const validatedEmail = req.validatedEmail?.email || email.toLowerCase().trim();
    const userType = req.validatedEmail?.userType || 'student';

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ 
      email: validatedEmail 
    }).select('email isActive account_locked');

    if (existingUser) {
      // Si el usuario existe pero está inactivo, permitir reactivación
      if (!existingUser.isActive) {
        logAction('REGISTER_ATTEMPT_INACTIVE_USER', validatedEmail, `Intento de registro con cuenta inactiva`);
        return res.status(409).json(createResponse(
          false,
          'Esta cuenta existe pero está desactivada. Contacta al administrador para reactivarla',
          null,
          { accountStatus: 'inactive', canReactivate: true }
        ));
      }

      // Si el usuario existe y está bloqueado
      if (existingUser.account_locked) {
        logAction('REGISTER_ATTEMPT_LOCKED_USER', validatedEmail, `Intento de registro con cuenta bloqueada`);
        return res.status(423).json(createResponse(
          false,
          'Esta cuenta está temporalmente bloqueada. Intenta más tarde o contacta al administrador',
          null,
          { accountStatus: 'locked' }
        ));
      }

      logAction('REGISTER_ATTEMPT_EXISTING_USER', validatedEmail, `Intento de registro con email existente`);
      return res.status(409).json(createResponse(
        false,
        'Ya existe una cuenta con este email institucional',
        null,
        { 
          accountExists: true,
          loginUrl: '/api/auth/login',
          forgotPasswordUrl: '/api/auth/forgot-password'
        }
      ));
    }

    // Validaciones adicionales de seguridad
    if (password.length < 8) {
      return res.status(400).json(createResponse(
        false,
        'La contraseña debe tener al menos 8 caracteres'
      ));
    }

    // Verificar complejidad de contraseña
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json(createResponse(
        false,
        'La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'
      ));
    }

    // Verificar que la contraseña no contenga el nombre o email
    const nameLower = name.toLowerCase();
    const emailLocal = validatedEmail.split('@')[0].toLowerCase();
    const passwordLower = password.toLowerCase();
    
    if (passwordLower.includes(nameLower) || passwordLower.includes(emailLocal)) {
      return res.status(400).json(createResponse(
        false,
        'La contraseña no puede contener tu nombre o parte de tu email'
      ));
    }

    // Crear usuario con rol basado en dominio
    const role = userType === 'faculty' ? 'professor' : 'student';
    
    const userData = {
      name: name.trim(),
      email: validatedEmail,
      password,
      carrera,
      año_ingreso: parseInt(año_ingreso),
      campus,
      biografia: biografia?.trim() || '',
      role,
      verificado: false, // Requerirá verificación por email
      verification_token: crypto.randomBytes(32).toString('hex'),
      verification_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      last_login: null,
      login_attempts: 0,
      account_locked: false
    };

    const user = await User.create(userData);

    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Log del registro exitoso
    logAction('USER_REGISTERED', validatedEmail, `Usuario registrado exitosamente - Rol: ${role}`);

    // Respuesta sin datos sensibles
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      carrera: user.carrera,
      año_ingreso: user.año_ingreso,
      campus: user.campus,
      foto_perfil: user.foto_perfil,
      role: user.role,
      verificado: user.verificado,
      fecha_registro: user.fecha_registro
    };

    res.status(201).json(createResponse(
      true,
      'Usuario registrado exitosamente. Verifica tu email para activar la cuenta',
      {
        user: userResponse,
        accessToken,
        refreshToken,
        tokenExpiry: process.env.JWT_EXPIRE,
        requiresEmailVerification: !user.verificado
      }
    ));

    // TODO: Enviar email de verificación en segundo plano

  } catch (error) {
    console.error('Error en registro:', error);
    logAction('REGISTER_ERROR', req.body.email, `Error en registro: ${error.message}`);
    
    // Manejo específico de errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));

      return res.status(400).json(createResponse(
        false,
        'Error de validación en los datos proporcionados',
        null,
        { validationErrors }
      ));
    }

    // Error de duplicado (por si falla la verificación previa)
    if (error.code === 11000) {
      return res.status(409).json(createResponse(
        false,
        'Ya existe una cuenta con este email institucional'
      ));
    }

    res.status(500).json(createResponse(
      false,
      'Error interno del servidor durante el registro',
      null,
      process.env.NODE_ENV === 'development' ? { error: error.message } : {}
    ));
  }
};

const login = async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  try {
    const { email, password, remember_me = false } = req.body;

    // Usar email validado del middleware
    const validatedEmail = req.validatedEmail?.email || email.toLowerCase().trim();

    // Validar que se proporcionen credenciales
    if (!validatedEmail || !password) {
      logAction('LOGIN_ATTEMPT_MISSING_CREDENTIALS', validatedEmail || 'unknown', `IP: ${clientIP}`);
      return res.status(400).json(createResponse(
        false,
        'Email y contraseña son requeridos'
      ));
    }

    // Buscar usuario incluyendo campos sensibles para autenticación
    const user = await User.findOne({ email: validatedEmail })
      .select('+password +login_attempts +account_locked +lock_until +verification_token +last_login');

    // Si no existe el usuario, dar respuesta genérica para evitar enumeración
    if (!user) {
      logAction('LOGIN_ATTEMPT_INVALID_EMAIL', validatedEmail, `IP: ${clientIP} - Usuario no existe`);
      
      // Agregar delay artificial para prevenir timing attacks
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      
      return res.status(401).json(createResponse(
        false,
        'Email o contraseña incorrectos',
        null,
        { 
          suggestion: 'Verifica que hayas ingresado correctamente tu email institucional',
          registerUrl: '/api/auth/register'
        }
      ));
    }

    // Verificar si la cuenta está activa
    if (!user.isActive) {
      logAction('LOGIN_ATTEMPT_INACTIVE_ACCOUNT', validatedEmail, `IP: ${clientIP} - Cuenta inactiva`);
      return res.status(403).json(createResponse(
        false,
        'Tu cuenta está desactivada. Contacta al administrador para reactivarla',
        null,
        { 
          accountStatus: 'inactive',
          contactSupport: true
        }
      ));
    }

    // Verificar si la cuenta está bloqueada
    if (user.isAccountLocked()) {
      const lockTimeRemaining = Math.ceil((user.lock_until - Date.now()) / (1000 * 60)); // minutos
      logAction('LOGIN_ATTEMPT_LOCKED_ACCOUNT', validatedEmail, `IP: ${clientIP} - Cuenta bloqueada, ${lockTimeRemaining}min restantes`);
      
      return res.status(423).json(createResponse(
        false,
        `Tu cuenta está temporalmente bloqueada por múltiples intentos fallidos`,
        null,
        {
          accountStatus: 'locked',
          timeRemaining: `${lockTimeRemaining} minutos`,
          unlockTime: user.lock_until,
          reason: 'Demasiados intentos de inicio de sesión fallidos'
        }
      ));
    }

    // Verificar contraseña
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      logAction('LOGIN_ATTEMPT_INVALID_PASSWORD', validatedEmail, `IP: ${clientIP} - Contraseña incorrecta`);
      
      // Incrementar intentos fallidos
      await user.incLoginAttempts();
      
      // Verificar cuántos intentos quedan
      const attemptsRemaining = Math.max(0, 5 - (user.login_attempts + 1));
      
      return res.status(401).json(createResponse(
        false,
        'Email o contraseña incorrectos',
        null,
        {
          attemptsRemaining,
          warningMessage: attemptsRemaining <= 2 
            ? `Quedan ${attemptsRemaining} intentos antes de que tu cuenta se bloquee temporalmente`
            : undefined,
          forgotPasswordUrl: '/api/auth/forgot-password'
        }
      ));
    }

    // Login exitoso - resetear intentos fallidos
    await user.resetLoginAttempts();

    // Actualizar último login
    user.last_login = new Date();
    await user.save();

    // Generar tokens con diferentes duraciones según "remember_me"
    const tokenExpiry = remember_me ? '30d' : process.env.JWT_EXPIRE || '7d';
    const { accessToken, refreshToken } = generateTokens(user._id, tokenExpiry);

    // Log del login exitoso
    logAction('LOGIN_SUCCESS', validatedEmail, `IP: ${clientIP} - UserAgent: ${userAgent} - Remember: ${remember_me}`);

    // Preparar respuesta del usuario sin datos sensibles
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      carrera: user.carrera,
      año_ingreso: user.año_ingreso,
      campus: user.campus,
      foto_perfil: user.foto_perfil,
      role: user.role,
      verificado: user.verificado,
      last_login: user.last_login,
      fecha_registro: user.fecha_registro
    };

    // Verificar si requiere verificación de email
    if (!user.verificado) {
      return res.status(200).json(createResponse(
        true,
        'Inicio de sesión exitoso, pero tu cuenta requiere verificación por email',
        {
          user: userResponse,
          accessToken,
          refreshToken,
          tokenExpiry,
          requiresEmailVerification: true,
          verificationSent: false
        }
      ));
    }

    // Respuesta de login exitoso completo
    res.status(200).json(createResponse(
      true,
      'Inicio de sesión exitoso',
      {
        user: userResponse,
        accessToken,
        refreshToken,
        tokenExpiry,
        sessionInfo: {
          loginTime: new Date(),
          rememberMe: remember_me,
          deviceInfo: {
            ip: clientIP,
            userAgent: userAgent
          }
        }
      }
    ));

  } catch (error) {
    console.error('Error en login:', error);
    logAction('LOGIN_ERROR', req.body.email || 'unknown', `IP: ${clientIP} - Error: ${error.message}`);
    
    res.status(500).json(createResponse(
      false,
      'Error interno del servidor durante el inicio de sesión',
      null,
      process.env.NODE_ENV === 'development' ? { error: error.message } : {}
    ));
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obtener información completa del usuario
    const user = await User.findById(userId)
      .select('-password -verification_token -reset_password_token')
      .lean();

    if (!user) {
      logAction('GET_PROFILE_USER_NOT_FOUND', userId, 'Usuario no encontrado en token válido');
      return res.status(404).json(createResponse(
        false,
        'Usuario no encontrado. Por favor, inicia sesión nuevamente'
      ));
    }

    // Verificar si la cuenta sigue activa
    if (!user.isActive) {
      logAction('GET_PROFILE_INACTIVE_USER', user.email, 'Intento de acceso con cuenta inactiva');
      return res.status(403).json(createResponse(
        false,
        'Tu cuenta está desactivada',
        null,
        {
          accountStatus: 'inactive',
          requiresLogin: true
        }
      ));
    }

    // Calcular estadísticas adicionales si es necesario
    const userProfile = {
      ...user,
      stats: {
        memberSince: user.fecha_registro,
        lastLogin: user.last_login,
        accountAge: user.tiempo_registro, // Virtual del modelo
        currentYear: user.año_actual, // Virtual del modelo
        profileComplete: calculateProfileCompleteness(user)
      },
      security: {
        emailVerified: user.verificado,
        twoFactorEnabled: false, // Para futuro
        lastPasswordChange: null, // Para futuro
        activeSessions: 1 // Para futuro
      },
      preferences: {
        privacy: user.privacy_settings,
        notifications: {
          email: true,
          push: true,
          inApp: true
        }
      }
    };

    // Log del acceso exitoso al perfil
    logAction('GET_PROFILE_SUCCESS', user.email, `Perfil accedido exitosamente`);

    res.status(200).json(createResponse(
      true,
      'Perfil obtenido exitosamente',
      {
        user: userProfile
      }
    ));

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    logAction('GET_PROFILE_ERROR', req.user?.id || 'unknown', `Error: ${error.message}`);
    
    res.status(500).json(createResponse(
      false,
      'Error interno del servidor al obtener el perfil',
      null,
      process.env.NODE_ENV === 'development' ? { error: error.message } : {}
    ));
  }
};

// Función helper para calcular completitud del perfil
const calculateProfileCompleteness = (user) => {
  let completeness = 0;
  const fields = [
    'name',
    'email',
    'carrera',
    'año_ingreso',
    'campus',
    'biografia',
    'foto_perfil'
  ];
  
  fields.forEach(field => {
    if (user[field] && user[field].toString().trim()) {
      completeness += 1;
    }
  });
  
  return {
    percentage: Math.round((completeness / fields.length) * 100),
    missingFields: fields.filter(field => 
      !user[field] || !user[field].toString().trim()
    ),
    isComplete: completeness === fields.length
  };
};

// Función para logout (invalidar token en el lado del cliente)
const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (user) {
      logAction('LOGOUT_SUCCESS', user.email, 'Sesión cerrada exitosamente');
    }

    res.status(200).json(createResponse(
      true,
      'Sesión cerrada exitosamente',
      {
        loggedOut: true,
        redirectTo: '/login'
      }
    ));

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json(createResponse(
      false,
      'Error al cerrar sesión',
      null,
      { loggedOut: true } // Aún así considerar como logout exitoso
    ));
  }
};

module.exports = { register, login, getMe, logout };