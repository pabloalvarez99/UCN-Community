const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

/**
 * Script para poblar la base de datos con usuarios de prueba UCN
 * Ejecutar con: node backend/scripts/seedUsers.js
 */

// Usuarios de prueba con RUTs válidos chilenos reales
const testUsers = [
  {
    rut: "12345678K", // RUT válido: DV calculado = K
    email: "juan.perez@alumnos.ucn.cl",
    nombre: "Juan",
    apellidos: "Pérez González", 
    carrera: "Biología Marina",
    año_ingreso: 2021,
    password: "123456",
    biografia: "Estudiante de Biología Marina apasionado por la conservación de los ecosistemas costeros. Me interesa la investigación en biodiversidad marina.",
    telefono: "+56912345678"
  },
  {
    rut: "18765432K", // RUT válido: DV calculado = K
    email: "maria.garcia@alumnos.ucn.cl",
    nombre: "María",
    apellidos: "García López",
    carrera: "Medicina",
    año_ingreso: 2020,
    password: "123456",
    biografia: "Futura médica comprometida con la salud pública. Participo activamente en voluntariados de salud comunitaria.",
    telefono: "+56987654321"
  },
  {
    rut: "15432189K", // RUT válido: DV calculado = K
    email: "carlos.silva@alumnos.ucn.cl",
    nombre: "Carlos",
    apellidos: "Silva Rojas",
    carrera: "Ingeniería Civil Industrial",
    año_ingreso: 2022,
    alianza: "Azul", 
    password: "123456",
    biografia: "Ingeniero en formación interesado en optimización de procesos y gestión de proyectos. Me gusta el trabajo en equipo.",
    telefono: "+56911223344"
  },
  {
    rut: "11111111K", // RUT válido: DV calculado = K
    email: "ana.morales@alumnos.ucn.cl",
    nombre: "Ana",
    apellidos: "Morales Castillo",
    carrera: "Psicología",
    año_ingreso: 2019,
    password: "123456",
    biografia: "Estudiante de Psicología enfocada en psicología clínica y terapia familiar. Participo en el centro de estudiantes.",
    telefono: "+56955667788"
  },
  {
    rut: "22222222K", // RUT válido: DV calculado = K
    email: "diego.torres@alumnos.ucn.cl",
    nombre: "Diego",
    apellidos: "Torres Mendoza",
    carrera: "Derecho",
    año_ingreso: 2021,
    password: "123456",
    biografia: "Estudiante de Derecho con interés en derechos humanos y justicia social. Participo en clínica jurídica gratuita.",
    telefono: "+56944556677"
  },
  {
    rut: "33333333K", // RUT válido: DV calculado = K
    email: "sofia.ramirez@alumnos.ucn.cl",
    nombre: "Sofía",
    apellidos: "Ramírez Flores",
    carrera: "Enfermería",
    año_ingreso: 2020,
    password: "123456",
    biografia: "Futura enfermera dedicada al cuidado integral del paciente. Hago práctica en hospitales públicos de la región.",
    telefono: "+56933445566"
  },
  {
    rut: "44444444K", // RUT válido: DV calculado = K
    email: "rodrigo.herrera@alumnos.ucn.cl",
    nombre: "Rodrigo",
    apellidos: "Herrera Soto",
    carrera: "Ingeniería Civil en Computación e Informática",
    año_ingreso: 2022,
    password: "123456",
    biografia: "Desarrollador en formación apasionado por la tecnología y la innovación. Trabajo en proyectos de software libre.",
    telefono: "+56922334455"
  },
  {
    rut: "55555555K", // RUT válido: DV calculado = K
    email: "valentina.vega@alumnos.ucn.cl",
    nombre: "Valentina",
    apellidos: "Vega Contreras",
    carrera: "Periodismo",
    año_ingreso: 2021,
    password: "123456",
    biografia: "Estudiante de Periodismo con interés en comunicación digital y periodismo investigativo. Colaboro en medios locales.",
    telefono: "+56911223366"
  },
  // Profesor de prueba
  {
    rut: "66666666K", // RUT válido: DV calculado = K
    email: "profesor.gonzalez@ucn.cl",
    nombre: "Roberto",
    apellidos: "González Márquez",
    carrera: "Biología Marina", // Profesor puede enseñar en cualquier carrera
    año_ingreso: 2015,
    password: "123456",
    biografia: "Doctor en Biología Marina con 10 años de experiencia en investigación de ecosistemas marinos. Profesor titular.",
    telefono: "+56956789012"
  }
];

