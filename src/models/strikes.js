import mongoose from "mongoose";

const strikeSchema = new mongoose.Schema({
  de: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  para: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tipo: {
    type: String,
    enum: ['queja', 'sugerencia', 'denuncia'],
    required: true
  },
  razon: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  usuarioReportado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: false
  },
  status: {
    type: String,
    enum: ['pendiente', 'resuelto', 'rechazado'],
    default: 'pendiente'
  },
  respuesta: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: null
  },
  respondido: {
    type: Boolean,
    default: false
  },
  fechaRespuesta: {
    type: Date,
    default: null
  },
  fecha: {
    type: Date,
    default: Date.now,
  }
});

const Strike = mongoose.model("strikes", strikeSchema);
export default Strike;
