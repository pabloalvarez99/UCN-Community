const mongoose = require('mongoose');

const comentarioSchema = new mongoose.Schema({
  autor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El autor del comentario es requerido']
  },
  contenido: {
    type: String,
    required: [true, 'El contenido del comentario es requerido'],
    trim: true,
    maxlength: [1000, 'El comentario no puede exceder 1000 caracteres'],
    minlength: [1, 'El comentario no puede estar vacío']
  },
  fecha_publicacion: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  likes: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fecha: {
      type: Date,
      default: Date.now
    }
  }],
  editado: {
    type: Boolean,
    default: false
  },
  fecha_edicion: {
    type: Date
  },
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
    fecha: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

const postSchema = new mongoose.Schema({
  autor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El autor del post es requerido']
  },
  contenido: {
    type: String,
    required: [true, 'El contenido del post es requerido'],
    trim: true,
    maxlength: [5000, 'El post no puede exceder 5000 caracteres'],
    minlength: [1, 'El contenido no puede estar vacío']
  },
  titulo: {
    type: String,
    trim: true,
    maxlength: [200, 'El título no puede exceder 200 caracteres']
  },
  tipo: {
    type: String,
    enum: ['texto', 'pregunta', 'anuncio', 'evento', 'recurso', 'discusion'],
    default: 'texto'
  },
  categoria: {
    type: String,
    enum: [
      'general',
      'academico',
      'social',
      'deportes',
      'cultura',
      'trabajo',
      'vivienda',
      'transporte',
      'salud',
      'tecnologia',
      'entretenimiento'
    ],
    default: 'general'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Cada tag no puede exceder 50 caracteres']
  }],
  fecha_publicacion: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  likes: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fecha: {
      type: Date,
      default: Date.now
    }
  }],
  comentarios: [comentarioSchema],
  visualizaciones: {
    type: Number,
    default: 0,
    min: 0
  },
  compartido: {
    type: Number,
    default: 0,
    min: 0
  },
  editado: {
    type: Boolean,
    default: false
  },
  fecha_edicion: {
    type: Date
  },
  activo: {
    type: Boolean,
    default: true
  },
  destacado: {
    type: Boolean,
    default: false
  },
  fecha_destacado: {
    type: Date
  },
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
  },
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
  campus_especifico: {
    type: String,
    enum: ['Antofagasta', 'Coquimbo', 'Santiago', 'todos'],
    default: 'todos'
  },
  carrera_especifica: {
    type: String
  },
  año_especifico: {
    type: Number,
    min: 1,
    max: 6
  },
  archivos: [{
    nombre: {
      type: String,
      required: true,
      maxlength: [255, 'El nombre del archivo no puede exceder 255 caracteres']
    },
    url: {
      type: String,
      required: true,
      validate: {
        validator: function(url) {
          return /^https?:\/\/.+/.test(url);
        },
        message: 'La URL del archivo debe ser válida'
      }
    },
    tipo: {
      type: String,
      enum: ['imagen', 'documento', 'video', 'audio', 'otro'],
      required: true
    },
    tamaño: {
      type: Number,
      min: 0
    },
    fecha_subida: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

postSchema.virtual('total_likes').get(function() {
  return this.likes ? this.likes.length : 0;
});

postSchema.virtual('total_comentarios').get(function() {
  return this.comentarios ? this.comentarios.length : 0;
});

postSchema.virtual('engagement_score').get(function() {
  const likes = this.total_likes || 0;
  const comments = this.total_comentarios || 0;
  const views = this.visualizaciones || 0;
  const shares = this.compartido || 0;
  
  return (likes * 2) + (comments * 3) + (views * 0.1) + (shares * 4);
});

postSchema.virtual('tiempo_publicacion').get(function() {
  const now = new Date();
  const published = new Date(this.fecha_publicacion);
  const diffTime = Math.abs(now - published);
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 60) {
    return `${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
  } else if (diffHours < 24) {
    return `${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  } else {
    return `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  }
});

postSchema.methods.addLike = function(userId) {
  const existingLike = this.likes.find(like => like.usuario.toString() === userId.toString());
  
  if (existingLike) {
    this.likes = this.likes.filter(like => like.usuario.toString() !== userId.toString());
    return { action: 'removed', total: this.likes.length };
  } else {
    this.likes.push({ usuario: userId });
    return { action: 'added', total: this.likes.length };
  }
};

postSchema.methods.addComment = function(commentData) {
  this.comentarios.push(commentData);
  return this.comentarios[this.comentarios.length - 1];
};

postSchema.methods.incrementViews = function() {
  this.visualizaciones += 1;
  return this.save();
};

postSchema.methods.report = function(reportData) {
  this.reportes.push(reportData);
  if (this.reportes.length >= 3) {
    this.reportado = true;
  }
  return this.save();
};

postSchema.pre('save', function(next) {
  if (this.isModified('contenido') && !this.isNew) {
    this.editado = true;
    this.fecha_edicion = new Date();
  }
  next();
});

postSchema.index({ autor: 1, fecha_publicacion: -1 });
postSchema.index({ categoria: 1, fecha_publicacion: -1 });
postSchema.index({ tipo: 1, fecha_publicacion: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ campus_especifico: 1, carrera_especifica: 1 });
postSchema.index({ destacado: 1, fecha_publicacion: -1 });
postSchema.index({ activo: 1, moderado: 1 });
postSchema.index({ 'likes.usuario': 1 });
postSchema.index({ reportado: 1, 'reportes.fecha': -1 });
postSchema.index({ 
  titulo: 'text', 
  contenido: 'text', 
  tags: 'text' 
}, {
  weights: {
    titulo: 10,
    contenido: 5,
    tags: 2
  },
  name: 'post_text_index'
});

module.exports = mongoose.model('Post', postSchema);