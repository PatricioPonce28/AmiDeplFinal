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
  hora: {
    type: String,
    required: true
  },
  lugar: {
    type: String,
    required: true
  },
  imagen: {
    type: String,
    required: true
  },
  asistentes: [{
    estudiante: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'estudiante', 
      required: true
    },
    estado: {
      type: String,
      enum: ['pendiente', 'asistira', 'no_asistira'],
      default: 'pendiente'
    }
  }]
}, {
  timestamps: true
});
