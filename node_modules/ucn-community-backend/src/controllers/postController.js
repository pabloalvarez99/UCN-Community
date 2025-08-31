const Post = require('../models/Post');
const User = require('../models/User');
const { asyncHandler, createResponse } = require('../utils/helpers');
const { validationResult } = require('express-validator');

// @desc    Obtener todos los posts con filtros
// @route   GET /api/posts
// @access  Protected
const getPosts = asyncHandler(async (req, res) => {
  const {
    search,
    categoria,
    tipo,
    campus,
    carrera,
    año,
    autor,
    destacado,
    page = 1,
    limit = 20,
    sortBy = 'fecha_publicacion',
    order = 'desc'
  } = req.query;

  // Construir filtros
  const filters = { 
    activo: true,
    moderado: false
  };

  // Búsqueda por texto
  if (search) {
    filters.$text = { $search: search };
  }

  // Filtros específicos
  if (categoria) filters.categoria = categoria;
  if (tipo) filters.tipo = tipo;
  if (campus && campus !== 'todos') filters.campus_especifico = { $in: [campus, 'todos'] };
  if (carrera) filters.carrera_especifica = { $in: [carrera, null] };
  if (año) filters.año_especifico = { $in: [parseInt(año), null] };
  if (autor) filters.autor = autor;
  if (destacado === 'true') filters.destacado = true;

  // Configurar paginación
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Configurar ordenamiento
  const sortOrder = order === 'desc' ? -1 : 1;
  const sortOptions = {};
  
  // Ordenamientos especiales
  if (sortBy === 'engagement') {
    // Se puede implementar un campo virtual o cálculo
    sortOptions['total_likes'] = sortOrder;
    sortOptions['fecha_publicacion'] = -1;
  } else if (sortBy === 'popularity') {
    sortOptions['visualizaciones'] = sortOrder;
    sortOptions['fecha_publicacion'] = -1;
  } else {
    sortOptions[sortBy] = sortOrder;
  }

  try {
    // Ejecutar consulta con población de datos
    const [posts, totalPosts] = await Promise.all([
      Post.find(filters)
        .populate('autor', 'name foto_perfil carrera campus verificado')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Post.countDocuments(filters)
    ]);

    // Agregar información adicional a cada post
    const enrichedPosts = posts.map(post => {
      const enriched = {
        ...post,
        total_likes: post.likes ? post.likes.length : 0,
        total_comentarios: post.comentarios ? post.comentarios.length : 0,
        user_liked: req.user ? post.likes?.some(like => 
          like.usuario.toString() === req.user.id.toString()
        ) : false,
        can_edit: req.user && post.autor._id.toString() === req.user.id.toString(),
        can_delete: req.user && (
          post.autor._id.toString() === req.user.id.toString() || 
          req.user.role === 'admin'
        )
      };

      // Ocultar información sensible
      delete enriched.reportes;
      delete enriched.reportado;
      
      return enriched;
    });

    const totalPages = Math.ceil(totalPosts / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json(createResponse(true, 'Posts obtenidos exitosamente', {
      posts: enrichedPosts,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalPosts,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      },
      filters: {
        search,
        categoria,
        tipo,
        campus,
        carrera,
        año,
        autor,
        destacado
      }
    }));

  } catch (error) {
    console.error('Error obteniendo posts:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Crear un nuevo post
// @route   POST /api/posts
// @access  Protected
const createPost = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createResponse(false, 'Error de validación', null, {
      errors: errors.array()
    }));
  }

  try {
    const {
      titulo,
      contenido,
      tipo,
      categoria,
      tags,
      campus_especifico,
      carrera_especifica,
      año_especifico,
      archivos
    } = req.body;

    // Crear el post
    const post = new Post({
      autor: req.user.id,
      titulo,
      contenido,
      tipo: tipo || 'texto',
      categoria: categoria || 'general',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : [],
      campus_especifico: campus_especifico || 'todos',
      carrera_especifica,
      año_especifico,
      archivos: archivos || []
    });

    await post.save();

    // Poblar datos del autor para la respuesta
    await post.populate('autor', 'name foto_perfil carrera campus verificado');

    const enrichedPost = {
      ...post.toObject(),
      total_likes: 0,
      total_comentarios: 0,
      user_liked: false,
      can_edit: true,
      can_delete: true
    };

    res.status(201).json(createResponse(true, 'Post creado exitosamente', {
      post: enrichedPost
    }));

  } catch (error) {
    console.error('Error creando post:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json(createResponse(false, 'Error de validación', null, {
        errors: validationErrors
      }));
    }

    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Actualizar un post
