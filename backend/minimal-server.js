const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { connectDB } = require('./config/database');

dotenv.config();
connectDB();

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

// Rutas disponibles
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');
const postsRoutes = require('./routes/posts-simple');
const chatsRoutes = require('./routes/chats-simple');

app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/chats', chatsRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: '🎓 UCN Community API - Servidor Completo',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/auth/login - Iniciar sesión',
      'POST /api/auth/register - Registrar usuario',
      'GET /api/test/users - Ver usuarios',
      'GET /api/posts - Ver publicaciones',
      'GET /api/chats - Ver chats'
    ]
  });
});

// Socket.IO básico sin autenticación compleja
io.on('connection', (socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);
  
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

server.listen(PORT, () => {
  console.log(`🚀 Servidor completo UCN Community corriendo en puerto ${PORT}`);
  console.log(`📡 Socket.IO habilitado`);
  console.log(`🔗 MongoDB: ${process.env.MONGO_URI ? 'Conectado' : 'URL no configurada'}`);
});

module.exports = app;