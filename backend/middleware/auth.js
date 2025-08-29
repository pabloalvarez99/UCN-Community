const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createResponse, logAction } = require('../utils/helpers');

/**
 * Middleware principal de protección de rutas
 * Verifica y valida JWT tokens con múltiples capas de seguridad
 */
const protect = async (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const requestPath = req.originalUrl;
  
  try {
    let token = null;

    // Extraer token de diferentes ubicaciones
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
      // Permitir token en query string para casos específicos (como websockets)
      token = req.query.token;
    } else if (req.cookies && req.cookies.authToken) {
      // Soporte para cookies (opcional)
      token = req.cookies.authToken;
    }

    // Verificar que hay un token
    if (!token) {
      logAction('AUTH_NO_TOKEN', 'anonymous', `IP: ${clientIP} - Path: ${requestPath}`);
      return res.status(401).json(createResponse(
        false,
        'Acceso denegado. Token de autenticación requerido',
        null,
        {
          authRequired: true,
          loginUrl: '/api/auth/login',
          tokenLocation: 'Authorization header as Bearer token'
        }
      ));
    }

    // Verificar formato del token
    if (token.split('.').length !== 3) {
      logAction('AUTH_MALFORMED_TOKEN', 'anonymous', `IP: ${clientIP} - Token malformado`);
      return res.status(401).json(createResponse(
        false,
        'Token de autenticación malformado'
      ));
    }

    let decoded;
    try {
      // Verificar y decodificar el token
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Manejo específico de errores de JWT
      let errorMessage = 'Token de autenticación inválido';
      let errorCode = 'INVALID_TOKEN';

      if (jwtError.name === 'TokenExpiredError') {
        errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente';
        errorCode = 'TOKEN_EXPIRED';
      } else if (jwtError.name === 'JsonWebTokenError') {
        errorMessage = 'Token de autenticación inválido';
        errorCode = 'INVALID_TOKEN';
      } else if (jwtError.name === 'NotBeforeError') {
        errorMessage = 'Token no válido aún';
        errorCode = 'TOKEN_NOT_ACTIVE';
      }

      logAction(`AUTH_${errorCode}`, 'anonymous', `IP: ${clientIP} - ${jwtError.message}`);
      
      return res.status(401).json(createResponse(
        false,
        errorMessage,
        null,
        {
          expired: jwtError.name === 'TokenExpiredError',
          refreshTokenUrl: '/api/auth/refresh',
          loginUrl: '/api/auth/login'
        }
      ));
    }

    // Verificar que el token tiene la estructura correcta
    if (!decoded.id) {
      logAction('AUTH_INVALID_TOKEN_STRUCTURE', 'anonymous', `IP: ${clientIP} - Token sin ID de usuario`);
      return res.status(401).json(createResponse(
        false,
        'Token de autenticación inválido'
      ));
    }

    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.id)
      .select('-password -verification_token -reset_password_token')
      .lean();

    if (!user) {
      logAction('AUTH_USER_NOT_FOUND', decoded.id, `IP: ${clientIP} - Usuario en token no existe`);
      return res.status(401).json(createResponse(
        false,
        'Usuario no encontrado. Por favor, inicia sesión nuevamente',
        null,
        {
          userNotFound: true,
          loginUrl: '/api/auth/login'
        }
      ));
    }

    // Verificar que la cuenta esté activa
    if (!user.activo) {
      logAction('AUTH_INACTIVE_ACCOUNT', user.email, `IP: ${clientIP} - Intento de acceso con cuenta inactiva`);
      return res.status(403).json(createResponse(
        false,
        'Tu cuenta está desactivada. Contacta al administrador',
        null,
        {
          accountStatus: 'inactive',
          contactSupport: true
        }
      ));
    }

    // Verificar si la cuenta está bloqueada
    if (user.account_locked && user.lock_until && new Date() < new Date(user.lock_until)) {
      const lockTimeRemaining = Math.ceil((new Date(user.lock_until) - new Date()) / (1000 * 60));
      logAction('AUTH_LOCKED_ACCOUNT', user.email, `IP: ${clientIP} - Intento de acceso con cuenta bloqueada`);
      
      return res.status(423).json(createResponse(
        false,
        'Tu cuenta está temporalmente bloqueada',
        null,
        {
          accountStatus: 'locked',
          timeRemaining: `${lockTimeRemaining} minutos`,
          unlockTime: user.lock_until
        }
      ));
    }

    // Agregar información del usuario al request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      verificado: user.verificado,
      carrera: user.carrera,
      campus: user.campus,
      activo: user.activo
    };

    // Agregar información de la sesión
    req.session = {
      tokenIssued: new Date(decoded.iat * 1000),
      tokenExpires: new Date(decoded.exp * 1000),
      clientIP: clientIP,
      userAgent: userAgent
    };

    next();

  } catch (error) {
    console.error('Error en middleware de protección:', error);
    logAction('AUTH_MIDDLEWARE_ERROR', 'unknown', `IP: ${clientIP} - Error: ${error.message}`);
    
    return res.status(500).json(createResponse(
      false,
      'Error interno del servidor durante la autenticación',
      null,
      process.env.NODE_ENV === 'development' ? { error: error.message } : {}
    ));
  }
};

