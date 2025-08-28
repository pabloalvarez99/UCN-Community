const express = require('express');
const { register, login, getMe, logout } = require('../controllers/authController');
const { 
  protect, 
  requireVerifiedAccount,
  optionalAuth 
} = require('../middleware/auth');
const {
  validateUCNEmail,
  checkEmailBlacklist,
  checkDomainStatus,
  logEmailValidation
} = require('../middleware/validateEmail');
const {
  registerValidation,
  loginValidation,
  handleValidationErrors,
  sanitizeInput,
  validatePayloadSize
} = require('../validators/authValidators');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting específico para autenticación - más restrictivo
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos cada 15 minutos por IP
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    retryAfter: 15 * 60, // segundos
    type: 'RATE_LIMIT_AUTH'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    console.log(`[RATE_LIMIT] ${new Date().toISOString()} - IP: ${clientIP} - Path: ${req.originalUrl} - Límite excedido`);
    
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de autenticación desde esta dirección IP',
      error: {
        type: 'RATE_LIMIT_EXCEEDED',
        windowMs: 15 * 60 * 1000,
        maxAttempts: 5,
        retryAfter: '15 minutos',
        clientIP: clientIP
      }
    });
  }
});

// Rate limiting para registro - aún más restrictivo
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por hora por IP
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Intenta de nuevo en 1 hora.',
    retryAfter: 60 * 60,
    type: 'RATE_LIMIT_REGISTER'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    console.log(`[RATE_LIMIT_REGISTER] ${new Date().toISOString()} - IP: ${clientIP} - Límite de registro excedido`);
    
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de registro desde esta dirección IP',
      error: {
        type: 'REGISTER_RATE_LIMIT_EXCEEDED',
        windowMs: 60 * 60 * 1000,
        maxAttempts: 3,
        retryAfter: '1 hora',
        clientIP: clientIP,
        suggestion: 'Si ya tienes una cuenta, intenta iniciar sesión'
      }
    });
  }
});

// Rate limiting para obtener perfil - más permisivo
const profileRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requests por minuto
  message: {
    success: false,
    message: 'Demasiadas consultas de perfil. Intenta de nuevo en un minuto.',
    type: 'RATE_LIMIT_PROFILE'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   POST /api/auth/register
// @desc    Registrar un nuevo usuario con email UCN
// @access  Public
router.post('/register',
  // Rate limiting
  registerRateLimit,
  
  // Validaciones de payload
  validatePayloadSize,
  sanitizeInput,
  
  // Logging de intentos
  logEmailValidation,
  
  // Validaciones de entrada
  registerValidation,
  handleValidationErrors,
  
  // Validaciones de email UCN
  validateUCNEmail,
  checkEmailBlacklist,
  checkDomainStatus,
  
  // Controlador
  register
);

// @route   POST /api/auth/login
// @desc    Iniciar sesión con email UCN
// @access  Public
router.post('/login',
  // Rate limiting
  authRateLimit,
  
  // Validaciones de payload
  validatePayloadSize,
  sanitizeInput,
  
  // Logging de intentos
  logEmailValidation,
  
  // Validaciones de entrada
  loginValidation,
  handleValidationErrors,
  
  // Validaciones de email UCN
  validateUCNEmail,
  checkEmailBlacklist,
  
  // Controlador
  login
);

// @route   GET /api/auth/me
// @desc    Obtener información del usuario actual
// @access  Protected
router.get('/me',
  profileRateLimit,
  protect,
  getMe
);

// @route   POST /api/auth/logout
// @desc    Cerrar sesión (lado servidor)
// @access  Protected
router.post('/logout',
  protect,
  logout
);

// @route   GET /api/auth/verify
// @desc    Verificar si un token es válido (útil para el frontend)
// @access  Protected
router.get('/verify',
  optionalAuth,
  (req, res) => {
    if (req.user) {
      res.json({
        success: true,
        message: 'Token válido',
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          verified: req.user.verificado
        },
        tokenInfo: {
          issued: req.session?.tokenIssued,
          expires: req.session?.tokenExpires
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Token inválido o expirado',
        authenticated: false
      });
    }
  }
);

// @route   GET /api/auth/status
// @desc    Verificar estado del sistema de autenticación
// @access  Public
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Sistema de autenticación activo',
    data: {
      authSystem: 'active',
      version: '2.0.0',
      emailDomains: ['@alumnos.ucn.cl', '@ucn.cl'],
      security: {
        rateLimiting: true,
        emailValidation: true,
        passwordHashing: 'bcrypt',
        jwtTokens: true,
        accountLocking: true
      },
      features: {
        registration: true,
        login: true,
        passwordReset: false, // Para implementar
        emailVerification: false, // Para implementar
        twoFactor: false // Para futuro
      }
    }
  });
});

module.exports = router;