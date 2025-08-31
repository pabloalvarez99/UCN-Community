const { createResponse } = require('../utils/helpers');

// Dominios universitarios válidos para UCN
const VALID_UCN_DOMAINS = [
  'alumnos.ucn.cl',
  'ucn.cl'
];

// Regex estricto para validar emails de UCN
const UCN_EMAIL_REGEX = /^[a-zA-Z0-9]+([._-]?[a-zA-Z0-9]+)*@(alumnos\.ucn\.cl|ucn\.cl)$/;

/**
 * Middleware para validar que el email sea de dominio UCN
 */
const validateUCNEmail = (req, res, next) => {
  const { email } = req.body;

  // Verificar que el email esté presente
  if (!email) {
    return res.status(400).json(createResponse(
      false, 
      'Email es requerido'
    ));
  }

  // Normalizar email (convertir a minúsculas y eliminar espacios)
  const normalizedEmail = email.toString().toLowerCase().trim();

  // Verificar formato con regex estricto
  if (!UCN_EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json(createResponse(
      false,
      'Debe usar un email institucional válido de UCN (@alumnos.ucn.cl o @ucn.cl)',
      null,
      {
        validDomains: VALID_UCN_DOMAINS,
        providedEmail: normalizedEmail,
        emailFormat: 'nombre.apellido@alumnos.ucn.cl o nombre.apellido@ucn.cl'
      }
    ));
  }

  // Extraer dominio del email
  const emailDomain = normalizedEmail.split('@')[1];

  // Verificar que el dominio esté en la lista de dominios válidos
  if (!VALID_UCN_DOMAINS.includes(emailDomain)) {
    return res.status(400).json(createResponse(
      false,
      'Dominio de email no autorizado. Solo se permiten emails de UCN',
      null,
      {
        providedDomain: emailDomain,
        validDomains: VALID_UCN_DOMAINS
      }
    ));
  }

  // Validaciones adicionales del formato
  const [localPart, domain] = normalizedEmail.split('@');

  // Validar parte local del email (antes del @)
  if (localPart.length < 3) {
    return res.status(400).json(createResponse(
      false,
      'La parte local del email debe tener al menos 3 caracteres'
    ));
  }

  if (localPart.length > 64) {
    return res.status(400).json(createResponse(
      false,
      'La parte local del email no puede exceder 64 caracteres'
    ));
  }

  // Validar que no contenga caracteres especiales no permitidos
  const invalidChars = /[^a-zA-Z0-9._-]/;
  if (invalidChars.test(localPart)) {
    return res.status(400).json(createResponse(
      false,
      'El email solo puede contener letras, números, puntos, guiones y guiones bajos'
    ));
  }

  // Validar que no comience o termine con punto, guión o guión bajo
  if (/^[._-]|[._-]$/.test(localPart)) {
    return res.status(400).json(createResponse(
      false,
      'El email no puede comenzar o terminar con punto, guión o guión bajo'
    ));
  }

  // Validar que no tenga puntos, guiones o guiones bajos consecutivos
  if (/[._-]{2,}/.test(localPart)) {
    return res.status(400).json(createResponse(
      false,
      'El email no puede tener caracteres especiales consecutivos'
    ));
  }

  // Determinar el tipo de usuario basado en el dominio
  let userType = 'student';
  if (domain === 'ucn.cl') {
    userType = 'faculty'; // Profesores y staff
  }

  // Agregar información adicional al request
  req.validatedEmail = {
    email: normalizedEmail,
    domain: domain,
    localPart: localPart,
    userType: userType
  };

  next();
};

/**
 * Middleware para verificar que el email no esté en lista negra
 */
const checkEmailBlacklist = async (req, res, next) => {
  const { email } = req.validatedEmail || req.body;
  
  // Lista de emails bloqueados (se puede mover a base de datos)
  const BLACKLISTED_EMAILS = [
    'test@alumnos.ucn.cl',
    'admin@alumnos.ucn.cl',
    'noreply@ucn.cl',
    'system@ucn.cl'
  ];

  const normalizedEmail = email.toLowerCase().trim();

  if (BLACKLISTED_EMAILS.includes(normalizedEmail)) {
    return res.status(403).json(createResponse(
      false,
      'Este email está restringido y no puede ser utilizado para registro'
    ));
  }

  next();
};

/**
 * Middleware para verificar que el dominio esté activo
 */
const checkDomainStatus = async (req, res, next) => {
  // En un entorno real, aquí se verificaría si los dominios están activos
  // Por ahora, asumimos que están activos
  
  const { domain } = req.validatedEmail || { domain: null };
  
  if (!domain) {
    return res.status(400).json(createResponse(
      false,
      'No se pudo validar el dominio del email'
    ));
  }

  // Simulación de verificación de dominio activo
  const ACTIVE_DOMAINS = VALID_UCN_DOMAINS;
  
  if (!ACTIVE_DOMAINS.includes(domain)) {
    return res.status(403).json(createResponse(
      false,
      'El dominio de email no está activo actualmente',
      null,
      {
        domain: domain,
        activeDomains: ACTIVE_DOMAINS
      }
    ));
  }

  next();
};

/**
 * Middleware para logs de intentos de acceso
 */
const logEmailValidation = (req, res, next) => {
  const { email } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  console.log(`[EMAIL_VALIDATION] ${new Date().toISOString()} - IP: ${clientIP} - Email: ${email} - UserAgent: ${userAgent}`);
  
  next();
};

/**
 * Función helper para validar email formato (uso interno)
 */
const isValidUCNEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  const normalizedEmail = email.toLowerCase().trim();
  return UCN_EMAIL_REGEX.test(normalizedEmail);
};

/**
 * Función helper para extraer información del email
 */
const parseUCNEmail = (email) => {
  if (!isValidUCNEmail(email)) return null;
  
  const normalizedEmail = email.toLowerCase().trim();
  const [localPart, domain] = normalizedEmail.split('@');
  
  return {
    email: normalizedEmail,
    localPart: localPart,
    domain: domain,
    userType: domain === 'ucn.cl' ? 'faculty' : 'student',
    isValid: true
  };
};

module.exports = {
  validateUCNEmail,
  checkEmailBlacklist,
  checkDomainStatus,
  logEmailValidation,
  isValidUCNEmail,
  parseUCNEmail,
  VALID_UCN_DOMAINS,
  UCN_EMAIL_REGEX
};