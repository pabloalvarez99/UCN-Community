const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { connectDB } = require('./config/database');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Configure Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Import models
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const chatsRoutes = require('./routes/chats');
const chatAPIRoutes = require('./routes/chat');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/chat', chatAPIRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '🎓 UCN Community API - Professional Backend',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    database: 'ucn-community',
    port: PORT,
    endpoints: [
      'POST /api/auth/register - Register user',
      'POST /api/auth/login - Login user',
      'GET /api/auth/profile - Get user profile',
      'GET /api/users - List users',
      'GET /api/users/search/:query - Search users for chat',
      'GET /api/posts - View posts',
      'GET /api/chats - View chats',
      'GET /api/chat - Get my chats',
      'POST /api/chat - Create new chat',
      'GET /api/chat/:chatId/messages - Get messages',
      'POST /api/chat/:chatId/messages - Send message',
      'GET /health - Health check'
    ]
  });
});

// Socket.IO connection handling for real-time chat
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  
  // Join room for chat
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`🏠 User ${socket.id} joined room: ${room}`);
    socket.to(room).emit('user_joined', {
      message: `User joined the chat`,
      timestamp: new Date()
    });
  });

  // Leave room for chat  
  socket.on('leave_room', (room) => {
    socket.leave(room);
    console.log(`🚪 User ${socket.id} left room: ${room}`);
    socket.to(room).emit('user_left', {
      message: `User left the chat`,
      timestamp: new Date()
    });
  });

  // Send message for chat
  socket.on('send_message', (data) => {
    console.log(`💬 Message in room ${data.room}:`, data.message);
    // Forward message to all users in the room
    io.to(data.room).emit('receive_message', {
      id: Date.now().toString(),
      message: data.message,
      sender: data.sender || 'User',
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
    console.log(`🔌 Client disconnected: ${socket.id} - ${reason}`);
  });
  
  socket.on('error', (error) => {
    console.error(`⚠️ Socket error: ${socket.id}`, error);
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Main function to start server
const startServer = async () => {
  try {
    // STEP 1: Connect to MongoDB BEFORE starting server
    console.log('📊 Starting MongoDB connection...');
    await connectDB();
    
    // STEP 2: Verify that models load correctly
    console.log('📋 UCN Community models loaded');
    console.log(`   - User: ${User.collection.collectionName}`);
    
    // STEP 3: Start server on port
    server.listen(PORT, () => {
      console.log(`\n🚀 ===== UCN COMMUNITY API =====`);
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📡 Socket.IO enabled`);
      console.log(`🔗 MongoDB: Connected to ucn-community`);
      console.log(`🛡️ Security: Helmet, Rate limiting enabled`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================\n`);
    });
    
  } catch (error) {
    console.error('❌ Critical error starting server:', error.message);
    console.error('💡 Check that MongoDB is running and configuration is correct');
    process.exit(1);
  }
};

// Handle uncaught errors
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

// Start server only if not being imported as module
if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };