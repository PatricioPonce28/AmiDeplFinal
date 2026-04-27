import mongoose from "mongoose";

const mensajeSchema = new mongoose.Schema({
  rol: {
    type: String,
    enum: ["usuario", "asistente"], 
    required: true
  },
  contenido: { type: String, required: true },
  fecha: { type: Date, default: Date.now }
});

const historialSchema = new mongoose.Schema({ // ← variable diferente al model
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  conversationId: { type: String, default: null },
  botpressUserId: { type: String, default: null },
  mensajes: [mensajeSchema]
}, { timestamps: true });

export default mongoose.model("HistorialConChatbot", historialSchema); 