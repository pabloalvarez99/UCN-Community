const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  destinatario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El destinatario es requerido'],
    index: true
  },
  emisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El emisor es requerido']
  },
  tipo: {
    type: String,
    enum: [
      'mensaje_nuevo',
      'mencion',
      'like_post',
      'comentario_post',
      'respuesta_comentario',
      'nuevo_seguidor',
      'post_destacado',
      'chat_agregado',
      'evento_recordatorio',
      'moderacion_post',
      'verificacion_cuenta',
      'sistema'
    ],
    required: [true, 'El tipo de notificación es requerido'],
    index: true
  },
  titulo: {
    type: String,
    required: [true, 'El título es requerido'],
    maxlength: [100, 'El título no puede exceder 100 caracteres'],
    trim: true
  },
  mensaje: {
    type: String,
    required: [true, 'El mensaje es requerido'],
    maxlength: [500, 'El mensaje no puede exceder 500 caracteres'],
    trim: true
  },
  leida: {
    type: Boolean,
    default: false,
    index: true
  },
  fecha_lectura: {
    type: Date
  },
  fecha_creacion: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  // Referencias a objetos relacionados
  referencia: {
    tipo: {
      type: String,
      enum: ['post', 'chat', 'message', 'user', 'comment'],
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'referencia.tipo_modelo'
    },
    tipo_modelo: {
      type: String,
      enum: ['Post', 'Chat', 'Message', 'User'],
      required: true
    }
  },
  // Configuración de entrega
  canales: {
    push: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: false
    },
    en_app: {
      type: Boolean,
      default: true
    }
  },
  // Estado de entrega
  entregada: {
    push: {
      entregado: {
        type: Boolean,
        default: false
      },
      fecha_entrega: {
        type: Date
      },
      token_dispositivo: {
        type: String
      }
    },
    email: {
      enviado: {
        type: Boolean,
        default: false
      },
      fecha_envio: {
        type: Date
      },
      entregado: {
        type: Boolean,
        default: false
      },
      fecha_entrega: {
        type: Date
      }
    }
  },
  // Prioridad
  prioridad: {
    type: String,
    enum: ['baja', 'normal', 'alta', 'urgente'],
    default: 'normal',
    index: true
  },
  // Agrupación de notificaciones similares
  grupo: {
    type: String,
    index: true
  },
  // Datos adicionales específicos del tipo
  datos_extra: {
    type: mongoose.Schema.Types.Mixed
  },
  // TTL para auto-eliminación
  expira_en: {
    type: Date,
    default: function() {
      // Auto-eliminar notificaciones después de 30 días
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    },
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuales
notificationSchema.virtual('tiempo_transcurrido').get(function() {
  const now = new Date();
  const created = new Date(this.fecha_creacion);
  const diffTime = Math.abs(now - created);
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) {
    return 'Ahora';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else {
    return `${diffDays}d`;
  }
});

notificationSchema.virtual('icono').get(function() {
  const iconos = {
    mensaje_nuevo: '💬',
    mencion: '@',
    like_post: '❤️',
    comentario_post: '💭',
    respuesta_comentario: '↩️',
    nuevo_seguidor: '👥',
    post_destacado: '⭐',
    chat_agregado: '👥',
    evento_recordatorio: '📅',
    moderacion_post: '⚠️',
    verificacion_cuenta: '✅',
    sistema: '🔔'
  };
  return iconos[this.tipo] || '🔔';
});

// Métodos
notificationSchema.methods.marcarComoLeida = function() {
  this.leida = true;
  this.fecha_lectura = new Date();
  return this.save();
};

notificationSchema.methods.marcarComoEntregada = function(canal, detalles = {}) {
  if (canal === 'push') {
    this.entregada.push.entregado = true;
    this.entregada.push.fecha_entrega = new Date();
    if (detalles.token_dispositivo) {
      this.entregada.push.token_dispositivo = detalles.token_dispositivo;
    }
  } else if (canal === 'email') {
    this.entregada.email.enviado = true;
    this.entregada.email.fecha_envio = new Date();
    if (detalles.entregado) {
      this.entregada.email.entregado = true;
      this.entregada.email.fecha_entrega = new Date();
    }
  }
  return this.save();
};

// Métodos estáticos
notificationSchema.statics.crearNotificacion = async function(data) {
  const {
    destinatario,
    emisor,
    tipo,
    titulo,
    mensaje,
    referencia,
    prioridad = 'normal',
    datos_extra = {}
  } = data;
  
  // Verificar si el usuario tiene habilitadas las notificaciones de este tipo
  const User = mongoose.model('User');
  const usuario = await User.findById(destinatario);
  
  if (!usuario || !usuario.isActive) {
    return null;
  }
  
  // Crear agrupación para notificaciones similares
  const grupo = `${tipo}_${emisor}_${referencia.tipo}_${referencia.id}`;
  
  // Verificar si ya existe una notificación similar no leída
  const existingNotification = await this.findOne({
    destinatario,
    grupo,
    leida: false
  });
  
  if (existingNotification) {
    // Actualizar la notificación existente en lugar de crear una nueva
    existingNotification.mensaje = mensaje;
    existingNotification.fecha_creacion = new Date();
    existingNotification.datos_extra = { ...existingNotification.datos_extra, ...datos_extra };
    return await existingNotification.save();
  }
  
  // Crear nueva notificación
  const notification = new this({
    destinatario,
    emisor,
    tipo,
    titulo,
    mensaje,
    referencia,
    prioridad,
    grupo,
    datos_extra
  });
  
  return await notification.save();
};

notificationSchema.statics.marcarTodasComoLeidas = async function(userId) {
  return await this.updateMany(
    { destinatario: userId, leida: false },
    { leida: true, fecha_lectura: new Date() }
  );
};

notificationSchema.statics.obtenerNoLeidas = async function(userId, limite = 50) {
  return await this.find({
    destinatario: userId,
    leida: false
  })
  .populate('emisor', 'name foto_perfil')
  .sort({ fecha_creacion: -1 })
  .limit(limite);
};

notificationSchema.statics.obtenerRecientes = async function(userId, limite = 20) {
  return await this.find({
    destinatario: userId
  })
  .populate('emisor', 'name foto_perfil')
  .sort({ fecha_creacion: -1 })
  .limit(limite);
};

notificationSchema.statics.contarNoLeidas = async function(userId) {
  return await this.countDocuments({
    destinatario: userId,
    leida: false
  });
};

notificationSchema.statics.limpiarAntiguas = async function(diasAntiguedad = 30) {
  const fechaCorte = new Date(Date.now() - (diasAntiguedad * 24 * 60 * 60 * 1000));
  return await this.deleteMany({
    fecha_creacion: { $lt: fechaCorte },
    leida: true
  });
};

// Middlewares
notificationSchema.pre('save', function(next) {
  // Generar grupo si no existe
  if (!this.grupo) {
    this.grupo = `${this.tipo}_${this.emisor}_${this.referencia.tipo}_${this.referencia.id}`;
  }
  next();
});

// Índices
notificationSchema.index({ destinatario: 1, leida: 1, fecha_creacion: -1 });
notificationSchema.index({ destinatario: 1, tipo: 1, fecha_creacion: -1 });
notificationSchema.index({ grupo: 1, leida: 1 });
notificationSchema.index({ prioridad: 1, fecha_creacion: -1 });
notificationSchema.index({ 'referencia.tipo': 1, 'referencia.id': 1 });
notificationSchema.index({ emisor: 1, fecha_creacion: -1 });

module.exports = mongoose.model('Notification', notificationSchema);