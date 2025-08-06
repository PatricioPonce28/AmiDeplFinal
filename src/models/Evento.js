import mongoose from "mongoose";

const eventoSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  descripcion: {
    type: String,
    required: true
  },
  fecha: {
    type: Date,
    required: true
  },
  lugar: {
    type: String,
    required: true
  },
  hora: {
  type: String,
  required: true
},
  imagen: {
    type: String,
    default: ""
  },
  creador: {
    type: mongoose.Schema.Types.ObjectId,
    rol: 'Admin', 
    required: true
  },
  activo: {
  type: Boolean,
  default: true
  },
  asistentes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  noAsistiran: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

const Evento = mongoose.model('Evento', eventoSchema);
export default Evento;
