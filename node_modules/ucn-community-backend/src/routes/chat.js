const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMyChats,
  createChat,
  getChatMessages,
  sendMessage
} = require('../controllers/chatControllerSimple');

// Aplicar middleware de autenticación a todas las rutas
router.use(protect);

// @route   GET /api/chats
// @desc    Obtener todos los chats del usuario logueado
// @access  Protected
router.get('/', getMyChats);

// @route   POST /api/chats
// @desc    Crear nuevo chat individual
// @access  Protected
router.post('/', createChat);

// @route   GET /api/chats/:chatId/messages
// @desc    Obtener mensajes de un chat específico
// @access  Protected
router.get('/:chatId/messages', getChatMessages);

// @route   POST /api/chats/:chatId/messages
// @desc    Enviar nuevo mensaje a un chat
// @access  Protected
router.post('/:chatId/messages', sendMessage);

module.exports = router;