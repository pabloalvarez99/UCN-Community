const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { asyncHandler, createResponse } = require('../utils/helpers');
const { validationResult } = require('express-validator');

// @desc    Obtener todos los chats del usuario
// @route   GET /api/chats
// @access  Protected
const getUserChats = asyncHandler(async (req, res) => {
  const {
    tipo,
    search,
    page = 1,
    limit = 20,
    sortBy = 'fecha_actualizacion',
    order = 'desc'
  } = req.query;

  const userId = req.user.id;

  // Construir filtros
  const filters = {
    'participantes.usuario': userId,
    'participantes.activo': true,
    activo: true,
    archivado: false
  };

  if (tipo) filters.tipo = tipo;

  // Búsqueda por nombre de grupo
  if (search) {
    filters.$or = [
      { nombre_grupo: { $regex: search, $options: 'i' } },
      { descripcion: { $regex: search, $options: 'i' } },
      { materia: { $regex: search, $options: 'i' } }
    ];
  }

  // Configurar paginación
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Configurar ordenamiento
  const sortOrder = order === 'desc' ? -1 : 1;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder;

  try {
    const [chats, totalChats] = await Promise.all([
      Chat.find(filters)
        .populate('participantes.usuario', 'name foto_perfil')
        .populate('ultimo_mensaje.emisor', 'name foto_perfil')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Chat.countDocuments(filters)
    ]);

    // Enriquecer datos de chat
    const enrichedChats = await Promise.all(
      chats.map(async (chat) => {
        // Calcular mensajes no leídos para este usuario
        const userParticipant = chat.participantes.find(p => 
          p.usuario._id.toString() === userId.toString()
        );

        let unreadCount = 0;
        if (userParticipant && chat.ultimo_mensaje?.mensaje_id) {
          unreadCount = await Message.countDocuments({
            chat_id: chat._id,
            fecha_envio: { 
              $gt: userParticipant.ultimo_mensaje_visto 
                ? userParticipant.fecha_ultimo_acceso 
                : userParticipant.fecha_union 
            },
            sender_id: { $ne: userId },
            eliminado: false
          });
        }

        // Preparar información de participantes para display
        let displayName = chat.nombre_grupo;
        let displayImage = chat.imagen_grupo;

        if (chat.tipo === 'individual') {
          // Para chats individuales, mostrar info del otro usuario
          const otherParticipant = chat.participantes.find(p => 
            p.usuario._id.toString() !== userId.toString()
          );
          if (otherParticipant) {
            displayName = otherParticipant.usuario.name;
            displayImage = otherParticipant.usuario.foto_perfil;
          }
        }

        return {
          _id: chat._id,
          tipo: chat.tipo,
          nombre_display: displayName,
          imagen_display: displayImage,
          descripcion: chat.descripcion,
          participantes_count: chat.participantes.filter(p => p.activo).length,
          ultimo_mensaje: chat.ultimo_mensaje,
          fecha_actualizacion: chat.fecha_actualizacion,
          mensajes_no_leidos: unreadCount,
          user_role: userParticipant ? userParticipant.rol : 'miembro',
          campus: chat.campus,
          carrera: chat.carrera,
          materia: chat.materia,
          silenciado: userParticipant ? userParticipant.silenciado : false
        };
      })
    );

    const totalPages = Math.ceil(totalChats / limitNum);

    res.json(createResponse(true, 'Chats obtenidos exitosamente', {
      chats: enrichedChats,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalChats,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    }));

  } catch (error) {
    console.error('Error obteniendo chats:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Crear un nuevo chat
// @route   POST /api/chats
// @access  Protected
const createChat = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createResponse(false, 'Error de validación', null, {
      errors: errors.array()
    }));
  }

  try {
    const {
      tipo,
      nombre_grupo,
      descripcion,
      participantes, // Array de IDs de usuario
      materia,
      carrera,
      campus,
      año_academico
    } = req.body;

    const creatorId = req.user.id;

    // Validar tipo de chat
    if (!['individual', 'grupal', 'canal', 'estudio'].includes(tipo)) {
      return res.status(400).json(createResponse(false, 'Tipo de chat no válido'));
    }

    // Preparar lista de participantes
    let participantsList = [];
    
    if (tipo === 'individual') {
      // Para chat individual, debe haber exactamente 1 participante adicional
      if (!participantes || participantes.length !== 1) {
        return res.status(400).json(createResponse(false, 'Un chat individual requiere exactamente 1 participante adicional'));
      }
      
      // Verificar que el participante no sea el mismo usuario
      if (participantes[0] === creatorId) {
        return res.status(400).json(createResponse(false, 'No puedes crear un chat contigo mismo'));
      }
      
      // Verificar si ya existe un chat individual entre estos usuarios
      const existingChat = await Chat.findOne({
        tipo: 'individual',
        $and: [
          { 'participantes.usuario': creatorId },
          { 'participantes.usuario': participantes[0] },
          { 'participantes.activo': true }
        ],
        activo: true
      });
      
      if (existingChat) {
        return res.status(400).json(createResponse(false, 'Ya existe un chat con este usuario', {
          existingChatId: existingChat._id
        }));
      }
      
      participantsList = [
        { usuario: creatorId, rol: 'miembro' },
        { usuario: participantes[0], rol: 'miembro' }
      ];
    } else {
      // Para chats grupales
      if (!participantes || participantes.length < 1) {
        return res.status(400).json(createResponse(false, 'Debes agregar al menos 1 participante'));
      }
      
      // El creador es admin, otros son miembros
      participantsList = [
        { usuario: creatorId, rol: 'admin' }
      ];
      
      participantes.forEach(userId => {
        if (userId !== creatorId) {
          participantsList.push({ usuario: userId, rol: 'miembro' });
        }
      });
    }

    // Validar que todos los participantes existan y estén activos
    const participantIds = participantsList.map(p => p.usuario);
    const validUsers = await User.find({
      _id: { $in: participantIds },
      isActive: true
    }).select('_id');

    if (validUsers.length !== participantIds.length) {
      return res.status(400).json(createResponse(false, 'Uno o más participantes no son válidos'));
    }

    // Crear el chat
    const chatData = {
      tipo,
      participantes: participantsList,
      descripcion
    };

    // Agregar campos específicos según el tipo
    if (tipo !== 'individual') {
      if (!nombre_grupo || nombre_grupo.trim().length < 2) {
        return res.status(400).json(createResponse(false, 'El nombre del grupo es requerido'));
      }
      chatData.nombre_grupo = nombre_grupo;
    }

    if (tipo === 'estudio') {
      chatData.materia = materia;
      chatData.carrera = carrera;
      chatData.año_academico = año_academico;
    }

    if (campus) chatData.campus = campus;

    const chat = new Chat(chatData);
    await chat.save();

    // Poblar datos para respuesta
    await chat.populate('participantes.usuario', 'name foto_perfil carrera campus');

    res.status(201).json(createResponse(true, 'Chat creado exitosamente', {
      chat: {
        _id: chat._id,
        tipo: chat.tipo,
        nombre_display: chat.tipo === 'individual' 
          ? chat.participantes.find(p => p.usuario._id.toString() !== creatorId)?.usuario.name
          : chat.nombre_grupo,
        descripcion: chat.descripcion,
        participantes: chat.participantes,
        fecha_creacion: chat.fecha_creacion,
        campus: chat.campus,
        carrera: chat.carrera,
        materia: chat.materia
      }
    }));

  } catch (error) {
    console.error('Error creando chat:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json(createResponse(false, 'Error de validación', null, {
        errors: validationErrors
      }));
    }

    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Obtener mensajes de un chat específico
