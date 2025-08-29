// Archivo de índice para exportar todos los modelos de Mongoose
const User = require('./User');
const Post = require('./Post');
const Chat = require('./Chat');
const Message = require('./Message');
const Notification = require('./Notification');

// Modelos simplificados para Socket.IO chat
const ChatSimple = require('./ChatSimple');
const MessageSimple = require('./MessageSimple');

// Configurar referencias de modelo para populate dinámico
const models = {
  User,
  Post,
  Chat,
  Message,
  Notification,
  ChatSimple,
  MessageSimple
};

// Función para inicializar todos los modelos
const initializeModels = async () => {
  try {
    console.log('🔧 Inicializando modelos de Mongoose...');
    
    // Verificar que todos los modelos estén registrados
    Object.entries(models).forEach(([name, model]) => {
      if (model && model.modelName) {
        console.log(`   ✓ Modelo ${name} registrado`);
      } else {
        console.warn(`   ⚠️  Problema con el modelo ${name}`);
      }
    });
    
    console.log('✅ Modelos inicializados correctamente');
    return models;
  } catch (error) {
    console.error('❌ Error inicializando modelos:', error);
    throw error;
  }
};

// Función para crear datos de prueba (solo para desarrollo)
const createSeedData = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('🚫 Seed data no disponible en producción');
    return;
  }
  
  try {
    console.log('🌱 Creando datos de prueba...');
    
    // Verificar si ya existen usuarios
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log('📊 Datos ya existentes, omitiendo seed data');
      return;
    }
    
    // Crear usuarios de prueba
    const testUsers = [
      {
        name: 'Juan Pérez Silva',
        email: 'juan.perez@alumnos.ucn.cl',
        password: 'TestPass123!',
        carrera: 'Ingeniería en Sistemas',
        año_ingreso: 2022,
        campus: 'Antofagasta',
        biografia: 'Estudiante de Ingeniería en Sistemas apasionado por el desarrollo web.',
        verificado: true
      },
      {
        name: 'María González López',
        email: 'maria.gonzalez@alumnos.ucn.cl', 
        password: 'TestPass123!',
        carrera: 'Medicina',
        año_ingreso: 2021,
        campus: 'Antofagasta',
        biografia: 'Futura médica interesada en pediatría.',
        verificado: true
      },
      {
        name: 'Carlos Rojas Mendoza',
        email: 'carlos.rojas@alumnos.ucn.cl',
        password: 'TestPass123!',
        carrera: 'Derecho',
        año_ingreso: 2020,
        campus: 'Coquimbo',
        biografia: 'Estudiante de Derecho enfocado en derecho corporativo.',
        verificado: true
      },
      {
        name: 'Ana Soto Vargas',
        email: 'ana.soto@ucn.cl',
        password: 'TestPass123!',
        carrera: 'Psicología',
        año_ingreso: 2019,
        campus: 'Santiago',
        biografia: 'Profesora de Psicología especializada en psicología educativa.',
        verificado: true,
        role: 'professor'
      }
    ];
    
    const createdUsers = await User.insertMany(testUsers);
    console.log(`   ✓ ${createdUsers.length} usuarios de prueba creados`);
    
    // Crear algunos posts de prueba
    const testPosts = [
      {
        autor: createdUsers[0]._id,
        titulo: '¡Bienvenidos a UCN Community!',
        contenido: '¡Hola a todos! Me complace dar la bienvenida a esta nueva plataforma para nuestra comunidad universitaria. Aquí podremos compartir conocimientos, hacer preguntas y conectarnos con otros estudiantes y profesores.',
        tipo: 'anuncio',
        categoria: 'general',
        tags: ['bienvenida', 'comunidad', 'ucn'],
        campus_especifico: 'todos'
      },
      {
        autor: createdUsers[1]._id,
        titulo: 'Estudio de Anatomía - Grupo de estudio',
        contenido: 'Busco compañeros para formar un grupo de estudio de Anatomía. Nos juntaremos los martes y jueves en la biblioteca. ¿Quién se apunta?',
        tipo: 'pregunta',
        categoria: 'academico',
        tags: ['anatomia', 'estudio', 'medicina'],
        carrera_especifica: 'Medicina',
        campus_especifico: 'Antofagasta'
      },
      {
        autor: createdUsers[2]._id,
        titulo: 'Conferencia de Derecho Corporativo',
        contenido: 'El próximo viernes tendremos una conferencia sobre las nuevas regulaciones en derecho corporativo. La conferencia será en el auditorio principal a las 15:00.',
        tipo: 'evento',
        categoria: 'academico',
        tags: ['derecho', 'corporativo', 'conferencia'],
        carrera_especifica: 'Derecho',
        campus_especifico: 'Coquimbo'
      }
    ];
    
    const createdPosts = await Post.insertMany(testPosts);
    console.log(`   ✓ ${createdPosts.length} posts de prueba creados`);
    
    // Crear un chat de prueba
    const testChat = new Chat({
      tipo: 'grupal',
      nombre_grupo: 'Estudiantes UCN - General',
      descripcion: 'Chat general para todos los estudiantes de UCN',
      participantes: createdUsers.slice(0, 3).map(user => ({
        usuario: user._id,
        rol: 'miembro',
        activo: true
      })),
      campus: 'Antofagasta'
    });
    
    const createdChat = await testChat.save();
    console.log(`   ✓ Chat de prueba creado: ${createdChat.nombre_grupo}`);
    
    // Crear algunos mensajes de prueba
    const testMessages = [
      {
        chat_id: createdChat._id,
        sender_id: createdUsers[0]._id,
        contenido: '¡Hola a todos! ¿Cómo están?',
        tipo_mensaje: 'texto'
      },
      {
        chat_id: createdChat._id,
        sender_id: createdUsers[1]._id,
        contenido: '¡Muy bien! Gracias por crear este grupo.',
        tipo_mensaje: 'texto'
      },
      {
        chat_id: createdChat._id,
        sender_id: createdUsers[2]._id,
        contenido: 'Perfecto para coordinarnos en los estudios.',
        tipo_mensaje: 'texto'
      }
    ];
    
    const createdMessages = await Message.insertMany(testMessages);
    console.log(`   ✓ ${createdMessages.length} mensajes de prueba creados`);
    
    // Actualizar el último mensaje del chat
    await createdChat.updateLastMessage(createdMessages[createdMessages.length - 1]);
    
    console.log('✅ Datos de prueba creados exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando datos de prueba:', error);
    throw error;
  }
};

