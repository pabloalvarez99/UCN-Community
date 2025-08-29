const express = require('express');
const User = require('../models/User');
const mongoose = require('mongoose');
const { createResponse } = require('../utils/helpers');
const router = express.Router();

/**
 * RUTAS DE TESTING MONGODB - UCN COMMUNITY
 * Para verificar que MongoDB funciona correctamente
 */

/**
 * GET /api/test/db-status
 * Estado de la conexión MongoDB
 */
router.get('/db-status', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const stateNames = {
      0: 'desconectado',
      1: 'conectado', 
      2: 'conectando',
      3: 'desconectando'
    };

    // Verificar conexión con ping
    await mongoose.connection.db.admin().ping();

    // Obtener estadísticas de la base de datos
    const stats = await mongoose.connection.db.stats();
    const collections = await mongoose.connection.db.listCollections().toArray();

    res.json(createResponse(true, 'Estado de MongoDB obtenido correctamente', {
      conexion: {
        estado: stateNames[dbState],
        host: mongoose.connection.host,
        puerto: mongoose.connection.port,
        nombre_db: mongoose.connection.name
      },
      estadisticas: {
        colecciones: stats.collections,
        documentos: stats.objects,
        tamaño_datos: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
        tamaño_indices: `${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`
      },
      colecciones_disponibles: collections.map(col => ({
        nombre: col.name,
        tipo: col.type
      }))
    }));

  } catch (error) {
    console.error('Error verificando estado de MongoDB:', error);
    res.status(500).json(createResponse(false, 'Error verificando estado de MongoDB', {
      error: error.message,
      conexion: {
        estado: 'error',
        host: mongoose.connection.host || 'no disponible',
        puerto: mongoose.connection.port || 'no disponible'
      }
    }));
  }
});

/**
 * @route   GET /api/test/users
 * @desc    Listar todos los usuarios UCN
 * @access  Public (solo para desarrollo)
 */
router.get('/users', async (req, res) => {
  try {
    const usuarios = await User.find({})
      .select('-password -verification_token -reset_password_token')
      .sort({ fecha_registro: -1 })
      .lean();

    const estadisticas = {
      total_usuarios: usuarios.length,
      usuarios_verificados: usuarios.filter(u => u.verificado).length,
      usuarios_activos: usuarios.filter(u => u.activo).length,
      usuarios_por_carrera: {},
      usuarios_por_año: {}
    };

    // Calcular distribución por carrera
    usuarios.forEach(usuario => {
      if (usuario.carrera) {
        estadisticas.usuarios_por_carrera[usuario.carrera] = 
          (estadisticas.usuarios_por_carrera[usuario.carrera] || 0) + 1;
      }
      if (usuario.año_ingreso) {
        estadisticas.usuarios_por_año[usuario.año_ingreso] = 
          (estadisticas.usuarios_por_año[usuario.año_ingreso] || 0) + 1;
      }
    });

    console.log(`🔍 [TEST] Consulta a usuarios - Total: ${usuarios.length} usuarios encontrados`);

    res.json(createResponse(true, 'Usuarios UCN obtenidos correctamente', {
      estadisticas,
      usuarios: usuarios.map(user => ({
        id: user._id,
        rut: user.rut,
        email: user.email,
        nombre_completo: `${user.nombre} ${user.apellidos}`,
        carrera: user.carrera,
        año_ingreso: user.año_ingreso,
        verificado: user.verificado,
        activo: user.activo,
        fecha_registro: user.fecha_registro,
        telefono: user.telefono?.replace(/(\+56)(\d{1})(\d{4})(\d{4})/, '+56 $2 $3 $4') || 'No proporcionado'
      }))
    }));

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json(createResponse(false, 'Error obteniendo usuarios de la base de datos', {
      error: error.message
    }));
  }
});

/**
 * @route   GET /api/test/users/:id
 * @desc    Obtener usuario específico por ID
 * @access  Public (solo para desarrollo)
 */
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Usuario encontrado',
      data: { user }
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/test/users-by-carrera/:carrera
 * Usuarios por carrera específica
 */
