const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { validateRutFormat } = require('../middleware/validateRUT');

/**
 * Generar tokens JWT
 * @param {string} userId - ID del usuario
 * @returns {object} - { accessToken, refreshToken, tokenExpiry }
 */
const generateTokens = (userId) => {
  const payload = { id: userId };
  
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  
  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  // Calcular fecha de expiración
  const tokenExpiry = new Date();
  tokenExpiry.setMinutes(tokenExpiry.getMinutes() + 15); // 15 minutos por defecto

  return {
    accessToken,
    refreshToken,
    tokenExpiry: tokenExpiry.toISOString()
  };
};

/**
 * Generar código de verificación de email
 * @returns {string} - Código de 6 dígitos
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Registrar nuevo usuario
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const {
      rut,
      rutLimpio,
      rutFormateado,
      email,
      nombre,
      apellidos,
      carrera,
      carreraValida,
      facultad,
      password,
      año_ingreso,
      alianza,
      telefono,
      biografia
    } = req.body;

    // Validaciones adicionales
    if (!nombre || !apellidos) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y apellidos son obligatorios',
        errors: [
          { field: 'nombre', message: 'Nombre requerido' },
          { field: 'apellidos', message: 'Apellidos requeridos' }
        ]
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres',
        errors: [{ field: 'password', message: 'Contraseña debe tener al menos 6 caracteres' }]
      });
    }

    // Validar año de ingreso
    if (año_ingreso && (año_ingreso < 2018 || año_ingreso > 2025)) {
      return res.status(400).json({
        success: false,
        message: 'Año de ingreso debe estar entre 2018 y 2025',
        errors: [{ field: 'año_ingreso', message: 'Año de ingreso fuera del rango válido' }]
      });
    }

    // Verificar si el usuario ya existe por email
    const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta con este email',
        errors: [{ field: 'email', message: 'Email ya registrado' }]
      });
    }

    // Verificar si el usuario ya existe por RUT
    const existingUserByRut = await User.findOne({ rut: rutLimpio });
    if (existingUserByRut) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta con este RUT',
        errors: [{ field: 'rut', message: 'RUT ya registrado' }]
      });
    }

    // Hashear la contraseña
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generar código de verificación de email
    const emailVerificationCode = generateVerificationCode();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Determinar el rol basado en el tipo de email
    const role = req.userType || 'student'; // Viene del middleware validateUCNEmail

    // Crear el usuario
    const newUser = new User({
      rut: rutLimpio,
      email: email.toLowerCase(),
      nombre: nombre.trim(),
      apellidos: apellidos.trim(),
      password: hashedPassword,
      carrera: carreraValida,
      role: role,
      año_ingreso: año_ingreso || new Date().getFullYear(),
      alianza: alianza || null,
      telefono: telefono?.trim() || null,
      biografia: biografia?.trim() || null,
      verificado: false,
      emailVerificationCode,
      emailVerificationExpires,
      accountStatus: 'pending_verification',
      fecha_registro: new Date(),
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

    // TODO: Enviar email de verificación
    console.log(`Código de verificación para ${email}: ${emailVerificationCode}`);

    // Generar tokens
    const tokens = generateTokens(newUser._id);

    // Preparar respuesta del usuario (sin datos sensibles)
    const userResponse = {
      id: newUser._id,
      rut: `${newUser.rut.slice(0, -1)}-${newUser.rut.slice(-1)}`,
      email: newUser.email,
      nombre: newUser.nombre,
      apellidos: newUser.apellidos,
      name: newUser.name,
      carrera: newUser.carrera,
      facultad: newUser.facultad,
      role: newUser.role,
      año_ingreso: newUser.año_ingreso,
      campus: newUser.campus,
      verificado: newUser.verificado,
      accountStatus: newUser.accountStatus,
      fecha_registro: newUser.fecha_registro
    };

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.',
      data: {
        user: userResponse,
        ...tokens,
        requiresEmailVerification: true
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    
    // Manejar errores de validación de MongoDB
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      errors: [{ field: 'server', message: 'Error interno del servidor' }]
    });
  }
};

/**
 * Iniciar sesión
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password, remember_me } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son obligatorios',
        errors: [
          { field: 'email', message: 'Email requerido' },
          { field: 'password', message: 'Contraseña requerida' }
        ]
      });
    }

    // Buscar usuario por email (incluir password)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +emailVerificationCode');

    // Timing attack protection: siempre hacer el hash comparison
    const dummyHash = '$2b$12$dummyhashtopreventtimingattacks';
    const passwordToCompare = user ? user.password : dummyHash;
    const passwordIsValid = await bcrypt.compare(password, passwordToCompare);

    if (!user || !passwordIsValid) {
      // Incrementar intentos fallidos si el usuario existe
      if (user) {
        await user.incrementLoginAttempts();
      }

      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        errors: [{ field: 'credentials', message: 'Email o contraseña incorrectos' }]
      });
    }

    // Verificar si la cuenta está bloqueada
    if (user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Cuenta bloqueada por múltiples intentos fallidos. Intenta de nuevo más tarde.',
        errors: [{ field: 'account', message: 'Cuenta temporalmente bloqueada' }]
      });
    }

    // Verificar estado de la cuenta
    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Cuenta suspendida. Contacta al administrador.',
        errors: [{ field: 'account', message: 'Cuenta suspendida' }]
      });
    }

    if (!user.activo) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta inactiva. Contacta al administrador.',
        errors: [{ field: 'account', message: 'Cuenta inactiva' }]
      });
    }

    // Limpiar intentos fallidos en login exitoso
    await user.resetLoginAttempts();
    
    user.last_login = new Date();
    user.accountStatus = user.verificado ? 'active' : 'pending_verification';
    await user.save();

    // Generar tokens (más larga duración si remember_me es true)
    let tokens;
    if (remember_me) {
      const payload = { id: user._id };
      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
      const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '90d' });
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 30);
      
      tokens = { accessToken, refreshToken, tokenExpiry: tokenExpiry.toISOString() };
    } else {
      tokens = generateTokens(user._id);
    }

    // Preparar respuesta del usuario
    const userResponse = {
      id: user._id,
      rut: `${user.rut.slice(0, -1)}-${user.rut.slice(-1)}`,
      email: user.email,
      nombre: user.nombre,
      apellidos: user.apellidos,
      name: user.name,
      carrera: user.carrera,
      facultad: user.facultad,
      role: user.role,
      año_ingreso: user.año_ingreso,
      campus: user.campus,
      verificado: user.verificado,
      accountStatus: user.accountStatus,
      foto_perfil: user.foto_perfil,
      biografia: user.biografia,
      alianza: user.alianza,
      last_login: user.last_login,
      fecha_registro: user.fecha_registro
    };

    res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: userResponse,
        ...tokens,
        requiresEmailVerification: !user.verificado
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      errors: [{ field: 'server', message: 'Error interno del servidor' }]
    });
  }
};

/**
 * Obtener perfil del usuario autenticado
 * @route GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        errors: [{ field: 'user', message: 'Usuario no encontrado' }]
      });
    }

    const userResponse = {
      id: user._id,
      rut: `${user.rut.slice(0, -1)}-${user.rut.slice(-1)}`,
      email: user.email,
      nombre: user.nombre,
      apellidos: user.apellidos,
      name: user.name,
      carrera: user.carrera,
      facultad: user.facultad,
      role: user.role,
      año_ingreso: user.año_ingreso,
      campus: user.campus,
      verificado: user.verificado,
      accountStatus: user.accountStatus,
      foto_perfil: user.foto_perfil,
      biografia: user.biografia,
      telefono: user.telefono,
      alianza: user.alianza,
      last_login: user.last_login,
      fecha_registro: user.fecha_registro,
      configuracion: user.configuracion,
      añoAcademico: user.añoAcademico
    };

    res.status(200).json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      errors: [{ field: 'server', message: 'Error interno del servidor' }]
    });
  }
};

/**
 * Verificar email con código
 * @route POST /api/auth/verify-email
 */
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email y código son obligatorios',
        errors: [
          { field: 'email', message: 'Email requerido' },
          { field: 'code', message: 'Código de verificación requerido' }
        ]
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+emailVerificationCode +emailVerificationExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        errors: [{ field: 'email', message: 'Email no registrado' }]
      });
    }

    if (user.verificado) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está verificado',
        errors: [{ field: 'email', message: 'Email ya verificado' }]
      });
    }

    if (!user.emailVerificationCode || user.emailVerificationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Código de verificación expirado o inválido',
        errors: [{ field: 'code', message: 'Código expirado o inválido' }]
      });
    }

    if (user.emailVerificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Código de verificación incorrecto',
        errors: [{ field: 'code', message: 'Código incorrecto' }]
      });
    }

    // Verificar email
    user.verificado = true;
    user.accountStatus = 'active';
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    user.fecha_verificacion = new Date();

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verificado exitosamente',
      data: {
        user: {
          id: user._id,
          email: user.email,
          verificado: user.verificado,
          accountStatus: user.accountStatus,
          fecha_verificacion: user.fecha_verificacion
        }
      }
    });

  } catch (error) {
    console.error('Error verificando email:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      errors: [{ field: 'server', message: 'Error interno del servidor' }]
    });
  }
};

/**
 * Reenviar código de verificación
 * @route POST /api/auth/resend-verification
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email es obligatorio',
        errors: [{ field: 'email', message: 'Email requerido' }]
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+emailVerificationCode +emailVerificationExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        errors: [{ field: 'email', message: 'Email no registrado' }]
      });
    }

    if (user.verificado) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está verificado',
        errors: [{ field: 'email', message: 'Email ya verificado' }]
      });
    }

    // Generar nuevo código
    const emailVerificationCode = generateVerificationCode();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.emailVerificationCode = emailVerificationCode;
    user.emailVerificationExpires = emailVerificationExpires;

    await user.save();

    // TODO: Enviar email de verificación
    console.log(`Nuevo código de verificación para ${email}: ${emailVerificationCode}`);

    res.status(200).json({
      success: true,
      message: 'Código de verificación reenviado exitosamente',
      data: {
        email: user.email,
        codeExpires: emailVerificationExpires
      }
    });

  } catch (error) {
    console.error('Error reenviando verificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      errors: [{ field: 'server', message: 'Error interno del servidor' }]
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  verifyEmail,
  resendVerification
};