// Función para limpiar la base de datos (solo para desarrollo)
const cleanDatabase = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('🚫 Limpieza de BD no disponible en producción');
    return;
  }
  
  try {
    console.log('🧹 Limpiando base de datos...');
    
    await Promise.all([
      User.deleteMany({}),
      Post.deleteMany({}),
      Chat.deleteMany({}),
      Message.deleteMany({}),
      Notification.deleteMany({})
    ]);
    
    console.log('✅ Base de datos limpiada');
    
  } catch (error) {
    console.error('❌ Error limpiando base de datos:', error);
    throw error;
  }
};

// Función para obtener estadísticas de la base de datos
const getDatabaseStats = async () => {
  try {
    const stats = {};
    
    for (const [name, model] of Object.entries(models)) {
      const count = await model.countDocuments();
      const sampleDoc = await model.findOne().select('_id createdAt').sort({ createdAt: -1 });
      
      stats[name] = {
        count,
        lastCreated: sampleDoc ? sampleDoc.createdAt : null
      };
    }
    
    return stats;
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    throw error;
  }
};

module.exports = {
  // Modelos
  User,
  Post,
  Chat,
  Message,
  Notification,
  
  // Funciones utilitarias
  initializeModels,
  createSeedData,
  cleanDatabase,
  getDatabaseStats,
  
  // Objeto con todos los modelos
  models
};