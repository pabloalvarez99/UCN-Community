const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const carreras = [
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
];

const campus = [
  'Antofagasta',
  'Coquimbo',
  'Santiago'
];

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor ingresa tu nombre completo'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [100, 'El nombre no puede ser mayor a 100 caracteres'],
    match: [/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios']
  },
  email: {
    type: String,
    required: [true, 'Por favor ingresa tu email institucional'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@(alumnos\.ucn\.cl|ucn\.cl)$/,
      'Debe usar un email institucional UCN (@alumnos.ucn.cl o @ucn.cl)'
    ]
  },
  password: {
    type: String,
    required: [true, 'Por favor ingresa una contraseña'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    select: false,
    validate: {
      validator: function(password) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
      },
      message: 'La contraseña debe contener al menos una minúscula, una mayúscula, un número y un carácter especial'
    }
  },
  carrera: {
    type: String,
    required: [true, 'Por favor selecciona tu carrera'],
    enum: {
      values: carreras,
      message: 'Carrera no válida'
    }
  },
  año_ingreso: {
    type: Number,
    required: [true, 'Por favor ingresa tu año de ingreso'],
    min: [2010, 'El año de ingreso no puede ser anterior a 2010'],
    max: [new Date().getFullYear(), 'El año de ingreso no puede ser futuro'],
    validate: {
      validator: function(año) {
        return Number.isInteger(año);
      },
      message: 'El año de ingreso debe ser un número entero'
    }
  },
  campus: {
    type: String,
    required: [true, 'Por favor selecciona tu campus'],
    enum: {
      values: campus,
      message: 'Campus no válido'
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
    default: function() {
      const avatars = [
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.name) + '&background=4f46e5&color=ffffff&size=200',
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.name) + '&background=059669&color=ffffff&size=200',
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.name) + '&background=dc2626&color=ffffff&size=200',
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.name) + '&background=7c3aed&color=ffffff&size=200'
      ];
      return avatars[Math.floor(Math.random() * avatars.length)];
    },
    validate: {
      validator: function(url) {
        return !url || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('ui-avatars.com');
      },
      message: 'La URL de la foto debe ser válida y apuntar a una imagen'
    }
  },
  fecha_registro: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  verificado: {
    type: Boolean,
    default: false
  },
  verification_token: {
    type: String,
    select: false
  },
  verification_token_expires: {
    type: Date,
    select: false
  },
  reset_password_token: {
    type: String,
    select: false
  },
  reset_password_expires: {
    type: Date,
    select: false
  },
  last_login: {
    type: Date
  },
  login_attempts: {
    type: Number,
    default: 0
  },
  account_locked: {
    type: Boolean,
    default: false
  },
  lock_until: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['student', 'professor', 'admin'],
    default: function() {
      return this.email.includes('@ucn.cl') ? 'professor' : 'student';
    }
  },
  privacy_settings: {
    show_email: {
      type: Boolean,
      default: false
    },
    show_career: {
      type: Boolean,
      default: true
    },
    show_campus: {
      type: Boolean,
      default: true
    },
    allow_messages: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verification_token;
      delete ret.verification_token_expires;
      delete ret.reset_password_token;
      delete ret.reset_password_expires;
      delete ret.__v;
      return ret;
    }
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.isAccountLocked = function() {
  return !!(this.account_locked && this.lock_until && this.lock_until > Date.now());
};

userSchema.methods.incLoginAttempts = function() {
  if (this.lock_until && this.lock_until < Date.now()) {
    return this.updateOne({
      $unset: {
        login_attempts: 1,
        lock_until: 1,
        account_locked: 1
      }
    });
  }
  
  const updates = { $inc: { login_attempts: 1 } };
  
  if (this.login_attempts + 1 >= 5 && !this.account_locked) {
    updates.$set = {
      account_locked: true,
      lock_until: Date.now() + 2 * 60 * 60 * 1000 // 2 horas
    };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      login_attempts: 1,
      lock_until: 1,
      account_locked: 1
    }
  });
};

userSchema.virtual('año_actual').get(function() {
  const currentYear = new Date().getFullYear();
  const yearsStudied = currentYear - this.año_ingreso;
  return Math.max(1, Math.min(yearsStudied + 1, 6));
});

userSchema.virtual('tiempo_registro').get(function() {
  const now = new Date();
  const registered = new Date(this.fecha_registro);
  const diffTime = Math.abs(now - registered);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} mes${months !== 1 ? 'es' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} año${years !== 1 ? 's' : ''}`;
  }
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ carrera: 1, campus: 1 });
userSchema.index({ año_ingreso: 1 });
userSchema.index({ verificado: 1, isActive: 1 });
userSchema.index({ 'privacy_settings.allow_messages': 1 });

module.exports = mongoose.model('User', userSchema);