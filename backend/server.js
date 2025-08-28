const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { connectDB } = require('./config/database');

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 5000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Demasiadas peticiones desde esta IP, intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(morgan('combined'));
app.use(limiter);
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Importar todas las rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const chatRoutes = require('./routes/chats');

// Configurar rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chats', chatRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenido a UCN Community API',
    version: '1.0.0',
    status: 'Server running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      error: err.message
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Recurso no encontrado',
      error: 'ID inválido'
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Dato duplicado',
      error: 'El recurso ya existe'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`
  });
});

// Importar middlewares de autenticación para Socket.IO
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const Chat = require('./models/Chat');

// Mapa para usuarios conectados con sistema de presencia mejorado
const connectedUsers = new Map();
const userSockets = new Map(); // userId -> Set of socketIds
const typingUsers = new Map(); // chatId -> Set of userIds

// Middleware de autenticación para Socket.IO
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Token de autenticación requerido'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .select('-password -verification_token -reset_password_token')
      .lean();

    if (!user || !user.isActive) {
      return next(new Error('Usuario no válido o cuenta inactiva'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    console.error('Error de autenticación Socket.IO:', error.message);
    next(new Error('Token de autenticación inválido'));
  }
};

// Aplicar middleware de autenticación
io.use(authenticateSocket);

io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`✅ Usuario autenticado conectado: ${user.name} (${socket.id})`);

  // Agregar usuario a la lista de conectados
  connectedUsers.set(socket.id, {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    avatar: user.foto_perfil,
    socketId: socket.id,
    connectedAt: new Date(),
    isOnline: true
  });

  // Manejar múltiples sockets por usuario
  if (!userSockets.has(user._id.toString())) {
    userSockets.set(user._id.toString(), new Set());
  }
  userSockets.get(user._id.toString()).add(socket.id);

  // Notificar a otros usuarios que este usuario está online
  socket.broadcast.emit('user_online', {
    userId: user._id.toString(),
    name: user.name,
    avatar: user.foto_perfil,
    timestamp: new Date()
  });

  // Enviar lista de usuarios online al usuario recién conectado
  const onlineUsers = Array.from(connectedUsers.values()).map(u => ({
    userId: u.userId,
    name: u.name,
    avatar: u.avatar,
    connectedAt: u.connectedAt
  }));
  
  socket.emit('online_users', onlineUsers);

  // Unirse a un chat específico (basado en chat_id)
  socket.on('join_chat', async (data) => {
    try {
      const { chat_id } = data;
      
      if (!chat_id) {
        return socket.emit('error', { 
          type: 'INVALID_DATA',
          message: 'chat_id es requerido' 
        });
      }

      // Verificar que el usuario pertenece al chat
      const chat = await Chat.findById(chat_id);
      if (!chat) {
        return socket.emit('error', { 
          type: 'CHAT_NOT_FOUND',
          message: 'Chat no encontrado' 
        });
      }

      const isMember = chat.participantes.some(p => p.toString() === user._id.toString());
      if (!isMember) {
        return socket.emit('error', { 
          type: 'ACCESS_DENIED',
          message: 'No tienes acceso a este chat' 
        });
      }

      // Unirse a la room del chat
      socket.join(`chat_${chat_id}`);
      socket.currentChatId = chat_id;

      // Notificar a otros miembros del chat que el usuario se unió
      socket.to(`chat_${chat_id}`).emit('user_joined_chat', {
        userId: user._id.toString(),
        name: user.name,
        avatar: user.foto_perfil,
        chat_id,
        timestamp: new Date()
      });

      // Confirmar al usuario que se unió exitosamente
      socket.emit('chat_joined', {
        chat_id,
        message: `Te uniste al chat exitosamente`,
        timestamp: new Date()
      });

      console.log(`👥 ${user.name} se unió al chat: ${chat_id}`);

    } catch (error) {
      console.error('Error al unirse al chat:', error);
      socket.emit('error', { 
        type: 'SERVER_ERROR',
        message: 'Error interno al unirse al chat' 
      });
    }
  });

  // Enviar mensaje a un chat
  socket.on('send_message', async (data) => {
    try {
      const { chat_id, mensaje, tipo = 'text' } = data;

      if (!chat_id || !mensaje || mensaje.trim().length === 0) {
        return socket.emit('error', { 
          type: 'INVALID_DATA',
          message: 'chat_id y mensaje son requeridos' 
        });
      }

      if (mensaje.length > 1000) {
        return socket.emit('error', { 
          type: 'MESSAGE_TOO_LONG',
          message: 'El mensaje no puede exceder 1000 caracteres' 
        });
      }

      // Verificar acceso al chat
      const chat = await Chat.findById(chat_id);
      if (!chat) {
        return socket.emit('error', { 
          type: 'CHAT_NOT_FOUND',
          message: 'Chat no encontrado' 
        });
      }

      const isMember = chat.participantes.some(p => p.toString() === user._id.toString());
      if (!isMember) {
        return socket.emit('error', { 
          type: 'ACCESS_DENIED',
          message: 'No puedes enviar mensajes a este chat' 
        });
      }

      // Crear mensaje en la base de datos
      const newMessage = await Message.create({
        chat: chat_id,
        remitente: user._id,
        mensaje: mensaje.trim(),
        tipo,
        fecha_envio: new Date()
      });

      // Poblar información del remitente
      await newMessage.populate('remitente', 'name email foto_perfil');

      // Actualizar último mensaje del chat
      await Chat.findByIdAndUpdate(chat_id, {
        ultimo_mensaje: newMessage._id,
        fecha_ultimo_mensaje: new Date()
      });

      // Preparar objeto del mensaje para enviar
      const messageObject = {
        _id: newMessage._id.toString(),
        chat: chat_id,
        remitente: {
          _id: newMessage.remitente._id.toString(),
          name: newMessage.remitente.name,
          email: newMessage.remitente.email,
          foto_perfil: newMessage.remitente.foto_perfil
        },
        mensaje: newMessage.mensaje,
        tipo: newMessage.tipo,
        fecha_envio: newMessage.fecha_envio,
        leido: false
      };

      // Enviar mensaje a todos los miembros del chat
      io.to(`chat_${chat_id}`).emit('receive_message', messageObject);

      console.log(`💬 Mensaje en chat ${chat_id} de ${user.name}: ${mensaje.substring(0, 50)}...`);

    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      socket.emit('error', { 
        type: 'SERVER_ERROR',
        message: 'Error interno al enviar mensaje' 
      });
    }
  });

  // Indicador de escritura
  socket.on('typing', (data) => {
    const { chat_id, isTyping } = data;
    
    if (!chat_id) return;

    const userId = user._id.toString();

    if (!typingUsers.has(chat_id)) {
      typingUsers.set(chat_id, new Set());
    }

    if (isTyping) {
      typingUsers.get(chat_id).add(userId);
    } else {
      typingUsers.get(chat_id).delete(userId);
    }

    // Enviar estado de escritura a otros miembros del chat
    socket.to(`chat_${chat_id}`).emit('user_typing', {
      userId,
      name: user.name,
      chat_id,
      isTyping,
      timestamp: new Date()
    });

    // Limpiar automáticamente después de 3 segundos
    if (isTyping) {
      setTimeout(() => {
        if (typingUsers.has(chat_id)) {
          typingUsers.get(chat_id).delete(userId);
          socket.to(`chat_${chat_id}`).emit('user_typing', {
            userId,
            name: user.name,
            chat_id,
            isTyping: false,
            timestamp: new Date()
          });
        }
      }, 3000);
    }
  });

  // Parar indicador de escritura
  socket.on('stop_typing', (data) => {
    const { chat_id } = data;
    
    if (!chat_id) return;

    const userId = user._id.toString();
    
    if (typingUsers.has(chat_id)) {
      typingUsers.get(chat_id).delete(userId);
    }

    socket.to(`chat_${chat_id}`).emit('user_typing', {
      userId,
      name: user.name,
      chat_id,
      isTyping: false,
      timestamp: new Date()
    });
  });

  // Salir de un chat
  socket.on('leave_chat', (data) => {
    const { chat_id } = data;
    
    if (!chat_id) return;

    socket.leave(`chat_${chat_id}`);
    
    // Limpiar estado de escritura
    if (typingUsers.has(chat_id)) {
      typingUsers.get(chat_id).delete(user._id.toString());
    }

    socket.to(`chat_${chat_id}`).emit('user_left_chat', {
      userId: user._id.toString(),
      name: user.name,
      chat_id,
      timestamp: new Date()
    });

    console.log(`👋 ${user.name} salió del chat: ${chat_id}`);
  });

  // Manejo de desconexión
  socket.on('disconnect', (reason) => {
    const userData = connectedUsers.get(socket.id);
    
    if (userData) {
      // Remover socket del usuario
      const userSocketSet = userSockets.get(userData.userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        
        // Si no quedan sockets para este usuario, marcarlo como offline
        if (userSocketSet.size === 0) {
          userSockets.delete(userData.userId);
          
          // Notificar a otros usuarios que este usuario está offline
          socket.broadcast.emit('user_offline', {
            userId: userData.userId,
            name: userData.name,
            timestamp: new Date()
          });

          console.log(`❌ ${userData.name} está completamente offline`);
        }
      }

      // Limpiar estado de escritura en todos los chats
      typingUsers.forEach((users, chatId) => {
        if (users.has(userData.userId)) {
          users.delete(userData.userId);
          socket.to(`chat_${chatId}`).emit('user_typing', {
            userId: userData.userId,
            name: userData.name,
            chat_id: chatId,
            isTyping: false,
            timestamp: new Date()
          });
        }
      });

      connectedUsers.delete(socket.id);
      console.log(`🔌 ${userData.name} desconectado: ${reason} (${socket.id})`);
    } else {
      console.log(`🔌 Socket ${socket.id} desconectado: ${reason}`);
    }
  });

  // Manejo de errores del socket
  socket.on('error', (error) => {
    console.error(`⚠️ Socket error para ${user.name} (${socket.id}):`, error);
  });

  // Obtener usuarios online
  socket.on('get_online_users', () => {
    const onlineUsers = Array.from(userSockets.keys()).map(userId => {
      const userData = Array.from(connectedUsers.values()).find(u => u.userId === userId);
      return userData ? {
        userId: userData.userId,
        name: userData.name,
        avatar: userData.avatar,
        connectedAt: userData.connectedAt
      } : null;
    }).filter(Boolean);

    socket.emit('online_users', onlineUsers);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor UCN Community corriendo en puerto ${PORT}`);
  console.log(`📡 Socket.IO habilitado`);
  console.log(`🔒 Seguridad: Helmet, CORS, Rate Limiting activados`);
  console.log(`🔗 MongoDB: ${process.env.MONGO_URI ? 'Conectado' : 'URL no configurada'}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
});