// @route   PUT /api/posts/:id
// @access  Protected
const updatePost = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createResponse(false, 'Error de validación', null, {
      errors: errors.array()
    }));
  }

  try {
    const { id } = req.params;
    const updates = req.body;

    // Buscar el post
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json(createResponse(false, 'Post no encontrado'));
    }

    // Verificar permisos
    if (post.autor.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json(createResponse(false, 'No tienes permisos para editar este post'));
    }

    // Campos que se pueden actualizar
    const allowedUpdates = [
      'titulo',
      'contenido', 
      'categoria',
      'tags',
      'campus_especifico',
      'carrera_especifica',
      'año_especifico'
    ];

    // Filtrar actualizaciones permitidas
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Procesar tags si están presentes
    if (filteredUpdates.tags) {
      filteredUpdates.tags = Array.isArray(filteredUpdates.tags) 
        ? filteredUpdates.tags 
        : filteredUpdates.tags.split(',').map(tag => tag.trim());
    }

    // Actualizar post
    const updatedPost = await Post.findByIdAndUpdate(
      id,
      filteredUpdates,
      { 
        new: true,
        runValidators: true
      }
    ).populate('autor', 'name foto_perfil carrera campus verificado');

    const enrichedPost = {
      ...updatedPost.toObject(),
      total_likes: updatedPost.likes.length,
      total_comentarios: updatedPost.comentarios.length,
      user_liked: updatedPost.likes.some(like => 
        like.usuario.toString() === req.user.id.toString()
      ),
      can_edit: true,
      can_delete: true
    };

    res.json(createResponse(true, 'Post actualizado exitosamente', {
      post: enrichedPost
    }));

  } catch (error) {
    console.error('Error actualizando post:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json(createResponse(false, 'Error de validación', null, {
        errors: validationErrors
      }));
    }

    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Eliminar un post
// @route   DELETE /api/posts/:id
// @access  Protected
const deletePost = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json(createResponse(false, 'Post no encontrado'));
    }

    // Verificar permisos
    if (post.autor.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json(createResponse(false, 'No tienes permisos para eliminar este post'));
    }

    // Soft delete - marcar como inactivo en lugar de eliminar
    post.activo = false;
    await post.save();

    res.json(createResponse(true, 'Post eliminado exitosamente'));

  } catch (error) {
    console.error('Error eliminando post:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Like/Unlike un post
// @route   POST /api/posts/:id/like
// @access  Protected
const toggleLike = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json(createResponse(false, 'Post no encontrado'));
    }

    if (!post.activo) {
      return res.status(404).json(createResponse(false, 'Post no disponible'));
    }

    // Toggle like usando el método del modelo
    const likeResult = post.addLike(userId);
    await post.save();

    res.json(createResponse(true, 
      likeResult.action === 'added' ? 'Like agregado' : 'Like removido',
      {
        liked: likeResult.action === 'added',
        totalLikes: likeResult.total
      }
    ));

  } catch (error) {
    console.error('Error en toggle like:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Agregar comentario a un post
// @route   POST /api/posts/:id/comment
// @access  Protected
const addComment = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createResponse(false, 'Error de validación', null, {
      errors: errors.array()
    }));
  }

  try {
    const { id } = req.params;
    const { contenido } = req.body;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json(createResponse(false, 'Post no encontrado'));
    }

    if (!post.activo) {
      return res.status(404).json(createResponse(false, 'Post no disponible'));
    }

    // Agregar comentario
    const newComment = post.addComment({
      autor: req.user.id,
      contenido
    });

    await post.save();

    // Poblar información del autor del comentario
    await post.populate({
      path: 'comentarios.autor',
      select: 'name foto_perfil verificado',
      match: { _id: newComment.autor }
    });

    // Encontrar el comentario recién creado con datos poblados
    const populatedComment = post.comentarios.id(newComment._id);

    res.status(201).json(createResponse(true, 'Comentario agregado exitosamente', {
      comment: populatedComment,
      totalComments: post.comentarios.length
    }));

  } catch (error) {
    console.error('Error agregando comentario:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Obtener un post específico con sus comentarios
// @route   GET /api/posts/:id
// @access  Protected
const getPostById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id)
      .populate('autor', 'name foto_perfil carrera campus verificado')
      .populate('comentarios.autor', 'name foto_perfil verificado')
      .lean();

    if (!post || !post.activo) {
      return res.status(404).json(createResponse(false, 'Post no encontrado'));
    }

    // Incrementar visualizaciones
    await Post.findByIdAndUpdate(id, { $inc: { visualizaciones: 1 } });

    const enrichedPost = {
      ...post,
      total_likes: post.likes ? post.likes.length : 0,
      total_comentarios: post.comentarios ? post.comentarios.length : 0,
      user_liked: req.user ? post.likes?.some(like => 
        like.usuario.toString() === req.user.id.toString()
      ) : false,
      can_edit: req.user && post.autor._id.toString() === req.user.id.toString(),
      can_delete: req.user && (
        post.autor._id.toString() === req.user.id.toString() || 
        req.user.role === 'admin'
      ),
      visualizaciones: (post.visualizaciones || 0) + 1
    };

    // Ocultar información sensible
    delete enrichedPost.reportes;
    delete enrichedPost.reportado;

    res.json(createResponse(true, 'Post obtenido exitosamente', {
      post: enrichedPost
    }));

  } catch (error) {
    console.error('Error obteniendo post:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

module.exports = {
  getPosts,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  getPostById
};