const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSimple',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para obtener el número de usuarios que han leído el mensaje
messageSchema.virtual('readCount').get(function() {
  return this.readBy.length;
});

// Índices para mejorar performance
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ 'readBy.user': 1 });
messageSchema.index({ messageType: 1 });

// Método para marcar mensaje como leído por un usuario
messageSchema.methods.markAsRead = function(userId) {
  const alreadyRead = this.readBy.some(read => 
    read.user.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Método para verificar si un usuario ha leído el mensaje
messageSchema.methods.isReadByUser = function(userId) {
  return this.readBy.some(read => 
    read.user.toString() === userId.toString()
  );
};

// Middleware post-save para actualizar lastMessage y lastActivity del chat
messageSchema.post('save', async function(doc) {
  try {
    const ChatSimple = mongoose.model('ChatSimple');
    await ChatSimple.findByIdAndUpdate(doc.chat, {
      lastMessage: doc._id,
      lastActivity: new Date()
    });
  } catch (error) {
    console.error('Error updating chat lastMessage:', error);
  }
});

// Método estático para obtener mensajes de un chat con paginación
messageSchema.statics.getChatMessages = function(chatId, page = 1, limit = 50) {
  return this.find({ chat: chatId })
    .populate('sender', 'name email foto_perfil carrera')
    .populate('readBy.user', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Método estático para contar mensajes no leídos por usuario en un chat
messageSchema.statics.countUnreadMessages = function(chatId, userId) {
  return this.countDocuments({
    chat: chatId,
    'readBy.user': { $ne: userId }
  });
};

// Método estático para marcar todos los mensajes de un chat como leídos por un usuario
messageSchema.statics.markAllAsRead = function(chatId, userId) {
  return this.updateMany(
    { 
      chat: chatId,
      'readBy.user': { $ne: userId }
    },
    { 
      $push: { 
        readBy: { 
          user: userId, 
          readAt: new Date() 
        } 
      } 
    }
  );
};

const MessageSimple = mongoose.model('MessageSimple', messageSchema);

module.exports = MessageSimple;