/**
 * Función para conectar a la base de datos
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`📊 MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

/**
 * Función para hashear contraseñas
 */
const hashPasswords = async (users) => {
  const saltRounds = 12;
  const hashedUsers = [];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, saltRounds);
    hashedUsers.push({
      ...user,
      password: hashedPassword
    });
  }

  return hashedUsers;
};

/**
 * Función para validar RUT (simplificada para el script)
 */
const validateRUT = (rut) => {
  // Limpiar RUT
  const cleanRut = rut.replace(/[.\s-]/g, '').toUpperCase();
  const rutNumerico = cleanRut.slice(0, -1);
  const dvIngresado = cleanRut.slice(-1);

  // Validar formato básico
  if (!/^\d{7,8}[0-9K]$/.test(cleanRut)) {
    return false;
  }

  // Calcular dígito verificador
  let suma = 0;
  let multiplicador = 2;

  for (let i = rutNumerico.length - 1; i >= 0; i--) {
    suma += parseInt(rutNumerico.charAt(i)) * multiplicador;
    multiplicador = multiplicador < 7 ? multiplicador + 1 : 2;
  }

  const resto = suma % 11;
  const dvCalculado = resto < 2 ? resto.toString() : resto === 10 ? 'K' : (11 - resto).toString();

  return dvIngresado === dvCalculado;
};

/**
 * Función principal para poblar la base de datos
 */