// @route   GET /api/chats/:id/messages
// @access  Protected
const getChatMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 50,
    before, // Para cargar mensajes anteriores a un mensaje específico
    search
  } = req.query;

  const userId = req.user.id;

  try {
    // Verificar que el usuario sea participante del chat
    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json(createResponse(false, 'Chat no encontrado'));
    }

    const isParticipant = chat.isUserParticipant(userId);
    if (!isParticipant) {
      return res.status(403).json(createResponse(false, 'No tienes acceso a este chat'));
    }

    // Construir filtros para mensajes
    const filters = {
      chat_id: id,
      eliminado: false
    };

    // Filtro para cargar mensajes anteriores
    if (before) {
      filters.fecha_envio = { $lt: new Date(before) };
    }

    // Búsqueda en contenido
    if (search) {
      filters.contenido = { $regex: search, $options: 'i' };
    }

    // Configurar paginación
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Obtener mensajes ordenados por fecha (más recientes primero)
    const [messages, totalMessages] = await Promise.all([
      Message.find(filters)
        .populate('sender_id', 'name foto_perfil verificado')
        .populate('respuesta_a.autor_original', 'name foto_perfil')
        .sort({ fecha_envio: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Message.countDocuments(filters)
    ]);

    // Marcar mensajes como leídos
    const unreadMessages = messages.filter(msg => 
      msg.sender_id._id.toString() !== userId.toString() &&
      !msg.leido.some(read => read.usuario.toString() === userId.toString())
    );

    if (unreadMessages.length > 0) {
      const unreadIds = unreadMessages.map(msg => msg._id);
      await Message.updateMany(
        { _id: { $in: unreadIds } },
        { $push: { leido: { usuario: userId, fecha_lectura: new Date() } } }
      );

      // Actualizar último mensaje visto del usuario en el chat
      await chat.markAsRead(userId, messages[0]?._id);
    }

    // Enriquecer mensajes con información adicional
    const enrichedMessages = messages.map(message => ({
      ...message,
      is_own: message.sender_id._id.toString() === userId.toString(),
      total_reacciones: message.reacciones ? message.reacciones.length : 0,
      user_reaction: message.reacciones?.find(r => 
        r.usuario.toString() === userId.toString()
      )?.emoji || null,
      read_by_count: message.leido ? message.leido.length : 0,
      can_edit: message.sender_id._id.toString() === userId.toString() && 
                message.tipo_mensaje === 'texto' &&
                (Date.now() - new Date(message.fecha_envio).getTime()) < (15 * 60 * 1000), // 15 minutos
      can_delete: message.sender_id._id.toString() === userId.toString() ||
                  chat.getUserRole(userId) === 'admin'
    }));

    const totalPages = Math.ceil(totalMessages / limitNum);

    res.json(createResponse(true, 'Mensajes obtenidos exitosamente', {
      messages: enrichedMessages.reverse(), // Revertir para mostrar cronológicamente
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalMessages,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      chat: {
        _id: chat._id,
        tipo: chat.tipo,
        nombre_display: chat.tipo === 'individual' 
          ? chat.participantes.find(p => p.usuario.toString() !== userId)?.usuario || 'Usuario'
          : chat.nombre_grupo
      }
    }));

  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

// @desc    Enviar mensaje a un chat
// @route   POST /api/chats/:id/messages
// @access  Protected
const sendMessage = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createResponse(false, 'Error de validación', null, {
      errors: errors.array()
    }));
  }

  try {
    const { id } = req.params;
    const {
      contenido,
      tipo_mensaje = 'texto',
      respuesta_a,
      archivo,
      ubicacion
    } = req.body;

    const userId = req.user.id;

    // Verificar que el chat existe y el usuario es participante
    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json(createResponse(false, 'Chat no encontrado'));
    }

    const isParticipant = chat.isUserParticipant(userId);
    if (!isParticipant) {
      return res.status(403).json(createResponse(false, 'No tienes acceso a este chat'));
    }

    // Verificar permisos para enviar mensajes
    const userRole = chat.getUserRole(userId);
    if (chat.configuracion?.solo_admins_pueden_escribir && userRole !== 'admin') {
      return res.status(403).json(createResponse(false, 'Solo los administradores pueden escribir en este chat'));
    }

    // Verificar si el usuario está silenciado
    const userParticipant = chat.participantes.find(p => 
      p.usuario.toString() === userId.toString()
    );
    if (userParticipant?.silenciado) {
      return res.status(403).json(createResponse(false, 'Has sido silenciado en este chat'));
    }

    // Crear el mensaje
    const messageData = {
      chat_id: id,
      sender_id: userId,
      tipo_mensaje
    };

    // Agregar contenido según el tipo
    if (tipo_mensaje === 'texto') {
      if (!contenido || contenido.trim().length === 0) {
        return res.status(400).json(createResponse(false, 'El contenido es requerido para mensajes de texto'));
      }
      messageData.contenido = contenido.trim();
    } else if (tipo_mensaje === 'archivo') {
      if (!archivo) {
        return res.status(400).json(createResponse(false, 'Los datos del archivo son requeridos'));
      }
      messageData.archivo = archivo;
      messageData.contenido = archivo.nombre_original;
    } else if (tipo_mensaje === 'ubicacion') {
      if (!ubicacion) {
        return res.status(400).json(createResponse(false, 'Los datos de ubicación son requeridos'));
      }
      messageData.ubicacion = ubicacion;
      messageData.contenido = ubicacion.nombre_lugar || 'Ubicación compartida';
    }

    // Agregar respuesta si existe
    if (respuesta_a) {
      const originalMessage = await Message.findById(respuesta_a).populate('sender_id', 'name');
      if (originalMessage && originalMessage.chat_id.toString() === id) {
        messageData.respuesta_a = {
          mensaje_id: originalMessage._id,
          contenido_preview: originalMessage.contenido.substring(0, 100),
          autor_original: originalMessage.sender_id._id
        };
      }
    }

    const message = new Message(messageData);
    await message.save();

    // Actualizar último mensaje del chat
    await chat.updateLastMessage(message);

    // Poblar datos para respuesta
    await message.populate('sender_id', 'name foto_perfil verificado');

    const enrichedMessage = {
      ...message.toObject(),
      is_own: true,
      total_reacciones: 0,
      user_reaction: null,
      read_by_count: 1,
      can_edit: tipo_mensaje === 'texto',
      can_delete: true
    };

    res.status(201).json(createResponse(true, 'Mensaje enviado exitosamente', {
      message: enrichedMessage
    }));

  } catch (error) {
    console.error('Error enviando mensaje:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json(createResponse(false, 'Error de validación', null, {
        errors: validationErrors
      }));
    }

    res.status(500).json(createResponse(false, 'Error interno del servidor', null, error.message));
  }
});

module.exports = {
  getUserChats,
  createChat,
  getChatMessages,
  sendMessage
};