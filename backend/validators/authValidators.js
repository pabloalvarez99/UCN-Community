const { body, validationResult } = require('express-validator');
const { isValidUCNEmail } = require('../middleware/validateEmail');

// Carreras válidas en UCN
const VALID_CARRERAS = [
  'Ingeniería Civil',
  'Ingeniería Industrial',
  'Ingeniería en Sistemas',
  'Ingeniería Comercial',
  'Arquitectura',
  'Medicina',
  'Enfermería',
  'Kinesiología',
  'Fonoaudiología',
  'Derecho',
  'Psicología',
  'Trabajo Social',
  'Administración Pública',
  'Contador Público',
  'Periodismo',
  'Publicidad',
  'Diseño Gráfico'
];

// Campus válidos
const VALID_CAMPUS = ['Antofagasta', 'Coquimbo', 'Santiago'];

/**
 * Validaciones para registro de usuario
 */
const registerValidation = [
  // Validación de nombre
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios')
    .custom((name) => {
      // Verificar que no sea solo espacios
      if (!name.trim()) {
        throw new Error('El nombre no puede estar vacío');
      }
      
      // Verificar que tenga al menos nombre y apellido
      const parts = name.trim().split(/\s+/);
      if (parts.length < 2) {
        throw new Error('Debes ingresar al menos nombre y apellido');
      }
      
      // Verificar longitud de cada parte
      parts.forEach(part => {
        if (part.length < 2) {
          throw new Error('Cada parte del nombre debe tener al menos 2 caracteres');
        }
      });
      
      return true;
    }),

  // Validación de email (será reforzada por el middleware de email)
  body('email')
    .isEmail()
    .withMessage('Ingresa un email válido')
    .normalizeEmail({ gmail_remove_dots: false })
    .custom((email) => {
      if (!isValidUCNEmail(email)) {
        throw new Error('Debe usar un email institucional UCN (@alumnos.ucn.cl o @ucn.cl)');
      }
      return true;
    }),

  // Validación de contraseña robusta
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('La contraseña debe tener entre 8 y 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial (@$!%*?&)')
    .custom((password, { req }) => {
      // Verificar que no contenga información personal
      const name = req.body.name?.toLowerCase() || '';
      const email = req.body.email?.split('@')[0]?.toLowerCase() || '';
      const passwordLower = password.toLowerCase();
      
      if (name && passwordLower.includes(name.split(' ')[0])) {
        throw new Error('La contraseña no puede contener tu nombre');
      }
      
      if (email && passwordLower.includes(email)) {
        throw new Error('La contraseña no puede contener parte de tu email');
      }
      
      // Verificar que no sea una contraseña común
      const commonPasswords = [
        'password', '12345678', 'qwerty123', 'abc123456', 
        'password123', 'admin123', 'user1234', 'welcome123'
      ];
      
      if (commonPasswords.includes(passwordLower)) {
        throw new Error('La contraseña es muy común, elige una más segura');
      }
      
      return true;
    }),

  // Validación de carrera
  body('carrera')
    .trim()
    .isLength({ min: 1 })
    .withMessage('La carrera es requerida')
    .isIn(VALID_CARRERAS)
    .withMessage('Carrera no válida. Selecciona una carrera de la lista'),

  // Validación de año de ingreso
  body('año_ingreso')
    .isInt()
    .withMessage('El año de ingreso debe ser un número entero')
    .custom((año) => {
      const currentYear = new Date().getFullYear();
      const minYear = 2010; // UCN fundada en fechas anteriores, pero limitamos registros
      
      if (año < minYear) {
        throw new Error(`El año de ingreso no puede ser anterior a ${minYear}`);
      }
      
      if (año > currentYear + 1) {
        throw new Error('El año de ingreso no puede ser futuro');
      }
      
      return true;
    }),

  // Validación de campus
  body('campus')
    .trim()
    .isLength({ min: 1 })
    .withMessage('El campus es requerido')
    .isIn(VALID_CAMPUS)
    .withMessage('Campus no válido. Debe ser: Antofagasta, Coquimbo o Santiago'),

  // Validación de biografía (opcional)
  body('biografia')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('La biografía no puede exceder 500 caracteres')
    .custom((biografia) => {
      if (biografia) {
        // Verificar que no contenga contenido inapropiado (básico)
        const inappropriateWords = ['spam', 'hack', 'admin', 'test'];
        const bioLower = biografia.toLowerCase();
        
        for (const word of inappropriateWords) {
          if (bioLower.includes(word)) {
            throw new Error('La biografía contiene contenido no permitido');
          }
        }
      }
      return true;
    })
];

