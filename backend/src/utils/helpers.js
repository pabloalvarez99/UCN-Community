const jwt = require('jsonwebtoken');

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });

  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE,
  });

  return { accessToken, refreshToken };
};

const sanitizeUser = (user) => {
  const userObject = user.toObject ? user.toObject() : user;
  const { password, __v, ...sanitizedUser } = userObject;
  return sanitizedUser;
};

const generateRandomCode = (length = 6) => {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const createResponse = (success = true, message = '', data = null, error = null) => {
  return {
    success,
    message,
    ...(data && { data }),
    ...(error && { error }),
    timestamp: new Date().toISOString()
  };
};

const logAction = (action, user, details = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${action} - Usuario: ${user} - ${details}`);
};

module.exports = {
  asyncHandler,
  generateTokens,
  sanitizeUser,
  generateRandomCode,
  validateEmail,
  validatePassword,
  formatDate,
  createResponse,
  logAction
};