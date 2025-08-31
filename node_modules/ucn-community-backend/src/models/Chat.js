const mongoose = require('mongoose');

const participanteSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario participante es requerido']
  },
  rol: {
    type: String,
    enum: ['admin', 'moderador', 'miembro'],
    default: 'miembro'
  },
  fecha_union: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  fecha_salida: {
    type: Date
  },
  activo: {
    type: Boolean,
    default: true
  },
  silenciado: {
    type: Boolean,
    default: false
  },
  fecha_silenciado: {
    type: Date
  },
  permisos: {
    enviar_mensajes: {
      type: Boolean,
      default: true
    },
    agregar_participantes: {
      type: Boolean,
      default: false
    },
    eliminar_mensajes: {
      type: Boolean,
      default: false
    },
    editar_info_grupo: {
      type: Boolean,
      default: false
    }
  },
  ultimo_mensaje_visto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  fecha_ultimo_acceso: {
    type: Date,
    default: Date.now
  }
}, {
  _id: false,
  timestamps: false
});

const chatSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['individual', 'grupal', 'canal', 'estudio'],
    required: [true, 'El tipo de chat es requerido'],
    default: 'individual'
  },
  participantes: {
    type: [participanteSchema],
    validate: {
      validator: function(participantes) {
        if (this.tipo === 'individual') {
          return participantes.length === 2;
        } else if (this.tipo === 'grupal') {
          return participantes.length >= 3 && participantes.length <= 100;
        } else if (this.tipo === 'canal') {
          return participantes.length >= 1 && participantes.length <= 1000;
        } else if (this.tipo === 'estudio') {
          return participantes.length >= 2 && participantes.length <= 50;
        }
        return true;
      },
      message: function(props) {
        if (this.tipo === 'individual') {
          return 'Un chat individual debe tener exactamente 2 participantes';
        } else if (this.tipo === 'grupal') {
          return 'Un chat grupal debe tener entre 3 y 100 participantes';
        } else if (this.tipo === 'canal') {
          return 'Un canal debe tener entre 1 y 1000 participantes';
        } else if (this.tipo === 'estudio') {
          return 'Un grupo de estudio debe tener entre 2 y 50 participantes';
        }
        return 'Número de participantes inválido';
      }
    }
  },
  nombre_grupo: {
    type: String,
    trim: true,
    maxlength: [100, 'El nombre del grupo no puede exceder 100 caracteres'],
    validate: {
      validator: function(nombre) {
        if (this.tipo === 'individual') {
          return !nombre; // Individual no debe tener nombre
        } else {
          return nombre && nombre.length >= 2;
        }
      },
      message: function() {
        if (this.tipo === 'individual') {
          return 'Los chats individuales no deben tener nombre de grupo';
        } else {
          return 'El nombre del grupo es requerido y debe tener al menos 2 caracteres';
        }
      }
    }
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },
  imagen_grupo: {
    type: String,
    validate: {
      validator: function(url) {
        return !url || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
      },
      message: 'La URL de la imagen debe ser válida y apuntar a una imagen'
    }
  },
  ultimo_mensaje: {
    mensaje_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    contenido_preview: {
      type: String,
      maxlength: [100, 'El preview del mensaje no puede exceder 100 caracteres']
    },
    emisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fecha: {
      type: Date
    },
    tipo: {
      type: String,
      enum: ['texto', 'imagen', 'archivo', 'audio', 'video', 'ubicacion', 'sistema']
    }
  },
  fecha_actualizacion: {
    type: Date,
    default: Date.now
  },
  fecha_creacion: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  archivado: {
    type: Boolean,
    default: false
  },
  fecha_archivado: {
    type: Date
  },
  configuracion: {
    solo_admins_pueden_escribir: {
      type: Boolean,
      default: false
    },
    mensajes_temporales: {
      habilitado: {
        type: Boolean,
        default: false
      },
      duracion_horas: {
        type: Number,
        min: 1,
        max: 168, // 7 días
        default: 24
      }
    },
    notificaciones_silenciadas: {
      type: Boolean,
      default: false
    },
    auto_eliminar_mensajes: {
      habilitado: {
        type: Boolean,
        default: false
      },
      dias: {
        type: Number,
        min: 1,
        max: 365,
        default: 30
      }
    }
  },
  // Para chats de estudio específicos
  materia: {
    type: String,
    trim: true,
    maxlength: [100, 'El nombre de la materia no puede exceder 100 caracteres']
  },
  carrera: {
    type: String,
    enum: [
      'Ingeniería Civil',
      'Ingeniería Industrial',
      'Ingeniería en Sistemas',
      'Ingeniería Comercial',
      'Arquitectura',
      'Medicina',
      'Enfermería',
      'Kinesiología',
      'Fonoaudiología',
      'Derecho',
      'Psicología',
      'Trabajo Social',
      'Administración Pública',
      'Contador Público',
      'Periodismo',
      'Publicidad',
      'Diseño Gráfico'
    ]
  },
  campus: {
    type: String,
    enum: ['Antofagasta', 'Coquimbo', 'Santiago']
  },
  año_academico: {
    type: Number,
    min: 1,
    max: 6
  },
  // Estadísticas
  estadisticas: {
    total_mensajes: {
      type: Number,
      default: 0,
      min: 0
    },
    mensajes_hoy: {
      type: Number,
      default: 0,
      min: 0
    },
    ultimo_reset_diario: {
      type: Date,
      default: Date.now
    },
    participante_mas_activo: {
      usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      mensaje_count: {
        type: Number,
        default: 0
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

chatSchema.virtual('participantes_activos').get(function() {
  return this.participantes.filter(p => p.activo);
});

chatSchema.virtual('admins').get(function() {
  return this.participantes.filter(p => p.rol === 'admin' && p.activo);
});

chatSchema.virtual('total_participantes').get(function() {
  return this.participantes_activos.length;
});

chatSchema.virtual('nombre_display').get(function() {
  if (this.tipo === 'individual') {
    // Para chat individual, retornar los nombres de los participantes
    const nombres = this.participantes
      .filter(p => p.activo)
      .map(p => p.usuario.name || 'Usuario')
      .join(', ');
    return nombres;
  } else {
    return this.nombre_grupo || 'Grupo sin nombre';
  }
});

chatSchema.virtual('mensajes_no_leidos').get(function() {
  // Esta propiedad se calculará en tiempo real en las consultas
  return 0;
});

chatSchema.methods.addParticipant = function(userId, rol = 'miembro') {
  const exists = this.participantes.some(p => 
    p.usuario.toString() === userId.toString() && p.activo
  );
  
  if (exists) {
    throw new Error('El usuario ya es participante del chat');
  }
  
  if (this.tipo === 'individual') {
    throw new Error('No se pueden agregar participantes a un chat individual');
  }
  
  this.participantes.push({
    usuario: userId,
    rol: rol,
    fecha_union: new Date(),
    activo: true
  });
  
  this.fecha_actualizacion = new Date();
  return this.save();
};

chatSchema.methods.removeParticipant = function(userId, removedBy) {
  const participantIndex = this.participantes.findIndex(p => 
    p.usuario.toString() === userId.toString() && p.activo
  );
  
  if (participantIndex === -1) {
    throw new Error('El usuario no es participante del chat');
  }
  
  this.participantes[participantIndex].activo = false;
  this.participantes[participantIndex].fecha_salida = new Date();
  
  this.fecha_actualizacion = new Date();
  return this.save();
};

chatSchema.methods.updateLastMessage = function(messageData) {
  this.ultimo_mensaje = {
    mensaje_id: messageData._id,
    contenido_preview: messageData.contenido.substring(0, 100),
    emisor: messageData.sender_id,
    fecha: messageData.fecha_envio,
    tipo: messageData.tipo_mensaje
  };
  
  this.fecha_actualizacion = new Date();
  this.estadisticas.total_mensajes += 1;
  
  // Reset contador diario si es necesario
  const today = new Date().toDateString();
  const lastReset = new Date(this.estadisticas.ultimo_reset_diario).toDateString();
  
  if (today !== lastReset) {
    this.estadisticas.mensajes_hoy = 1;
    this.estadisticas.ultimo_reset_diario = new Date();
  } else {
    this.estadisticas.mensajes_hoy += 1;
  }
  
  return this.save();
};

chatSchema.methods.markAsRead = function(userId, messageId) {
  const participant = this.participantes.find(p => 
    p.usuario.toString() === userId.toString() && p.activo
  );
  
  if (participant) {
    participant.ultimo_mensaje_visto = messageId;
    participant.fecha_ultimo_acceso = new Date();
    return this.save();
  }
  
  throw new Error('Usuario no es participante del chat');
};

chatSchema.methods.isUserParticipant = function(userId) {
  return this.participantes.some(p => 
    p.usuario.toString() === userId.toString() && p.activo
  );
};

chatSchema.methods.getUserRole = function(userId) {
  const participant = this.participantes.find(p => 
    p.usuario.toString() === userId.toString() && p.activo
  );
  return participant ? participant.rol : null;
};

chatSchema.pre('save', function(next) {
  if (this.isModified('participantes') || this.isModified('nombre_grupo')) {
    this.fecha_actualizacion = new Date();
  }
  next();
});

// Índices para optimización de consultas
chatSchema.index({ 'participantes.usuario': 1, activo: 1 });
chatSchema.index({ tipo: 1, fecha_actualizacion: -1 });
chatSchema.index({ 'ultimo_mensaje.fecha': -1 });
chatSchema.index({ carrera: 1, campus: 1, año_academico: 1 });
chatSchema.index({ materia: 1, tipo: 1 });
chatSchema.index({ archivado: 1, activo: 1 });
chatSchema.index({ fecha_creacion: -1 });

// Índice compuesto para buscar chats por participante ordenados por última actividad
chatSchema.index({ 
  'participantes.usuario': 1, 
  'participantes.activo': 1,
  fecha_actualizacion: -1 
});

// Índice de texto para búsqueda
chatSchema.index({
  nombre_grupo: 'text',
  descripcion: 'text',
  materia: 'text'
}, {
  name: 'chat_text_index'
});

module.exports = mongoose.model('Chat', chatSchema);