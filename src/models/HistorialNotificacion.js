import { Schema, model } from 'mongoose';

const historialNotificacionSchema = new Schema({
  usuario: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tipo: {
    type: String,
    enum: ['seguidor', 'match', 'evento', 'generico'],
    default: 'generico'
  },
  titulo: { type: String, required: true },
  mensaje: { type: String, required: true },
  leido: { type: Boolean, default: false }
}, { timestamps: true });

export default model('HistorialNotificacion', historialNotificacionSchema);
