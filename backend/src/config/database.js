const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/ucn-community';
    
    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ Conectado a MongoDB: ${conn.connection.name}`);
    console.log(`📊 Base de datos: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}:${conn.connection.port}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('Error de conexión a MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconectado');
    });

    return conn;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    
    if (error.name === 'MongooseServerSelectionError') {
      console.error('💡 Verifica que MongoDB esté ejecutándose y la URI sea correcta');
    }
    
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('🔌 MongoDB desconectado correctamente');
  } catch (error) {
    console.error('Error desconectando MongoDB:', error);
  }
};

module.exports = { connectDB, disconnectDB };