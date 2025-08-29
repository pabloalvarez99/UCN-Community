const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { connectDB } = require('./config/database');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configurar Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Importar modelos para verificar que se cargan correctamente
const User = require('./models/User');

// Rutas disponibles
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');
const usersRoutes = require('./routes/users-simple');
const postsRoutes = require('./routes/posts-simple');
const chatsRoutes = require('./routes/chats-simple');
const chatAPIRoutes = require('./routes/chat');

app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/chat', chatAPIRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: '🎓 UCN Community API - Servidor Principal',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    database: 'ucn-community',
    port: PORT,
    endpoints: [
      'POST /api/auth/register - Registrar usuario',
      'POST /api/auth/login - Iniciar sesión',
      'GET /api/auth/profile - Perfil usuario',
      'GET /api/users - Listar usuarios',
      'GET /api/users/search/:query - Buscar usuarios para chat',
      'GET /api/test/users - Ver usuarios (test)',
      'GET /api/posts - Ver publicaciones',
      'GET /api/chats - Ver chats (simple)',
      'GET /api/chat - Obtener mis chats',
      'POST /api/chat - Crear nuevo chat',
      'GET /api/chat/:chatId/messages - Obtener mensajes',
      'POST /api/chat/:chatId/messages - Enviar mensaje'
    ]
  });
});

// Socket.IO connection handling para chat en tiempo real
io.on('connection', (socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);
  
  // Join room para chat
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`🏠 Usuario ${socket.id} se unió a la sala: ${room}`);
    socket.to(room).emit('user_joined', {
      message: `Usuario se unió al chat`,
      timestamp: new Date()
    });
  });

  // Leave room para chat  
  socket.on('leave_room', (room) => {
    socket.leave(room);
    console.log(`🚪 Usuario ${socket.id} salió de la sala: ${room}`);
    socket.to(room).emit('user_left', {
      message: `Usuario salió del chat`,
      timestamp: new Date()
    });
  });

  // Send message para chat
  socket.on('send_message', (data) => {
    console.log(`💬 Mensaje en sala ${data.room}:`, data.message);
    // Reenviar mensaje a todos los usuarios en la sala
    io.to(data.room).emit('receive_message', {
      id: Date.now().toString(),
      message: data.message,
      sender: data.sender || 'Usuario',
      room: data.room,
      timestamp: new Date()
    });
  });

  // Typing indicators
  socket.on('typing_start', (data) => {
    socket.to(data.room).emit('user_typing', {
      userId: socket.id,
      room: data.room,
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(data.room).emit('user_typing', {
      userId: socket.id, 
      room: data.room,
      isTyping: false
    });
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Cliente desconectado: ${socket.id} - ${reason}`);
  });
  
  socket.on('error', (error) => {
    console.error(`⚠️ Socket error: ${socket.id}`, error);
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: err.message
  });
});

// Función principal para iniciar el servidor
const startServer = async () => {
  try {
    // PASO 1: Conectar a MongoDB ANTES de iniciar servidor
    console.log('📊 Iniciando conexión a MongoDB...');
    await connectDB();
    
    // PASO 2: Verificar que los modelos se cargan correctamente
    console.log('📋 Modelos de UCN Community cargados');
    console.log(`   - User: ${User.collection.collectionName}`);
    
    // PASO 3: Iniciar servidor en puerto 5000
    server.listen(PORT, () => {
      console.log(`\n🚀 ===== UCN COMMUNITY API =====`);
      console.log(`✅ Servidor corriendo en puerto ${PORT}`);
      console.log(`📡 Socket.IO habilitado`);
      console.log(`🔗 MongoDB: Conectado a ucn-community`);
      console.log(`📋 17 carreras UCN disponibles`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================\n`);
    });
    
  } catch (error) {
    console.error('❌ Error crítico al iniciar servidor:', error.message);
    console.error('💡 Verifica que MongoDB esté ejecutándose y la configuración sea correcta');
    process.exit(1);
  }
};

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Iniciar servidor
startServer();

module.exports = app;