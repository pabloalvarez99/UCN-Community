const mongoose = require('mongoose');

const reaccionSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  emoji: {
    type: String,
    required: true,
    enum: ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '👏', '🔥', '💯'],
    maxlength: 2
  },
  fecha: {
    type: Date,
    default: Date.now
  }
}, {
  _id: false
});

const archivoSchema = new mongoose.Schema({
  nombre_original: {
    type: String,
    required: [true, 'El nombre del archivo es requerido'],
    trim: true,
    maxlength: [255, 'El nombre del archivo no puede exceder 255 caracteres']
  },
  nombre_almacenado: {
    type: String,
    required: [true, 'El nombre de almacenamiento es requerido']
  },
  url: {
    type: String,
    required: [true, 'La URL del archivo es requerida'],
    validate: {
      validator: function(url) {
        return /^https?:\/\/.+/.test(url);
      },
      message: 'La URL del archivo debe ser válida'
    }
  },
  tipo_mime: {
    type: String,
    required: [true, 'El tipo MIME es requerido'],
    maxlength: [100, 'El tipo MIME no puede exceder 100 caracteres']
  },
  tamaño: {
    type: Number,
    required: [true, 'El tamaño del archivo es requerido'],
    min: [0, 'El tamaño no puede ser negativo'],
    max: [50 * 1024 * 1024, 'El archivo no puede exceder 50MB'] // 50MB
  },
  dimensiones: {
    ancho: {
      type: Number,
      min: 0
    },
    alto: {
      type: Number,
      min: 0
    }
  },
  duracion: {
    type: Number, // Para archivos de audio/video en segundos
    min: 0
  },
  thumbnail: {
    type: String,
    validate: {
      validator: function(url) {
        return !url || /^https?:\/\/.+/.test(url);
      },
      message: 'La URL del thumbnail debe ser válida'
    }
  }
}, {
  _id: false
});

const ubicacionSchema = new mongoose.Schema({
  latitud: {
    type: Number,
    required: [true, 'La latitud es requerida'],
    min: [-90, 'La latitud debe estar entre -90 y 90'],
    max: [90, 'La latitud debe estar entre -90 y 90']
  },
  longitud: {
    type: Number,
    required: [true, 'La longitud es requerida'],
    min: [-180, 'La longitud debe estar entre -180 y 180'],
    max: [180, 'La longitud debe estar entre -180 y 180']
  },
  direccion: {
    type: String,
    trim: true,
    maxlength: [500, 'La dirección no puede exceder 500 caracteres']
  },
  nombre_lugar: {
    type: String,
    trim: true,
    maxlength: [200, 'El nombre del lugar no puede exceder 200 caracteres']
  }
}, {
  _id: false
});

