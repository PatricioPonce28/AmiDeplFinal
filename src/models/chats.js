import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  participantes: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    required: true,
    validate: [
      (arr) => arr.length === 2,
      'Un chat debe tener exactamente dos participantes'
    ]
  },
  mensajes: [{
    emisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contenido: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Chat', chatSchema);

