const express = require('express');
const {
  getUserChats,
  createChat,
  getChatMessages,
  sendMessage
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting para crear chats
const createChatLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // máximo 5 chats creados por minuto
  message: {
    success: false,
    message: 'Demasiados chats creados. Intenta de nuevo en un minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para enviar mensajes
const sendMessageLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // máximo 60 mensajes por minuto
  message: {
    success: false,
    message: 'Demasiados mensajes enviados. Intenta de nuevo en un minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validaciones para crear chat
const createChatValidation = [
  body('tipo')
    .isIn(['individual', 'grupal', 'canal', 'estudio'])
    .withMessage('Tipo de chat no válido'),
    
  body('nombre_grupo')
    .if(body('tipo').not().equals('individual'))
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre del grupo debe tener entre 2 y 100 caracteres')
    .trim(),
    
  body('descripcion')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres')
    .trim(),
    
  body('participantes')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos un participante')
    .custom((participantes, { req }) => {
      if (req.body.tipo === 'individual' && participantes.length !== 1) {
        throw new Error('Un chat individual debe tener exactamente 1 participante adicional');
      }
      if (req.body.tipo === 'grupal' && participantes.length > 99) {
        throw new Error('Un chat grupal no puede tener más de 99 participantes adicionales');
      }
      return true;
    }),
    
  body('participantes.*')
    .isMongoId()
    .withMessage('ID de participante no válido'),
    
  body('materia')
    .if(body('tipo').equals('estudio'))
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre de la materia debe tener entre 2 y 100 caracteres')
    .trim(),
    
  body('carrera')
    .optional()
    .isIn([
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
    ])
    .withMessage('Carrera no válida'),
    
  body('campus')
    .optional()
    .isIn(['Antofagasta', 'Coquimbo', 'Santiago'])
    .withMessage('Campus no válido'),
    
  body('año_academico')
    .if(body('tipo').equals('estudio'))
    .optional()
    .isInt({ min: 1, max: 6 })
    .withMessage('El año académico debe estar entre 1 y 6')
];

// Validaciones para enviar mensaje
const sendMessageValidation = [
  body('contenido')
    .if(body('tipo_mensaje').not().isIn(['archivo', 'ubicacion']))
    .isLength({ min: 1, max: 10000 })
    .withMessage('El contenido debe tener entre 1 y 10000 caracteres')
    .trim(),
    
  body('tipo_mensaje')
    .optional()
    .isIn(['texto', 'imagen', 'archivo', 'audio', 'video', 'ubicacion'])
    .withMessage('Tipo de mensaje no válido'),
    
  body('respuesta_a')
    .optional()
    .isMongoId()
    .withMessage('ID de mensaje a responder no válido'),
    
  // Validaciones para archivo
  body('archivo.nombre_original')
    .if(body('tipo_mensaje').equals('archivo'))
    .isLength({ min: 1, max: 255 })
    .withMessage('El nombre del archivo debe tener entre 1 y 255 caracteres'),
    
  body('archivo.url')
    .if(body('tipo_mensaje').equals('archivo'))
    .isURL()
    .withMessage('URL del archivo no válida'),
    
  body('archivo.tipo_mime')
    .if(body('tipo_mensaje').equals('archivo'))
    .isLength({ min: 1, max: 100 })
    .withMessage('Tipo MIME requerido'),
    
  body('archivo.tamaño')
    .if(body('tipo_mensaje').equals('archivo'))
    .isInt({ min: 1, max: 52428800 }) // 50MB
    .withMessage('El tamaño del archivo debe estar entre 1 byte y 50MB'),
    
  // Validaciones para ubicación
  body('ubicacion.latitud')
    .if(body('tipo_mensaje').equals('ubicacion'))
    .isFloat({ min: -90, max: 90 })
    .withMessage('La latitud debe estar entre -90 y 90'),
    
  body('ubicacion.longitud')
    .if(body('tipo_mensaje').equals('ubicacion'))
    .isFloat({ min: -180, max: 180 })
    .withMessage('La longitud debe estar entre -180 y 180')
];

// Middleware de manejo de errores de validación
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: errors.array()
    });
  }
  
  next();
};

// Aplicar protección a todas las rutas
router.use(protect);

// @route   GET /api/chats
// @desc    Obtener todos los chats del usuario con filtros
// @access  Protected
// @query   tipo, search, page, limit, sortBy, order
router.get('/', getUserChats);

// @route   POST /api/chats
// @desc    Crear un nuevo chat
// @access  Protected
router.post('/',
  createChatLimit,
  createChatValidation,
  handleValidationErrors,
  createChat
);

// @route   GET /api/chats/:id/messages
// @desc    Obtener mensajes de un chat específico
// @access  Protected
// @query   page, limit, before, search
router.get('/:id/messages', getChatMessages);

// @route   POST /api/chats/:id/messages
// @desc    Enviar un mensaje a un chat específico
// @access  Protected
router.post('/:id/messages',
  sendMessageLimit,
  sendMessageValidation,
  handleValidationErrors,
  sendMessage
);

module.exports = router;