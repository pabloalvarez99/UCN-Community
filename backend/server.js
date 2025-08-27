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

const authRoutes = require('./routes/auth');

app.use('/api/auth', authRoutes);

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

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on('userConnect', (userData) => {
    connectedUsers.set(socket.id, {
      ...userData,
      socketId: socket.id,
      connectedAt: new Date()
    });
    
    socket.broadcast.emit('userOnline', {
      userId: userData.id,
      name: userData.name
    });
    
    console.log(`${userData.name} se conectó`);
  });

  socket.on('joinRoom', (roomData) => {
    const { room, user } = roomData;
    
    if (!room || !user) {
      socket.emit('error', { message: 'Datos de sala inválidos' });
      return;
    }
    
    socket.join(room);
    
    socket.to(room).emit('userJoinedRoom', {
      message: `${user.name} se unió a la sala`,
      user: user.name,
      timestamp: new Date()
    });
    
    console.log(`Usuario ${user.name} se unió a la sala: ${room}`);
  });

  socket.on('leaveRoom', (roomData) => {
    const { room, user } = roomData;
    
    if (room && user) {
      socket.leave(room);
      
      socket.to(room).emit('userLeftRoom', {
        message: `${user.name} salió de la sala`,
        user: user.name,
        timestamp: new Date()
      });
      
      console.log(`Usuario ${user.name} salió de la sala: ${room}`);
    }
  });

  socket.on('sendMessage', (messageData) => {
    const { room, message, user } = messageData;
    
    if (!room || !message || !user) {
      socket.emit('error', { message: 'Datos de mensaje inválidos' });
      return;
    }
    
    if (message.trim().length === 0) {
      socket.emit('error', { message: 'El mensaje no puede estar vacío' });
      return;
    }
    
    if (message.length > 500) {
      socket.emit('error', { message: 'El mensaje es demasiado largo (máximo 500 caracteres)' });
      return;
    }
    
    const messageObject = {
      id: `${Date.now()}_${socket.id}`,
      room,
      message: message.trim(),
      user: user.name,
      userId: user.id,
      timestamp: new Date(),
      avatar: user.avatar
    };
    
    io.to(room).emit('receiveMessage', messageObject);
    
    console.log(`Mensaje en ${room} de ${user.name}: ${message}`);
  });

  socket.on('typing', (data) => {
    socket.to(data.room).emit('userTyping', {
      user: data.user,
      isTyping: data.isTyping
    });
  });

  socket.on('disconnect', (reason) => {
    const userData = connectedUsers.get(socket.id);
    
    if (userData) {
      socket.broadcast.emit('userOffline', {
        userId: userData.id,
        name: userData.name
      });
      
      connectedUsers.delete(socket.id);
      console.log(`${userData.name} se desconectó: ${reason}`);
    } else {
      console.log(`Usuario ${socket.id} desconectado: ${reason}`);
    }
  });

  socket.on('error', (error) => {
    console.error(`Socket error para ${socket.id}:`, error);
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