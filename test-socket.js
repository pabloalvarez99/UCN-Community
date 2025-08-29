// Test Socket.IO Connection
const { io } = require('socket.io-client');

console.log('🧪 Testing Socket.IO Connection to Backend...\n');

const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Socket.IO connection successful!');
  console.log(`📡 Socket ID: ${socket.id}`);
  
  // Test joining a room
  console.log('\n🏠 Testing room joining...');
  socket.emit('join_room', { room: 'test_room_123' });
  
  // Test sending a message
  setTimeout(() => {
    console.log('\n💬 Testing message sending...');
    socket.emit('send_message', {
      room: 'test_room_123',
      message: 'Hello from test client!',
      sender: 'Test User'
    });
  }, 1000);
  
  // Disconnect after tests
  setTimeout(() => {
    console.log('\n👋 Disconnecting...');
    socket.disconnect();
  }, 3000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
});

socket.on('receive_message', (data) => {
  console.log('📨 Message received:', data);
});

socket.on('room_joined', (data) => {
  console.log('🏠 Room joined successfully:', data);
});

socket.on('disconnect', (reason) => {
  console.log('👋 Disconnected:', reason);
  process.exit(0);
});

// Timeout for the test
setTimeout(() => {
  console.log('\n⏰ Test timeout reached');
  process.exit(1);
}, 5000);