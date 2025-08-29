const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Carreras oficiales UCN Campus Coquimbo (17 carreras)
const CARRERAS_UCN_COQUIMBO = [
  'Biología Marina',
  'Ingeniería en Acuicultura', 
  'Ingeniería en Prevención de Riesgos y Medioambiente',
  'Medicina',
  'Enfermería',
  'Nutrición y Dietética',
  'Kinesiología',
  'Ingeniería Civil Industrial',
  'Ingeniería Civil en Computación e Informática',
  'Tecnologías de Información',
  'Ingeniería Comercial',
  'Contador Auditor Diurno',
  'Contador Auditor Vespertino', 
  'Ingeniería en Información y Control de Gestión',
  'Derecho',
  'Periodismo',
  'Psicología'
];

const userSchema = new mongoose.Schema({
  // CAMPOS OBLIGATORIOS
  rut: {
    type: String,
    required: [true, 'RUT es obligatorio'],
    unique: true,
    uppercase: true,
    trim: true,
    validate: {
      validator: function(rut) {
        // Validación básica del formato RUT (sin puntos ni guión)
        return /^\d{7,8}[0-9K]$/.test(rut);
      },
      message: 'Formato de RUT inválido'
    }
  },

  email: {
    type: String,
    required: [true, 'Email institucional es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        return /^[a-zA-Z0-9._%+-]+@(alumnos\.ucn\.cl|ucn\.cl)$/.test(email);
      },
      message: 'Debe usar un email institucional UCN (@alumnos.ucn.cl o @ucn.cl)'
    }
  },

  nombre: {
    type: String,
    required: [true, 'Nombre es obligatorio'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [50, 'El nombre no puede exceder 50 caracteres'],
    validate: {
      validator: function(nombre) {
        return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre);
      },
      message: 'El nombre solo puede contener letras y espacios'
    }
  },

  apellidos: {
    type: String,
    required: [true, 'Apellidos son obligatorios'],
    trim: true,
    minlength: [2, 'Los apellidos deben tener al menos 2 caracteres'],
    maxlength: [50, 'Los apellidos no pueden exceder 50 caracteres'],
    validate: {
      validator: function(apellidos) {
        return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(apellidos);
      },
      message: 'Los apellidos solo pueden contener letras y espacios'
    }
  },

  // Campo virtual para nombre completo
  name: {
    type: String,
    default: function() {
      return `${this.nombre} ${this.apellidos}`;
    }
  },

  password: {
    type: String,
    required: [true, 'Contraseña es obligatoria'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    validate: {
      validator: function(password) {
        // Verificar que tenga al menos:
        // - 8 caracteres
        // - 1 minúscula
        // - 1 mayúscula  
        // - 1 número
        // - 1 carácter especial
        return password.length >= 6;
      },
      message: 'La contraseña debe tener al menos 6 caracteres'
    },
    select: false // No incluir en consultas por defecto
  },

  carrera: {
    type: String,
    required: [true, 'Carrera es obligatoria'],
    enum: {
      values: CARRERAS_UCN_COQUIMBO,
      message: 'Carrera no válida para UCN Campus Coquimbo'
    }
  },

  // CAMPOS OPCIONALES
  año_ingreso: {
    type: Number,
    min: [2018, 'Año de ingreso no puede ser anterior a 2018'],
    max: [2025, 'Año de ingreso no puede ser posterior a 2025'],
    default: function() {
      return new Date().getFullYear();
    }
  },


  biografia: {
    type: String,
    maxlength: [500, 'La biografía no puede exceder 500 caracteres'],
    trim: true,
    default: ''
  },

  foto_perfil: {
    type: String,
    default: null,
    validate: {
      validator: function(url) {
        return !url || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('ui-avatars.com');
      },
      message: 'URL de foto de perfil inválida'
    }
  },

  verificado: {
    type: Boolean,
    default: false
  },

  activo: {
    type: Boolean,
    default: true
  },

  // CAMPOS DE SISTEMA
  role: {
    type: String,
    enum: ['student', 'professor', 'admin'],
    default: function() {
      return this.email && this.email.endsWith('@ucn.cl') ? 'professor' : 'student';
    }
  },

  campus: {
    type: String,
    default: 'Coquimbo',
    enum: ['Coquimbo']
  },

  facultad: {
    type: String,
    default: function() {
      const facultades = {
        'Biología Marina': 'Facultad de Ciencias del Mar',
        'Ingeniería en Acuicultura': 'Facultad de Ciencias del Mar',
        'Ingeniería en Prevención de Riesgos y Medioambiente': 'Facultad de Ingeniería y Ciencias Geológicas',
        'Medicina': 'Facultad de Medicina',
        'Enfermería': 'Facultad de Medicina',
        'Nutrición y Dietética': 'Facultad de Medicina',
        'Kinesiología': 'Facultad de Medicina',
        'Ingeniería Civil Industrial': 'Facultad de Ingeniería y Ciencias Geológicas',
        'Ingeniería Civil en Computación e Informática': 'Facultad de Ingeniería y Ciencias Geológicas',
        'Tecnologías de Información': 'Facultad de Ingeniería y Ciencias Geológicas',
        'Ingeniería Comercial': 'Facultad de Economía y Administración',
        'Contador Auditor Diurno': 'Facultad de Economía y Administración',
        'Contador Auditor Vespertino': 'Facultad de Economía y Administración',
        'Ingeniería en Información y Control de Gestión': 'Facultad de Economía y Administración',
        'Derecho': 'Facultad de Derecho',
        'Periodismo': 'Facultad de Humanidades',
        'Psicología': 'Facultad de Humanidades'
      };
      return facultades[this.carrera] || 'No determinada';
    }
  },

  // CAMPOS DE VERIFICACIÓN
  emailVerificationCode: {
    type: String,
    select: false
  },

  emailVerificationExpires: {
    type: Date,
    select: false
  },

  fecha_verificacion: {
    type: Date,
    default: null
  },

  // CAMPOS DE SEGURIDAD
  loginAttempts: {
    failed: {
      type: Number,
      default: 0
    },
    lastAttempt: {
      type: Date,
      default: null
    },
    lockedUntil: {
      type: Date,
      default: null
    }
  },

  accountStatus: {
    type: String,
    enum: ['pending_verification', 'active', 'suspended', 'locked'],
    default: 'pending_verification'
  },

  last_login: {
    type: Date,
    default: null
  },

  fecha_registro: {
    type: Date,
    default: Date.now,
    immutable: true
  },

  // CONFIGURACIONES USUARIO
  configuracion: {
    notificaciones: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      mensajes: {
        type: Boolean,
        default: true
      },
      publicaciones: {
        type: Boolean,
        default: true
      }
    },
    privacidad: {
      perfil_publico: {
        type: Boolean,
        default: true
      },
      mostrar_email: {
        type: Boolean,
        default: false
      },
      mostrar_telefono: {
        type: Boolean,
        default: false
      }
    }
  },

  // CAMPOS ADICIONALES
  telefono: {
    type: String,
    validate: {
      validator: function(tel) {
        return !tel || /^\+?56?[0-9]{8,9}$/.test(tel.replace(/\s/g, ''));
      },
      message: 'Formato de teléfono inválido'
    },
    default: null
  }

}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.emailVerificationCode;
      delete ret.emailVerificationExpires;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Virtual para nombre completo
