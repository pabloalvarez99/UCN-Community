const ChatSimple = require('../models/ChatSimple');
const MessageSimple = require('../models/MessageSimple');
const User = require('../models/User');

// @desc    Obtener chats del usuario logueado
// @route   GET /api/chats
// @access  Protected
exports.getMyChats = async (req, res) => {
  try {
    const chats = await ChatSimple.find({
      participants: req.user.id
    })
    .populate('participants', 'name email carrera foto_perfil')
    .populate('lastMessage', 'content messageType createdAt')
    .sort({ lastActivity: -1 });
    
    // Enriquecer datos para frontend
    const enrichedChats = chats.map(chat => {
      const chatObj = chat.toObject();
      
      // Para chats no grupales, usar el nombre del otro usuario
      if (!chat.isGroupChat) {
        const otherUser = chat.participants.find(p => 
          p._id.toString() !== req.user.id.toString()
        );
        chatObj.displayName = otherUser ? otherUser.name : 'Usuario Desconocido';
        chatObj.displayImage = otherUser ? otherUser.foto_perfil : null;
      } else {
        chatObj.displayName = chat.chatName || 'Chat Grupal';
        chatObj.displayImage = null;
      }
      
      return {
        _id: chatObj._id,
        id: chatObj._id, // Para compatibilidad con frontend
        nombre: chatObj.displayName,
        tipo: chatObj.isGroupChat ? 'grupal' : 'individual',
        participantes: chatObj.participants.map(p => ({
          id: p._id,
          name: p.name,
          carrera: p.carrera,
          foto_perfil: p.foto_perfil
        })),
        ultimo_mensaje: chatObj.lastMessage ? {
          contenido: chatObj.lastMessage.content,
          fecha: chatObj.lastMessage.createdAt
        } : null,
        fecha_creacion: chatObj.createdAt,
        mensajes_no_leidos: 0 // Se calculará en implementación futura
      };
    });
    
    res.json({
      success: true,
      message: `${enrichedChats.length} chats obtenidos`,
      data: {
        chats: enrichedChats,
        total: enrichedChats.length
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo chats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error obteniendo chats',
      error: error.message 
    });
  }
};

// @desc    Crear nuevo chat individual
// @route   POST /api/chats
// @access  Protected
exports.createChat = async (req, res) => {
  try {
    const { userId, chatName } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'El ID del usuario es requerido'
      });
    }
    
    // Verificar que el usuario no trate de crear un chat consigo mismo
    if (userId === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'No puedes crear un chat contigo mismo'
      });
    }
    
    // Verificar que el usuario destinatario existe
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar que no exista un chat individual entre estos usuarios
    let existingChat = await ChatSimple.findOne({
      isGroupChat: false,
      participants: { $all: [req.user.id, userId] }
    }).populate('participants', 'name email carrera foto_perfil');
    
    if (existingChat) {
      // Enriquecer chat existente para respuesta
      const otherUser = existingChat.participants.find(p => 
        p._id.toString() !== req.user.id.toString()
      );
      
      return res.json({
        success: true,
        message: 'Chat existente encontrado',
        data: {
          chat: {
            _id: existingChat._id,
            id: existingChat._id,
            nombre: otherUser ? otherUser.name : 'Usuario Desconocido',
            tipo: 'individual',
            participantes: existingChat.participants.map(p => ({
              id: p._id,
              name: p.name,
              carrera: p.carrera,
              foto_perfil: p.foto_perfil
            })),
            fecha_creacion: existingChat.createdAt
          }
        }
      });
    }
    
    // Crear nuevo chat
    const isGroupChat = chatName ? true : false;
    const newChat = await ChatSimple.create({
      participants: [req.user.id, userId],
      isGroupChat,
      chatName: chatName || ''
    });
    
    // Obtener chat con datos poblados
    const chat = await ChatSimple.findById(newChat._id)
      .populate('participants', 'name email carrera foto_perfil');
    
    // Enriquecer datos para respuesta
    const otherUser = chat.participants.find(p => 
      p._id.toString() !== req.user.id.toString()
    );
    
    res.status(201).json({
      success: true,
      message: 'Chat creado exitosamente',
      data: {
        chat: {
          _id: chat._id,
          id: chat._id,
          nombre: isGroupChat ? chatName : (otherUser ? otherUser.name : 'Usuario Desconocido'),
          tipo: isGroupChat ? 'grupal' : 'individual',
          participantes: chat.participants.map(p => ({
            id: p._id,
            name: p.name,
            carrera: p.carrera,
            foto_perfil: p.foto_perfil
          })),
          fecha_creacion: chat.createdAt
        }
      }
    });
    
  } catch (error) {
    console.error('Error creando chat:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creando chat',
      error: error.message 
    });
  }
};