const messageSchema = new mongoose.Schema({
  chat_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: [true, 'El ID del chat es requerido'],
    index: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El ID del emisor es requerido'],
    index: true
  },
  contenido: {
    type: String,
    required: function() {
      return this.tipo_mensaje === 'texto' || this.tipo_mensaje === 'sistema';
    },
    trim: true,
    maxlength: [10000, 'El mensaje no puede exceder 10000 caracteres'],
    validate: {
      validator: function(contenido) {
        if (this.tipo_mensaje === 'texto' && (!contenido || contenido.trim().length === 0)) {
          return false;
        }
        return true;
      },
      message: 'El contenido es requerido para mensajes de texto'
    }
  },
  tipo_mensaje: {
    type: String,
    enum: ['texto', 'imagen', 'archivo', 'audio', 'video', 'ubicacion', 'sistema', 'encuesta', 'evento'],
    required: [true, 'El tipo de mensaje es requerido'],
    default: 'texto'
  },
  fecha_envio: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  editado: {
    type: Boolean,
    default: false
  },
  fecha_edicion: {
    type: Date
  },
  historial_ediciones: [{
    contenido_anterior: {
      type: String,
      required: true
    },
    fecha_edicion: {
      type: Date,
      default: Date.now
    }
  }],
  eliminado: {
    type: Boolean,
    default: false
  },
  fecha_eliminacion: {
    type: Date
  },
  eliminado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Estados de lectura por participante
  leido: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    fecha_lectura: {
      type: Date,
      default: Date.now
    }
  }],
  entregado: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    fecha_entrega: {
      type: Date,
      default: Date.now
    }
  }],
  // Mensaje en respuesta a otro
  respuesta_a: {
    mensaje_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    contenido_preview: {
      type: String,
      maxlength: [100, 'El preview no puede exceder 100 caracteres']
    },
    autor_original: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Mensaje reenviado
  reenviado: {
    type: Boolean,
    default: false
  },
  mensaje_original: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Contenido específico por tipo
  archivo: archivoSchema,
  ubicacion: ubicacionSchema,
  // Reacciones al mensaje
  reacciones: [reaccionSchema],
  // Menciones en el mensaje
  menciones: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    posicion_inicio: {
      type: Number,
      min: 0
    },
    posicion_fin: {
      type: Number,
      min: 0
    }
  }],
  // Para mensajes de sistema
  tipo_sistema: {
    type: String,
    enum: [
      'usuario_agregado',
      'usuario_eliminado',
      'usuario_salio',
      'nombre_grupo_cambiado',
      'imagen_grupo_cambiada',
      'admin_asignado',
      'admin_removido',
      'grupo_creado',
      'configuracion_cambiada'
    ]
  },
  datos_sistema: {
    type: mongoose.Schema.Types.Mixed // Para almacenar datos específicos del evento de sistema
  },
  // Para mensajes temporales
  temporal: {
    habilitado: {
      type: Boolean,
      default: false
    },
    eliminar_en: {
      type: Date
    },
    visto_por: [{
      usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      fecha_vista: {
        type: Date,
        default: Date.now
      }
    }]
  },
  // Prioridad del mensaje
  prioridad: {
    type: String,
    enum: ['baja', 'normal', 'alta', 'urgente'],
    default: 'normal'
  },
  // Programación de mensaje
  programado: {
    type: Boolean,
    default: false
  },
  fecha_programada: {
    type: Date
  },
  // Estadísticas
  estadisticas: {
    total_reacciones: {
      type: Number,
      default: 0,
      min: 0
    },
    total_respuestas: {
      type: Number,
      default: 0,
      min: 0
    },
    total_reenvios: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  // Reportes y moderación
  reportado: {
    type: Boolean,
    default: false
  },
  reportes: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    razon: {
      type: String,
      enum: ['spam', 'ofensivo', 'inapropiado', 'acoso', 'otro'],
      required: true
    },
    descripcion: {
      type: String,
      maxlength: [500, 'La descripción no puede exceder 500 caracteres']
    },
    fecha: {
      type: Date,
      default: Date.now
    }
  }],
  moderado: {
    type: Boolean,
    default: false
  },
  moderador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  razon_moderacion: {
    type: String,
    maxlength: [500, 'La razón de moderación no puede exceder 500 caracteres']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuales
messageSchema.virtual('tiempo_envio').get(function() {
  const now = new Date();
  const sent = new Date(this.fecha_envio);
  const diffTime = Math.abs(now - sent);
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

messageSchema.virtual('es_temporal_expirado').get(function() {
  if (!this.temporal.habilitado || !this.temporal.eliminar_en) {
    return false;
  }
  return new Date() > this.temporal.eliminar_en;
});

messageSchema.virtual('total_lectores').get(function() {
  return this.leido ? this.leido.length : 0;
});

messageSchema.virtual('contenido_display').get(function() {
  if (this.eliminado) {
    return '🚫 Este mensaje fue eliminado';
  }
  
  if (this.es_temporal_expirado) {
    return '⏰ Este mensaje temporal ha expirado';
  }
  
  if (this.tipo_mensaje === 'archivo') {
    return `📎 ${this.archivo.nombre_original}`;
  } else if (this.tipo_mensaje === 'imagen') {
    return '🖼️ Imagen';
  } else if (this.tipo_mensaje === 'audio') {
    return '🎵 Audio';
  } else if (this.tipo_mensaje === 'video') {
    return '🎥 Video';
  } else if (this.tipo_mensaje === 'ubicacion') {
    return '📍 Ubicación';
  }
  
  return this.contenido;
});

// Métodos
messageSchema.methods.markAsRead = function(userId) {
  const alreadyRead = this.leido.some(read => 
    read.usuario.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.leido.push({
      usuario: userId,
      fecha_lectura: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

messageSchema.methods.addReaction = function(userId, emoji) {
  // Verificar si el usuario ya reaccionó
  const existingReactionIndex = this.reacciones.findIndex(reaction => 
    reaction.usuario.toString() === userId.toString()
  );
  
  if (existingReactionIndex !== -1) {
    // Si la reacción es la misma, eliminarla
    if (this.reacciones[existingReactionIndex].emoji === emoji) {
      this.reacciones.splice(existingReactionIndex, 1);
      this.estadisticas.total_reacciones = Math.max(0, this.estadisticas.total_reacciones - 1);
      return { action: 'removed', emoji };
    } else {
      // Si es diferente, cambiarla
      this.reacciones[existingReactionIndex].emoji = emoji;
      this.reacciones[existingReactionIndex].fecha = new Date();
      return { action: 'changed', emoji };
    }
  } else {
    // Agregar nueva reacción
    this.reacciones.push({
      usuario: userId,
      emoji: emoji
    });
    this.estadisticas.total_reacciones += 1;
    return { action: 'added', emoji };
  }
};

messageSchema.methods.edit = function(newContent) {
  if (this.tipo_mensaje !== 'texto') {
    throw new Error('Solo se pueden editar mensajes de texto');
  }
  
  // Guardar el contenido anterior en el historial
  this.historial_ediciones.push({
    contenido_anterior: this.contenido,
    fecha_edicion: new Date()
  });
  
  // Actualizar el contenido
  this.contenido = newContent;
  this.editado = true;
  this.fecha_edicion = new Date();
  
  return this.save();
};

messageSchema.methods.delete = function(deletedBy) {
  this.eliminado = true;
  this.fecha_eliminacion = new Date();
  this.eliminado_por = deletedBy;
  return this.save();
};

messageSchema.methods.report = function(reportData) {
  this.reportes.push(reportData);
  if (this.reportes.length >= 3) {
    this.reportado = true;
  }
  return this.save();
};

messageSchema.methods.schedule = function(scheduleDate) {
  if (scheduleDate <= new Date()) {
    throw new Error('La fecha de programación debe ser futura');
  }
  
  this.programado = true;
  this.fecha_programada = scheduleDate;
  return this.save();
};

// Middlewares
messageSchema.pre('save', function(next) {
  // Configurar mensaje temporal si está habilitado
  if (this.temporal.habilitado && !this.temporal.eliminar_en) {
    const chat_config = this.parent().configuracion.mensajes_temporales;
    if (chat_config && chat_config.habilitado) {
      this.temporal.eliminar_en = new Date(Date.now() + (chat_config.duracion_horas * 60 * 60 * 1000));
    }
  }
  
  next();
});

// Índices para optimización
messageSchema.index({ chat_id: 1, fecha_envio: -1 });
messageSchema.index({ sender_id: 1, fecha_envio: -1 });
messageSchema.index({ tipo_mensaje: 1 });
messageSchema.index({ 'leido.usuario': 1 });
messageSchema.index({ eliminado: 1, fecha_envio: -1 });
messageSchema.index({ programado: 1, fecha_programada: 1 });
messageSchema.index({ 'temporal.habilitado': 1, 'temporal.eliminar_en': 1 });
messageSchema.index({ reportado: 1 });
messageSchema.index({ 'respuesta_a.mensaje_id': 1 });

// Índice compuesto para mensajes de un chat ordenados por fecha
messageSchema.index({ 
  chat_id: 1, 
  eliminado: 1, 
  fecha_envio: -1 
});

// Índice de texto para búsqueda de contenido
messageSchema.index({
  contenido: 'text'
}, {
  name: 'message_content_index'
});

// Índice TTL para mensajes temporales
messageSchema.index(
  { 'temporal.eliminar_en': 1 },
  { 
    expireAfterSeconds: 0,
    partialFilterExpression: { 
      'temporal.habilitado': true,
      'temporal.eliminar_en': { $exists: true }
    }
  }
);

module.exports = mongoose.model('Message', messageSchema);