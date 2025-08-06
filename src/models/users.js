import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  apellido: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
     required: function() {
        return !this.googleId; // true si no hay googleId, false si sí lo hay
    }
  },
  rol: {
    type: String,
    default: 'estudiante' 
  },
  imagenPerfil: {
    type: String, 
    default: ''
  },
  imagenesGaleria: {
    type: [String], 
    default: []
  },
  biografia: {
    type: String,
    trim: true,
    maxlength: 300
  },
  ubicacion: {
    ciudad: { type: String, default: '' },
    pais: { type: String, default: '' }
  },
  intereses: {
    type: [String],
    default: []
  },
  activo: {
    type: Boolean,
    default: true
  },
  seguidores: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: [] 
  }],
  siguiendo: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  matches: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: [] 
  }],
  fechaNacimiento: {
    type: Date
  },
  genero: {
    type: String,
    enum: ['hombre', 'mujer', 'otro'],
    default: 'otro'
  },
  orientacion: {
    type: String,
    enum: ['heterosexual', 'homosexual', 'bisexual', 'otro'],
    default: 'otro'
  },
  confirmEmail: {
    type: Boolean,
    default: false
  },
  token: {
    type: String,
    default: false
  }, 
  googleId: {
    type: String,
    unique: true,
    sparse: true // Permite múltiples documentos con googleId null
  },
}, {
  timestamps: true
});

// Encriptar contraseña
userSchema.methods.encryptPassword = async function (password) {
    const salt = await bcrypt.genSalt(10)
    const passwordEncryp = await bcrypt.hash(password,salt)
    return passwordEncryp
};

// Método para verificar si el password ingresado es el mismo de la BDD
userSchema.methods.matchPassword = async function (password) {
    const response = await bcrypt.compare(password,this.password)
    return response
};

// Método para generar un token
userSchema.methods.crearToken = function(){
    const tokenGenerado = this.token = Math.random().toString(36).slice(2)
    return tokenGenerado
}

export default model('User', userSchema);