/**
 * Middleware para requerir roles específicos
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createResponse(
        false,
        'Autenticación requerida'
      ));
    }

    if (!roles.includes(req.user.role)) {
      logAction('AUTH_INSUFFICIENT_PERMISSIONS', req.user.email, `Intento de acceso a ${req.originalUrl} - Rol: ${req.user.role}`);
      
      return res.status(403).json(createResponse(
        false,
        'No tienes permisos suficientes para acceder a este recurso',
        null,
        {
          requiredRoles: roles,
          userRole: req.user.role
        }
      ));
    }

    next();
  };
};

/**
 * Middleware para verificar que la cuenta esté verificada
 */
const requireVerifiedAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(createResponse(
      false,
      'Autenticación requerida'
    ));
  }

  if (!req.user.verificado) {
    logAction('AUTH_UNVERIFIED_ACCOUNT', req.user.email, `Intento de acceso sin verificar cuenta`);
    
    return res.status(403).json(createResponse(
      false,
      'Tu cuenta debe estar verificada para acceder a este recurso',
      null,
      {
        requiresVerification: true,
        verificationUrl: '/api/auth/verify-email',
        resendVerificationUrl: '/api/auth/resend-verification'
      }
    ));
  }

  next();
};

/**
 * Middleware opcional - no falla si no hay token, pero agrega info del usuario si está presente
 */
const optionalAuth = async (req, res, next) => {
  const originalProtect = protect;
  
  // Crear una versión modificada que no falla si no hay token
  const modifiedProtect = async (req, res, next) => {
    if (!req.headers.authorization && !req.query.token && !req.cookies?.authToken) {
      // No hay token, continuar sin usuario
      req.user = null;
      return next();
    }
    
    // Hay token, usar protección normal pero capturar errores
    try {
      await originalProtect(req, res, next);
    } catch (error) {
      // Si hay error en el token, continuar sin usuario
      req.user = null;
      next();
    }
  };

  return modifiedProtect(req, res, next);
};

/**
 * Función para generar tokens JWT
 */
const generateToken = (id, expiresIn = null) => {
  const payload = {
    id: id.toString(),
    iat: Math.floor(Date.now() / 1000),
    type: 'access'
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresIn || process.env.JWT_EXPIRE || '7d',
  });
};

/**
 * Función para generar refresh token
 */
const generateRefreshToken = (id, expiresIn = null) => {
  const payload = {
    id: id.toString(),
    iat: Math.floor(Date.now() / 1000),
    type: 'refresh'
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: expiresIn || process.env.JWT_REFRESH_EXPIRE || '30d',
  });
};

/**
 * Función para verificar refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  protect,
  requireRole,
  requireVerifiedAccount,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};