userSchema.virtual('nombreCompleto').get(function() {
  return `${this.nombre} ${this.apellidos}`;
});

// Virtual para año académico actual
userSchema.virtual('añoAcademico').get(function() {
  const currentYear = new Date().getFullYear();
  const yearsStudied = currentYear - this.año_ingreso;
  return Math.max(1, Math.min(yearsStudied + 1, 6));
});

// Índices
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ rut: 1 }, { unique: true });
userSchema.index({ carrera: 1, año_ingreso: 1 });
userSchema.index({ verificado: 1, activo: 1 });
userSchema.index({ accountStatus: 1 });

// Middleware pre-save para actualizar nombre completo
userSchema.pre('save', function(next) {
  if (this.nombre && this.apellidos) {
    this.name = `${this.nombre} ${this.apellidos}`;
  }
  next();
});

// Métodos del esquema
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.isAccountLocked = function() {
  return this.accountStatus === 'locked' && 
         this.loginAttempts.lockedUntil && 
         this.loginAttempts.lockedUntil > new Date();
};

userSchema.methods.incrementLoginAttempts = async function() {
  this.loginAttempts.failed += 1;
  this.loginAttempts.lastAttempt = new Date();

  if (this.loginAttempts.failed >= 5) {
    this.accountStatus = 'locked';
    this.loginAttempts.lockedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas
  }

  return await this.save();
};

userSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts.failed = 0;
  this.loginAttempts.lastAttempt = null;
  this.loginAttempts.lockedUntil = null;
  
  if (this.accountStatus === 'locked') {
    this.accountStatus = this.verificado ? 'active' : 'pending_verification';
  }

  return await this.save();
};

module.exports = mongoose.model('User', userSchema);