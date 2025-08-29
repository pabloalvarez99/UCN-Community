// Create test users for chat testing
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// User model
const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellidos: { type: String, required: true },
  rut: { type: String, required: true, unique: true },
  rutLimpio: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  carrera: { type: String, required: true },
  año_ingreso: { type: Number, required: true },
  biografia: { type: String, default: '' },
  foto_perfil: { type: String, default: '' },
  role: { type: String, enum: ['student', 'professor', 'admin'], default: 'student' },
  verificado: { type: Boolean, default: true }, // Set to true for testing
  fecha_registro: { type: Date, default: Date.now },
  last_login: { type: Date }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createTestUsers() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ucn-community');
    
    console.log('🧪 Creating test users...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    const testUsers = [
      {
        nombre: 'Juan',
        apellidos: 'Pérez González',
        rut: '191234567',
        rutLimpio: '191234567',
        email: 'juan.perez@alumnos.ucn.cl',
        password: hashedPassword,
        carrera: 'Ingeniería Civil Industrial',
        año_ingreso: 2020,
        biografia: 'Estudiante de Ingeniería Civil Industrial UCN',
        role: 'student',
        verificado: true
      },
      {
        nombre: 'María',
        apellidos: 'López Silva',
        rut: '209876543',
        rutLimpio: '209876543',
        email: 'maria.lopez@alumnos.ucn.cl',
        password: hashedPassword,
        carrera: 'Ingeniería Civil en Computación e Informática',
        año_ingreso: 2021,
        biografia: 'Estudiante de Computación UCN',
        role: 'student',
        verificado: true
      },
      {
        nombre: 'Carlos',
        apellidos: 'Rodríguez Morales',
        rut: '18112233K',
        rutLimpio: '18112233K',
        email: 'carlos.rodriguez@alumnos.ucn.cl',
        password: hashedPassword,
        carrera: 'Ingeniería Comercial',
        año_ingreso: 2019,
        biografia: 'Estudiante de Ingeniería Comercial UCN',
        role: 'student',
        verificado: true
      }
    ];
    
    // Delete existing test users first
    await User.deleteMany({ 
      email: { $in: testUsers.map(u => u.email) } 
    });
    
    // Create test users
    const createdUsers = await User.insertMany(testUsers);
    
    console.log(`✅ Created ${createdUsers.length} test users:`);
    createdUsers.forEach(user => {
      console.log(`  - ${user.nombre} ${user.apellidos} (${user.email})`);
      console.log(`    ID: ${user._id}`);
    });
    
    console.log('\n📝 Login credentials for testing:');
    console.log('Email: juan.perez@ucn.cl | Password: test123');
    console.log('Email: maria.lopez@ucn.cl | Password: test123');
    console.log('Email: carlos.rodriguez@ucn.cl | Password: test123');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

createTestUsers();