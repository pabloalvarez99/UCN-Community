const express = require('express');
const router = express.Router();

// Ruta simplificada para obtener chats
router.get('/', async (req, res) => {
  try {
    // Datos de prueba
    const mockChats = [
      {
        id: 'chat_1',
        nombre: 'Biología Marina 2024',
        tipo: 'grupal',
        participantes: [
          { id: 'user_1', name: 'Juan Pérez', carrera: 'Biología Marina' },
          { id: 'user_2', name: 'María García', carrera: 'Biología Marina' },
          { id: 'user_3', name: 'Carlos Silva', carrera: 'Biología Marina' }
        ],
        ultimo_mensaje: {
          contenido: 'Hola a todos! ¿Cómo van con el proyecto?',
          autor: 'María García',
          fecha: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        },
        fecha_creacion: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        mensajes_no_leidos: 3
      },
      {
        id: 'chat_2',
        nombre: 'Medicina - Prácticas',
        tipo: 'grupal',
        participantes: [
          { id: 'user_4', name: 'Ana Morales', carrera: 'Medicina' },
          { id: 'user_5', name: 'Diego Torres', carrera: 'Medicina' }
        ],
        ultimo_mensaje: {
          contenido: '¿Alguien tiene las notas de la última clase?',
          autor: 'Diego Torres',
          fecha: new Date(Date.now() - 1000 * 60 * 15).toISOString()
        },
        fecha_creacion: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        mensajes_no_leidos: 1
      }
    ];

    res.status(200).json({
      success: true,
      message: `${mockChats.length} chats obtenidos`,
      data: {
        chats: mockChats,
        total: mockChats.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo chats',
      error: error.message
    });
  }
});

// Obtener mensajes de un chat específico
router.get('/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50 } = req.query;

    // Mensajes de prueba
    const mockMessages = Array.from({ length: Math.min(parseInt(limit), 20) }, (_, i) => ({
      id: `msg_${i + 1}`,
      chat_id: chatId,
      contenido: `Mensaje de prueba ${i + 1}. Lorem ipsum dolor sit amet.`,
      autor: {
        id: `user_${(i % 3) + 1}`,
        name: ['Juan Pérez', 'María García', 'Carlos Silva'][i % 3],
        avatar: null
      },
      fecha_envio: new Date(Date.now() - (i * 1000 * 60 * 5)).toISOString(),
      tipo: 'text',
      leido: Math.random() > 0.3
    }));

    res.status(200).json({
      success: true,
      message: `${mockMessages.length} mensajes obtenidos`,
      data: {
        messages: mockMessages.reverse(), // Más recientes al final
        chat_id: chatId,
        total: mockMessages.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo mensajes',
      error: error.message
    });
  }
});

// Crear nuevo chat
router.post('/', async (req, res) => {
  try {
    const { nombre, participantes = [] } = req.body;

    const newChat = {
      id: `chat_${Date.now()}`,
      nombre: nombre || 'Chat sin nombre',
      tipo: participantes.length > 2 ? 'grupal' : 'privado',
      participantes: participantes,
      fecha_creacion: new Date().toISOString(),
      mensajes_no_leidos: 0
    };

    res.status(201).json({
      success: true,
      message: 'Chat creado exitosamente',
      data: { chat: newChat }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creando chat',
      error: error.message
    });
  }
});

module.exports = router;