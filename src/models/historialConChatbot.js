import mongoose from "mongoose";

const mensajeSchema = new mongoose.Schema({
  rol: {
    type: String,
    enum: "estudiante",
    required: true
  },
  contenido: {
    type: String,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

const HistorialConChatbot = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",       // ← el nombre de tu modelo de usuarios
    required: true,
    unique: true           // un historial por usuario
  },
  mensajes: [mensajeSchema]
}, { timestamps: true });

export default mongoose.model("HistorialConChatbot", HistorialConChatbot);