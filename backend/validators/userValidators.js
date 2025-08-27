const { body, validationResult } = require('express-validator');

const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
    
  body('email')
    .isEmail()
    .withMessage('Ingresa un email válido')
    .normalizeEmail(),
    
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('La contraseña debe tener entre 6 y 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una minúscula, una mayúscula y un número'),
    
  body('career')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La carrera debe tener entre 2 y 100 caracteres')
    .isIn([
      'Ingeniería Civil',
      'Ingeniería Industrial', 
      'Ingeniería en Sistemas',
      'Arquitectura',
      'Medicina',
      'Derecho',
      'Psicología',
      'Administración',
      'Contador Público'
    ])
    .withMessage('Carrera no válida'),
    
  body('year')
    .isInt({ min: 1, max: 6 })
    .withMessage('El año debe estar entre 1 y 6')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Ingresa un email válido')
    .normalizeEmail(),
    
  body('password')
    .isLength({ min: 1 })
    .withMessage('La contraseña es requerida')
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
    
  body('career')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La carrera debe tener entre 2 y 100 caracteres'),
    
  body('year')
    .optional()
    .isInt({ min: 1, max: 6 })
    .withMessage('El año debe estar entre 1 y 6')
];

const changePasswordValidation = [
  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('La contraseña actual es requerida'),
    
  body('newPassword')
    .isLength({ min: 6, max: 128 })
    .withMessage('La nueva contraseña debe tener entre 6 y 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La nueva contraseña debe contener al menos una minúscula, una mayúscula y un número'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    })
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: errorMessages
    });
  }
  
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  handleValidationErrors
};