router.get('/users-by-carrera/:carrera', async (req, res) => {
  try {
    const carrera = decodeURIComponent(req.params.carrera);
    
    const usuarios = await User.find({ carrera: { $regex: new RegExp(carrera, 'i') } })
      .select('-password -verification_token -reset_password_token')
      .sort({ apellidos: 1, nombre: 1 })
      .lean();

    const estadisticas = {
      carrera_consultada: carrera,
      total_estudiantes: usuarios.length,
      estudiantes_verificados: usuarios.filter(u => u.verificado).length,
      estudiantes_activos: usuarios.filter(u => u.activo).length,
      años_representados: [...new Set(usuarios.map(u => u.año_ingreso))].sort()
    };

    console.log(`🔍 [TEST] Consulta por carrera '${carrera}' - ${usuarios.length} estudiantes encontrados`);

    res.json(createResponse(true, `Estudiantes de ${carrera} obtenidos correctamente`, {
      estadisticas,
      estudiantes: usuarios.map(user => ({
        id: user._id,
        rut: user.rut?.replace(/(\d{1,2})(\d{3})(\d{3})([\dK])/, '$1.$2.$3-$4') || 'No disponible',
        nombre_completo: `${user.nombre} ${user.apellidos}`,
        email: user.email,
        año_ingreso: user.año_ingreso,
        telefono: user.telefono || 'No proporcionado',
        verificado: user.verificado ? '✅ Verificado' : '⏳ Pendiente',
        estado: user.activo ? '🟢 Activo' : '🔴 Inactivo',
        fecha_registro: new Date(user.fecha_registro).toLocaleDateString('es-CL')
      }))
    }));

  } catch (error) {
    console.error('Error obteniendo usuarios por carrera:', error);
    res.status(500).json(createResponse(false, 'Error obteniendo estudiantes por carrera', {
      error: error.message,
      carrera_solicitada: req.params.carrera
    }));
  }
});

/**
 * GET /api/test/users-by-alianza/:alianza
 * Usuarios por alianza (Blanca/Azul) - RUTA HEREDADA
 * Nota: La funcionalidad de alianza fue removida del sistema, 
 * pero mantenemos la ruta para compatibilidad
 */
router.get('/users-by-alianza/:alianza', async (req, res) => {
  try {
    const alianza = req.params.alianza;
    
    console.log(`⚠️ [TEST] Consulta por alianza '${alianza}' - Funcionalidad removida del sistema`);

    res.json(createResponse(false, 'La funcionalidad de alianzas fue removida del sistema UCN Community', {
      alianza_solicitada: alianza,
      motivo: 'La variable alianza fue eliminada por solicitud del desarrollador',
      alternativas: [
        'Usar /api/test/users-by-carrera/:carrera para filtrar por carrera',
        'Usar /api/test/users para ver todos los usuarios',
        'Usar /api/test/statistics para ver estadísticas generales'
      ],
      fecha_remocion: '2024-08-29',
      estado_funcionalidad: 'REMOVIDA'
    }));

  } catch (error) {
    console.error('Error en ruta de alianza removida:', error);
    res.status(500).json(createResponse(false, 'Error en ruta de alianza (funcionalidad removida)', {
      error: error.message
    }));
  }
});

/**
 * POST /api/test/create-user
 * Crear usuario de prueba rápido
 */
router.post('/create-user', async (req, res) => {
  try {
    const {
      rut = '99999999K',
      email = `test.${Date.now()}@alumnos.ucn.cl`,
      nombre = 'Usuario',
      apellidos = 'De Prueba',
      password = '123456',
      carrera = 'Ingeniería Civil en Computación e Informática',
      año_ingreso = 2024
    } = req.body;

    // Verificar si ya existe el usuario
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { rut }]
    });

    if (existingUser) {
      return res.status(400).json(createResponse(false, 'Usuario ya existe', {
        conflicto: existingUser.email === email.toLowerCase() ? 'email' : 'rut',
        usuario_existente: {
          email: existingUser.email,
          rut: existingUser.rut,
          nombre: `${existingUser.nombre} ${existingUser.apellidos}`
        }
      }));
    }

    // Crear usuario de prueba
    const nuevoUsuario = new User({
      rut,
      email: email.toLowerCase(),
      nombre,
      apellidos,
      password,
      carrera,
      año_ingreso,
      verificado: true,
      activo: true,
      fecha_verificacion: new Date(),
      biografia: `Usuario de prueba creado automáticamente el ${new Date().toLocaleDateString('es-CL')}`,
      telefono: `+56${Math.floor(Math.random() * 90000000) + 10000000}`
    });

    await nuevoUsuario.save();

    console.log(`✅ [TEST] Usuario de prueba creado: ${email}`);

    res.status(201).json(createResponse(true, 'Usuario de prueba creado exitosamente', {
      usuario_creado: {
        id: nuevoUsuario._id,
        rut: nuevoUsuario.rut,
        email: nuevoUsuario.email,
        nombre_completo: `${nuevoUsuario.nombre} ${nuevoUsuario.apellidos}`,
        carrera: nuevoUsuario.carrera,
        año_ingreso: nuevoUsuario.año_ingreso,
        verificado: nuevoUsuario.verificado,
        activo: nuevoUsuario.activo,
        fecha_creacion: nuevoUsuario.fecha_registro
      },
      credenciales_acceso: {
        email: nuevoUsuario.email,
        password: '123456',
        nota: 'Usar estas credenciales para hacer login'
      }
    }));

  } catch (error) {
    console.error('Error creando usuario de prueba:', error);
    
    let errorMessage = 'Error creando usuario de prueba';
    if (error.code === 11000) {
      errorMessage = 'Ya existe un usuario con ese email o RUT';
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Datos de usuario inválidos';
    }

    res.status(500).json(createResponse(false, errorMessage, {
      error: error.message,
      tipo_error: error.name,
      campos_requeridos: ['rut', 'email', 'nombre', 'apellidos', 'password', 'carrera']
    }));
  }
});