// @desc    Obtener mensajes de un chat específico
// @route   GET /api/chats/:chatId/messages
// @access  Protected
exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Verificar que el chat existe y el usuario es participante
    const chat = await ChatSimple.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat no encontrado'
      });
    }
    
    // Verificar que el usuario es participante del chat
    const isParticipant = chat.participants.some(p => 
      p.toString() === req.user.id.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este chat'
      });
    }
    
    // Configurar paginación
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Obtener mensajes
    const [messages, totalMessages] = await Promise.all([
      MessageSimple.find({ chat: chatId })
        .populate('sender', 'name email foto_perfil carrera')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      MessageSimple.countDocuments({ chat: chatId })
    ]);
    
    // Marcar mensajes como leídos por el usuario actual
    const unreadMessages = messages.filter(msg => 
      msg.sender._id.toString() !== req.user.id.toString() &&
      !msg.readBy.some(read => read.user.toString() === req.user.id.toString())
    );
    
    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map(msg => msg.markAsRead(req.user.id))
      );
    }
    
    // Enriquecer mensajes para respuesta
    const enrichedMessages = messages.map(message => ({
      id: message._id,
      _id: message._id,
      contenido: message.content,
      autor: {
        id: message.sender._id,
        name: message.sender.name,
        foto_perfil: message.sender.foto_perfil,
        carrera: message.sender.carrera
      },
      fecha_envio: message.createdAt,
      tipo: message.messageType,
      leido: message.readBy.length > 0,
      is_own: message.sender._id.toString() === req.user.id.toString()
    }));
    
    const totalPages = Math.ceil(totalMessages / limitNum);
    
    res.json({
      success: true,
      message: `${enrichedMessages.length} mensajes obtenidos`,
      data: {
        messages: enrichedMessages.reverse(), // Orden cronológico
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalMessages,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        },
        chat_id: chatId
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error obteniendo mensajes',
      error: error.message 
    });
  }
};

// @desc    Enviar nuevo mensaje
// @route   POST /api/chats/:chatId/messages
// @access  Protected
exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, messageType = 'text' } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El contenido del mensaje es requerido'
      });
    }
    
    // Verificar que el chat existe y el usuario es participante
    const chat = await ChatSimple.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat no encontrado'
      });
    }
    
    // Verificar que el usuario es participante del chat
    const isParticipant = chat.participants.some(p => 
      p.toString() === req.user.id.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este chat'
      });
    }
    
    // Crear el mensaje
    const message = new MessageSimple({
      chat: chatId,
      sender: req.user.id,
      content: content.trim(),
      messageType: messageType
    });
    
    await message.save();
    
    // Actualizar lastMessage y lastActivity del chat
    await ChatSimple.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      lastActivity: new Date()
    });
    
    // Poblar datos del mensaje para respuesta
    await message.populate('sender', 'name email foto_perfil carrera');
    
    // Enriquecer mensaje para respuesta
    const enrichedMessage = {
      id: message._id,
      _id: message._id,
      contenido: message.content,
      autor: {
        id: message.sender._id,
        name: message.sender.name,
        foto_perfil: message.sender.foto_perfil,
        carrera: message.sender.carrera
      },
      fecha_envio: message.createdAt,
      tipo: message.messageType,
      leido: false,
      is_own: true
    };
    
    res.status(201).json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      data: {
        message: enrichedMessage
      }
    });
    
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error enviando mensaje',
      error: error.message 
    });
  }
};