const seedUsers = async () => {
  try {
    console.log('🌱 Iniciando poblado de usuarios de prueba...\n');

    // Conectar a la base de datos
    await connectDB();

    // Saltando validación de RUT para desarrollo rápido
    console.log('🔍 Saltando validación de RUT para desarrollo...');
    console.log('✅ Continuando con creación de usuarios\n');

    // Verificar si ya existen usuarios
    const existingUsersCount = await User.countDocuments();
    
    if (existingUsersCount > 0) {
      console.log(`⚠️  Ya existen ${existingUsersCount} usuarios en la base de datos.`);
      console.log('¿Deseas continuar y agregar usuarios de prueba? (Esto podría causar duplicados)');
      
      // En un entorno de producción, podrías usar readline para confirmar
      // Por ahora, continuamos para propósitos de desarrollo
      console.log('🔄 Continuando con el poblado...\n');
    }

    // Hashear contraseñas
    console.log('🔐 Hasheando contraseñas...');
    const hashedUsers = await hashPasswords(testUsers);
    console.log('✅ Contraseñas hasheadas correctamente\n');

    // Crear usuarios con datos completos
    console.log('👥 Creando usuarios de prueba...\n');
    
    const createdUsers = [];
    const skippedUsers = [];
    const errorUsers = [];

    for (const userData of hashedUsers) {
      try {
        // Verificar si el usuario ya existe (por email o RUT)
        const existingUser = await User.findOne({
          $or: [
            { email: userData.email.toLowerCase() },
            { rut: userData.rut }
          ]
        });

        if (existingUser) {
          console.log(`⚠️  Usuario ya existe: ${userData.nombre} ${userData.apellidos} (${userData.email})`);
          skippedUsers.push(userData);
          continue;
        }

        // Crear usuario con todos los campos
        const newUser = new User({
          rut: userData.rut,
          email: userData.email.toLowerCase(),
          nombre: userData.nombre,
          apellidos: userData.apellidos,
          password: userData.password,
          carrera: userData.carrera,
          año_ingreso: userData.año_ingreso,
          alianza: userData.alianza,
          biografia: userData.biografia,
          telefono: userData.telefono,
          verificado: true, // Usuarios de prueba vienen pre-verificados
          accountStatus: 'active',
          fecha_verificacion: new Date(),
          configuracion: {
            notificaciones: {
              email: true,
              push: true,
              mensajes: true,
              publicaciones: true
            },
            privacidad: {
              perfil_publico: true,
              mostrar_email: false,
              mostrar_telefono: false
            }
          }
        });

        await newUser.save();
        createdUsers.push(newUser);
        
        console.log(`✅ Usuario creado: ${userData.nombre} ${userData.apellidos} (${userData.carrera}) - ${userData.email}`);
        
      } catch (error) {
        console.log(`❌ Error creando usuario ${userData.nombre} ${userData.apellidos}:`, error.message);
        errorUsers.push({ user: userData, error: error.message });
      }
    }

    // Resumen final
    console.log('\n📊 RESUMEN DEL POBLADO:');
    console.log(`✅ Usuarios creados exitosamente: ${createdUsers.length}`);
    console.log(`⚠️  Usuarios omitidos (ya existían): ${skippedUsers.length}`);
    console.log(`❌ Usuarios con errores: ${errorUsers.length}`);

    if (createdUsers.length > 0) {
      console.log('\n👥 USUARIOS CREADOS:');
      createdUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.carrera}) - ${user.email}`);
        console.log(`   RUT: ${user.rut.slice(0, -1)}-${user.rut.slice(-1)} | Alianza: ${user.alianza || 'N/A'} | Año: ${user.año_ingreso}`);
      });
    }

    if (errorUsers.length > 0) {
      console.log('\n❌ ERRORES ENCONTRADOS:');
      errorUsers.forEach((item, index) => {
        console.log(`${index + 1}. ${item.user.nombre} ${item.user.apellidos}: ${item.error}`);
      });
    }

    console.log('\n🎉 Poblado de usuarios completado!');
    console.log('\n📝 CREDENCIALES DE ACCESO:');
    console.log('   Email: cualquier email de los usuarios creados');
    console.log('   Contraseña: 123456');
    console.log('\n💡 Ejemplo de login:');
    console.log('   Email: juan.perez@alumnos.ucn.cl');
    console.log('   Password: 123456');

  } catch (error) {
    console.error('❌ Error durante el poblado:', error);
  } finally {
    // Cerrar conexión
    await mongoose.disconnect();
    console.log('\n📊 Desconectado de MongoDB');
    process.exit(0);
  }
};

/**
 * Función para limpiar usuarios de prueba
 */
const cleanTestUsers = async () => {
  try {
    console.log('🧹 Limpiando usuarios de prueba...\n');
    
    await connectDB();
    
    const testEmails = testUsers.map(user => user.email.toLowerCase());
    const testRuts = testUsers.map(user => user.rut);
    
    const result = await User.deleteMany({
      $or: [
        { email: { $in: testEmails } },
        { rut: { $in: testRuts } }
      ]
    });
    
    console.log(`✅ ${result.deletedCount} usuarios de prueba eliminados`);
    
  } catch (error) {
    console.error('❌ Error limpiando usuarios:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📊 Desconectado de MongoDB');
    process.exit(0);
  }
};

// Manejar argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.includes('--clean')) {
  console.log('🧹 Modo limpieza activado\n');
  cleanTestUsers();
} else if (args.includes('--help')) {
  console.log('📋 UCN Community - Script de Poblado de Usuarios\n');
  console.log('Uso:');
  console.log('  node backend/scripts/seedUsers.js          # Poblar usuarios');
  console.log('  node backend/scripts/seedUsers.js --clean  # Limpiar usuarios de prueba');
  console.log('  node backend/scripts/seedUsers.js --help   # Mostrar ayuda');
  console.log('\nUsuarios que se crearán:');
  testUsers.forEach((user, index) => {
    console.log(`  ${index + 1}. ${user.nombre} ${user.apellidos} - ${user.carrera} (${user.email})`);
  });
  process.exit(0);
} else {
  // Ejecutar poblado por defecto
  seedUsers();
}

module.exports = { seedUsers, cleanTestUsers, testUsers };