const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const router = express.Router();

// Middlewares de validación
const validateUCNEmail = require('../middleware/validateUCNEmail');
const { validateRUT } = require('../middleware/validateRUT');
const { validateCarrera } = require('../middleware/validateCarrera');
const { protect } = require('../middleware/auth');

// Controladores
const {
  register,
  login,
  getProfile,
  verifyEmail,
  resendVerification
} = require('../controllers/authController');

/**
 * Rate limiting para endpoints de autenticación
 */

// Rate limiting para registro - 3 intentos por hora
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo 3 intentos por hora
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Intenta de nuevo en 1 hora.',
    errors: [{ field: 'rate_limit', message: 'Límite de intentos excedido' }]
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de registro. Intenta de nuevo en 1 hora.',
      errors: [{ field: 'rate_limit', message: 'Límite de intentos excedido' }]
    });
  }
});

// Rate limiting para login - 5 intentos por 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos por 15 minutos
  message: {
    success: false,
    message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.',
    errors: [{ field: 'rate_limit', message: 'Límite de intentos excedido' }]
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.',
      errors: [{ field: 'rate_limit', message: 'Límite de intentos excedido' }]
    });
  }
});

// Rate limiting para verificación de email - 10 intentos por hora
const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // Máximo 10 intentos por hora
  message: {
    success: false,
    message: 'Demasiados intentos de verificación. Intenta de nuevo en 1 hora.',
    errors: [{ field: 'rate_limit', message: 'Límite de intentos excedido' }]
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting general para perfil
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // Máximo 30 requests por 15 minutos
  message: {
    success: false,
    message: 'Demasiadas consultas al perfil. Intenta de nuevo más tarde.',
    errors: [{ field: 'rate_limit', message: 'Límite de consultas excedido' }]
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Validadores con express-validator para campos adicionales
 */
const registerValidators = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),

  body('apellidos')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Los apellidos deben tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('Los apellidos solo pueden contener letras y espacios'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),

  body('año_ingreso')
    .optional()
    .isInt({ min: 2018, max: 2025 })
    .withMessage('El año de ingreso debe estar entre 2018 y 2025'),


  body('telefono')
    .optional()
    .matches(/^\+?56?[0-9]{8,9}$/)
    .withMessage('Formato de teléfono inválido (debe ser formato chileno)'),

  body('biografia')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La biografía no puede exceder 500 caracteres')
];

const loginValidators = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Formato de email inválido'),

  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria'),

  body('remember_me')
    .optional()
    .isBoolean()
    .withMessage('remember_me debe ser un valor booleano')
];

const verifyEmailValidators = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Formato de email inválido'),

  body('code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('El código debe ser de 6 dígitos numéricos')
];

/**
 * Middleware para manejar errores de validación
 */
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param || error.path,
      message: error.msg
    }));

    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: formattedErrors
    });
  }
  
  next();
};

/**
 * RUTAS DE AUTENTICACIÓN
 */

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario con validaciones UCN
 * @access  Public
 * @validation validateUCNEmail, validateRUT, validateCarrera
 */
router.post(
  '/register',
  registerLimiter,
  registerValidators,
  handleValidationErrors,
  validateUCNEmail,
  validateRUT,
  validateCarrera,
  register
);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión con email y password
 * @access  Public
 */
router.post(
  '/login',
  loginLimiter,
  loginValidators,
  handleValidationErrors,
  login
);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtener perfil del usuario autenticado
 * @access  Private (requiere JWT)
 */
router.get(
  '/profile',
  profileLimiter,
  protect,
  getProfile
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verificar email con código de 6 dígitos
 * @access  Public
 */
router.post(
  '/verify-email',
  verificationLimiter,
  verifyEmailValidators,
  handleValidationErrors,
  verifyEmail
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Reenviar código de verificación de email
 * @access  Public
 */
router.post(
  '/resend-verification',
  verificationLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Formato de email inválido')
  ],
  handleValidationErrors,
  resendVerification
);

/**
 * @route   GET /api/auth/carreras
 * @desc    Obtener lista de carreras disponibles
 * @access  Public
 */
router.get('/carreras', (req, res) => {
  const { getCarrerasDisponibles, getCarrerasPorFacultad } = require('../middleware/validateCarrera');
  
  res.status(200).json({
    success: true,
    message: 'Carreras obtenidas exitosamente',
    data: {
      carreras: getCarrerasDisponibles(),
      carrerasPorFacultad: getCarrerasPorFacultad()
    }
  });
});

/**
 * @route   POST /api/auth/validate-rut
 * @desc    Validar RUT chileno (helper endpoint)
 * @access  Public
 */
router.post('/validate-rut', [
  body('rut')
    .notEmpty()
    .withMessage('RUT es obligatorio')
], handleValidationErrors, (req, res) => {
  const { validateRutFormat } = require('../middleware/validateRUT');
  const { rut } = req.body;

  const validation = validateRutFormat(rut);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: validation.message,
      errors: [{ field: 'rut', message: validation.message }]
    });
  }

  res.status(200).json({
    success: true,
    message: 'RUT válido',
    data: {
      rutLimpio: validation.cleanRut,
      rutFormateado: validation.formattedRut,
      digitoVerificador: validation.dv
    }
  });
});

/**
 * @route   POST /api/auth/validate-email
 * @desc    Validar email UCN (helper endpoint)
 * @access  Public  
 */
router.post('/validate-email', [
  body('email')
    .isEmail()
    .withMessage('Formato de email inválido')
], handleValidationErrors, (req, res) => {
  const { email } = req.body;
  
  // Validar dominios UCN
  const ucnDomains = ['@alumnos.ucn.cl', '@ucn.cl'];
  const isValidUCNEmail = ucnDomains.some(domain => 
    email.toLowerCase().endsWith(domain.toLowerCase())
  );

  if (!isValidUCNEmail) {
    return res.status(400).json({
      success: false,
      message: 'Solo se permiten emails institucionales UCN (@alumnos.ucn.cl o @ucn.cl)',
      errors: [{ field: 'email', message: 'Email debe ser institucional' }]
    });
  }

  const userType = email.toLowerCase().endsWith('@alumnos.ucn.cl') ? 'student' : 'professor';

  res.status(200).json({
    success: true,
    message: 'Email UCN válido',
    data: {
      email: email.toLowerCase(),
      userType: userType,
      isStudent: userType === 'student',
      isProfessor: userType === 'professor'
    }
  });
});

// Middleware de logging comentado temporalmente para debugging
// router.use((req, res, next) => {
//   console.log(`[AUTH] ${req.method} ${req.originalUrl} - IP: ${req.ip} - ${new Date().toISOString()}`);
//   next();
// });

module.exports = router;