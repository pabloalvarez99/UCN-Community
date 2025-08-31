const express = require('express');
const {
  getPosts,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  getPostById
} = require('../controllers/postController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting para crear posts
const createPostLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // máximo 5 posts por minuto
  message: {
    success: false,
    message: 'Demasiados posts creados. Intenta de nuevo en un minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para likes
const likeLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 likes por minuto
  message: {
    success: false,
    message: 'Demasiados likes. Intenta de nuevo en un minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para comentarios
const commentLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 comentarios por minuto
  message: {
    success: false,
    message: 'Demasiados comentarios. Intenta de nuevo en un minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validaciones para crear post
const createPostValidation = [
  body('contenido')
    .isLength({ min: 1, max: 5000 })
    .withMessage('El contenido debe tener entre 1 y 5000 caracteres')
    .trim(),
  
  body('titulo')
    .optional()
    .isLength({ max: 200 })
    .withMessage('El título no puede exceder 200 caracteres')
    .trim(),
    
  body('tipo')
    .optional()
    .isIn(['texto', 'pregunta', 'anuncio', 'evento', 'recurso', 'discusion'])
    .withMessage('Tipo de post no válido'),
    
  body('categoria')
    .optional()
    .isIn([
      'general',
      'academico',
      'social',
      'deportes',
      'cultura',
      'trabajo',
      'vivienda',
      'transporte',
      'salud',
      'tecnologia',
      'entretenimiento'
    ])
    .withMessage('Categoría no válida'),
    
  body('tags')
    .optional()
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 10) {
          throw new Error('No puedes agregar más de 10 tags');
        }
        tags.forEach(tag => {
          if (typeof tag !== 'string' || tag.length > 50) {
            throw new Error('Cada tag debe ser texto y no exceder 50 caracteres');
          }
        });
      } else if (typeof tags === 'string') {
        const tagArray = tags.split(',');
        if (tagArray.length > 10) {
          throw new Error('No puedes agregar más de 10 tags');
        }
      }
      return true;
    }),
    
  body('campus_especifico')
    .optional()
    .isIn(['Antofagasta', 'Coquimbo', 'Santiago', 'todos'])
    .withMessage('Campus no válido'),
    
  body('año_especifico')
    .optional()
    .isInt({ min: 1, max: 6 })
    .withMessage('El año debe estar entre 1 y 6')
];

// Validaciones para actualizar post
const updatePostValidation = [
  body('contenido')
    .optional()
    .isLength({ min: 1, max: 5000 })
    .withMessage('El contenido debe tener entre 1 y 5000 caracteres')
    .trim(),
    
  body('titulo')
    .optional()
    .isLength({ max: 200 })
    .withMessage('El título no puede exceder 200 caracteres')
    .trim(),
    
  body('categoria')
    .optional()
    .isIn([
      'general',
      'academico',
      'social',
      'deportes',
      'cultura',
      'trabajo',
      'vivienda',
      'transporte',
      'salud',
      'tecnologia',
      'entretenimiento'
    ])
    .withMessage('Categoría no válida'),
    
  body('tags')
    .optional()
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 10) {
          throw new Error('No puedes agregar más de 10 tags');
        }
        tags.forEach(tag => {
          if (typeof tag !== 'string' || tag.length > 50) {
            throw new Error('Cada tag debe ser texto y no exceder 50 caracteres');
          }
        });
      } else if (typeof tags === 'string') {
        const tagArray = tags.split(',');
        if (tagArray.length > 10) {
          throw new Error('No puedes agregar más de 10 tags');
        }
      }
      return true;
    })
];

// Validación para comentarios
const commentValidation = [
  body('contenido')
    .isLength({ min: 1, max: 1000 })
    .withMessage('El comentario debe tener entre 1 y 1000 caracteres')
    .trim()
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

// @route   GET /api/posts
// @desc    Obtener posts con filtros y paginación
// @access  Protected
// @query   search, categoria, tipo, campus, carrera, año, autor, destacado, page, limit, sortBy, order
router.get('/', getPosts);

// @route   POST /api/posts
// @desc    Crear un nuevo post
// @access  Protected
router.post('/', 
  createPostLimit,
  createPostValidation,
  handleValidationErrors,
  createPost
);

// @route   GET /api/posts/:id
// @desc    Obtener un post específico por ID
// @access  Protected
router.get('/:id', getPostById);

// @route   PUT /api/posts/:id
// @desc    Actualizar un post existente
// @access  Protected (solo el autor o admin)
router.put('/:id',
  updatePostValidation,
  handleValidationErrors,
  updatePost
);

// @route   DELETE /api/posts/:id
// @desc    Eliminar un post
// @access  Protected (solo el autor o admin)
router.delete('/:id', deletePost);

// @route   POST /api/posts/:id/like
// @desc    Dar/quitar like a un post
// @access  Protected
router.post('/:id/like', likeLimit, toggleLike);

// @route   POST /api/posts/:id/comment
// @desc    Agregar un comentario a un post
// @access  Protected
router.post('/:id/comment',
  commentLimit,
  commentValidation,
  handleValidationErrors,
  addComment
);

module.exports = router;