/**
 * GET /api/test/statistics
 * Estadísticas completas UCN
 */
router.get('/statistics', async (req, res) => {
  try {
    const usuarios = await User.find({}).lean();
    
    // Estadísticas básicas
    const totalUsuarios = usuarios.length;
    const usuariosVerificados = usuarios.filter(u => u.verificado).length;
    const usuariosActivos = usuarios.filter(u => u.activo).length;

    // Distribución por carrera
    const distribucionCarrera = {};
    usuarios.forEach(u => {
      if (u.carrera) {
        distribucionCarrera[u.carrera] = (distribucionCarrera[u.carrera] || 0) + 1;
      }
    });

    // Distribución por año de ingreso
    const distribucionAño = {};
    usuarios.forEach(u => {
      if (u.año_ingreso) {
        distribucionAño[u.año_ingreso] = (distribucionAño[u.año_ingreso] || 0) + 1;
      }
    });

    // Top 5 carreras más populares
    const top5Carreras = Object.entries(distribucionCarrera)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([carrera, cantidad]) => ({ carrera, estudiantes: cantidad }));

    // Usuarios registrados en los últimos 7 días
    const ultimaSemana = new Date();
    ultimaSemana.setDate(ultimaSemana.getDate() - 7);
    const nuevosUsuarios = usuarios.filter(u => 
      new Date(u.fecha_registro) > ultimaSemana
    ).length;

    console.log(`📊 [TEST] Estadísticas UCN - ${totalUsuarios} usuarios total`);

    res.json(createResponse(true, 'Estadísticas UCN obtenidas correctamente', {
      resumen_general: {
        total_estudiantes_registrados: totalUsuarios,
        estudiantes_verificados: usuariosVerificados,
        estudiantes_activos: usuariosActivos,
        porcentaje_verificacion: `${((usuariosVerificados / totalUsuarios) * 100).toFixed(1)}%`,
        porcentaje_actividad: `${((usuariosActivos / totalUsuarios) * 100).toFixed(1)}%`,
        nuevos_esta_semana: nuevosUsuarios
      },
      distribucion_por_carrera: distribucionCarrera,
      distribucion_por_año_ingreso: distribucionAño,
      top_5_carreras_populares: top5Carreras,
      campus_info: {
        nombre: "Campus Guayacán - UCN",
        direccion: "Larrondo 1281, Coquimbo",
        region: "Región de Coquimbo",
        carreras_disponibles: Object.keys(distribucionCarrera).length,
        años_academicos_activos: Object.keys(distribucionAño).length
      },
      fecha_consulta: new Date().toISOString(),
      zona_horaria: 'America/Santiago'
    }));

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json(createResponse(false, 'Error obteniendo estadísticas UCN', {
      error: error.message
    }));
  }
});

/**
 * DELETE /api/test/cleanup
 * Limpiar usuarios de prueba (solo en desarrollo)
 */
router.delete('/cleanup', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json(createResponse(false, 'Operación no permitida en producción', {
        ambiente: 'production',
        motivo: 'La limpieza de usuarios solo está permitida en desarrollo'
      }));
    }

    // Eliminar usuarios de prueba (que contengan 'test' en el email)
    const resultado = await User.deleteMany({
      email: { $regex: /test/i }
    });

    console.log(`🧹 [TEST] Limpieza realizada - ${resultado.deletedCount} usuarios de prueba eliminados`);

    res.json(createResponse(true, 'Limpieza de usuarios de prueba completada', {
      usuarios_eliminados: resultado.deletedCount,
      criterio: 'Emails que contengan "test"',
      ambiente: process.env.NODE_ENV,
      fecha_limpieza: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Error en limpieza de usuarios:', error);
    res.status(500).json(createResponse(false, 'Error en limpieza de usuarios de prueba', {
      error: error.message
    }));
  }
});

module.exports = router;