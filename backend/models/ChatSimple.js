const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  chatName: {
    type: String,
    default: ''
  },
  isGroupChat: {
    type: Boolean,
    default: false
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para obtener el número de participantes
chatSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Índices para mejorar performance
chatSchema.index({ participants: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ isGroupChat: 1 });

// Middleware pre-save para actualizar lastActivity
chatSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastActivity = new Date();
  }
  next();
});

// Método para agregar participante
chatSchema.methods.addParticipant = function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    this.lastActivity = new Date();
  }
  return this.save();
};

// Método para remover participante
chatSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(
    participant => !participant.equals(userId)
  );
  this.lastActivity = new Date();
  return this.save();
};

// Método estático para encontrar chats por usuario
chatSchema.statics.findByUser = function(userId) {
  return this.find({ participants: userId })
    .populate('participants', 'name email foto_perfil carrera')
    .populate('lastMessage')
    .sort({ lastActivity: -1 });
};

// Método estático para crear chat privado entre dos usuarios
chatSchema.statics.createPrivateChat = function(user1Id, user2Id) {
  return this.create({
    participants: [user1Id, user2Id],
    isGroupChat: false,
    chatName: ''
  });
};

// Método estático para crear chat grupal
chatSchema.statics.createGroupChat = function(participantIds, chatName) {
  return this.create({
    participants: participantIds,
    isGroupChat: true,
    chatName: chatName
  });
};

const ChatSimple = mongoose.model('ChatSimple', chatSchema);

module.exports = ChatSimple;