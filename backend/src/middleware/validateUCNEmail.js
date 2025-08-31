/**
 * Middleware para validar emails institucionales UCN
 * Solo permite emails @alumnos.ucn.cl y @ucn.cl
 */

const validateUCNEmail = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'El email es obligatorio',
      errors: [{ field: 'email', message: 'Email requerido' }]
    });
  }

  // Validar formato de email básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Formato de email inválido',
      errors: [{ field: 'email', message: 'Formato de email inválido' }]
    });
  }

  // Validar dominios UCN permitidos
  const ucnDomains = ['@alumnos.ucn.cl', '@ucn.cl'];
  const isValidUCNEmail = ucnDomains.some(domain => 
    email.toLowerCase().endsWith(domain.toLowerCase())
  );

  if (!isValidUCNEmail) {
    return res.status(400).json({
      success: false,
      message: 'Solo se permiten emails institucionales UCN (@alumnos.ucn.cl o @ucn.cl)',
      errors: [{
        field: 'email',
        message: 'Email debe ser institucional (@alumnos.ucn.cl o @ucn.cl)'
      }]
    });
  }

  // Validar que no tenga caracteres especiales problemáticos
  const emailUser = email.split('@')[0];
  const validUserRegex = /^[a-zA-Z0-9._-]+$/;
  if (!validUserRegex.test(emailUser)) {
    return res.status(400).json({
      success: false,
      message: 'El email contiene caracteres no permitidos',
      errors: [{
        field: 'email',
        message: 'Solo se permiten letras, números, puntos, guiones y guiones bajos'
      }]
    });
  }

  // Validar longitud mínima del usuario
  if (emailUser.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'El email debe tener al menos 3 caracteres antes del @',
      errors: [{ field: 'email', message: 'Email demasiado corto' }]
    });
  }

  // Determinar el tipo de usuario basado en el dominio
  if (email.toLowerCase().endsWith('@alumnos.ucn.cl')) {
    req.userType = 'student';
  } else if (email.toLowerCase().endsWith('@ucn.cl')) {
    req.userType = 'professor';
  }

  next();
};

module.exports = validateUCNEmail;