/**
 * Validaciones para login de usuario
 */
const loginValidation = [
  // Validación de email
  body('email')
    .isEmail()
    .withMessage('Ingresa un email válido')
    .normalizeEmail({ gmail_remove_dots: false })
    .custom((email) => {
      if (!isValidUCNEmail(email)) {
        throw new Error('Debe usar un email institucional UCN');
      }
      return true;
    }),

  // Validación de contraseña
  body('password')
    .isLength({ min: 1, max: 128 })
    .withMessage('La contraseña es requerida')
    .custom((password) => {
      if (password.length > 128) {
        throw new Error('Contraseña demasiado larga');
      }
      return true;
    }),

  // Validación de remember_me (opcional)
  body('remember_me')
    .optional()
    .isBoolean()
    .withMessage('El campo remember_me debe ser true o false')
];

/**
 * Validaciones para cambio de contraseña
 */
const changePasswordValidation = [
  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('La contraseña actual es requerida'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('La nueva contraseña debe tener entre 8 y 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La nueva contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),

  // Verificar que la nueva contraseña sea diferente a la actual
  body('newPassword')
    .custom((newPassword, { req }) => {
      if (newPassword === req.body.currentPassword) {
        throw new Error('La nueva contraseña debe ser diferente a la actual');
      }
      return true;
    })
];

/**
 * Validaciones para recuperación de contraseña
 */
const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Ingresa un email válido')
    .normalizeEmail({ gmail_remove_dots: false })
    .custom((email) => {
      if (!isValidUCNEmail(email)) {
        throw new Error('Debe usar un email institucional UCN');
      }
      return true;
    })
];

/**
 * Validaciones para reset de contraseña
 */
const resetPasswordValidation = [
  body('token')
    .isLength({ min: 1 })
    .withMessage('Token de reset es requerido')
    .isAlphanumeric()
    .withMessage('Token de reset inválido'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('La contraseña debe tener entre 8 y 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    })
];

/**
 * Validación para verificación de email
 */
const verifyEmailValidation = [
  body('token')
    .isLength({ min: 1 })
    .withMessage('Token de verificación es requerido')
    .isAlphanumeric()
    .withMessage('Token de verificación inválido')
];

/**
 * Middleware para manejar errores de validación
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    // Agrupar errores por campo
    const errorsByField = {};
    formattedErrors.forEach(error => {
      if (!errorsByField[error.field]) {
        errorsByField[error.field] = [];
      }
      errorsByField[error.field].push(error.message);
    });

    return res.status(400).json({
      success: false,
      message: 'Error de validación en los datos proporcionados',
      errors: formattedErrors,
      errorsByField: errorsByField,
      totalErrors: formattedErrors.length
    });
  }
  
  next();
};

/**
 * Validador de formato de datos de entrada
 */
const sanitizeInput = (req, res, next) => {
  // Limpiar espacios en blanco de strings
  Object.keys(req.body).forEach(key => {
    if (typeof req.body[key] === 'string') {
      req.body[key] = req.body[key].trim();
    }
  });
  
  // Remover campos vacíos opcionales
  Object.keys(req.body).forEach(key => {
    if (req.body[key] === '' || req.body[key] === null || req.body[key] === undefined) {
      delete req.body[key];
    }
  });
  
  next();
};

/**
 * Validador de tamaño de payload
 */
const validatePayloadSize = (req, res, next) => {
  const maxSize = 10 * 1024; // 10KB para requests de auth
  const payloadSize = JSON.stringify(req.body).length;
  
  if (payloadSize > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Datos de entrada demasiado grandes',
      maxSize: '10KB',
      actualSize: `${Math.round(payloadSize / 1024)}KB`
    });
  }
  
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  verifyEmailValidation,
  handleValidationErrors,
  sanitizeInput,
  validatePayloadSize,
  VALID_CARRERAS,
  VALID_CAMPUS
};