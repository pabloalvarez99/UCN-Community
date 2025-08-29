const express = require('express');
const router = express.Router();

// Ruta simplificada para obtener posts
router.get('/', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Datos de prueba
    const mockPosts = Array.from({ length: parseInt(limit) }, (_, i) => ({
      id: `post_${i + 1}`,
      titulo: `Publicación de prueba ${i + 1}`,
      contenido: `Este es el contenido de la publicación ${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
      autor: {
        id: 'user_1',
        name: 'Juan Pérez González',
        carrera: 'Biología Marina',
        avatar: null
      },
      fecha_creacion: new Date(Date.now() - (i * 1000 * 60 * 60)).toISOString(),
      likes: Math.floor(Math.random() * 50),
      comentarios: Math.floor(Math.random() * 20),
      tipo: 'general'
    }));

    res.status(200).json({
      success: true,
      message: `${mockPosts.length} publicaciones obtenidas`,
      data: {
        posts: mockPosts,
        total: mockPosts.length,
        page: 1,
        hasMore: false
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo publicaciones',
      error: error.message
    });
  }
});

// Crear post simplificado
router.post('/', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    
    const newPost = {
      id: `post_${Date.now()}`,
      titulo: titulo || 'Sin título',
      contenido: contenido || 'Sin contenido',
      autor: {
        id: 'user_1',
        name: 'Usuario de prueba',
        carrera: 'Sin carrera'
      },
      fecha_creacion: new Date().toISOString(),
      likes: 0,
      comentarios: 0,
      tipo: 'general'
    };

    res.status(201).json({
      success: true,
      message: 'Publicación creada exitosamente',
      data: { post: newPost }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creando publicación',
      error: error.message
    });
  }
});

module.exports = router;