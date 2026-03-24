import { Schema, model } from 'mongoose';

const historialNotificacionSchema = new Schema({
  usuario: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fromUser: {               
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: false         
  },
  tipo: {
    type: String,
    enum: ['seguidor', 'match', 'evento', 'generico', 'respuesta_strike', 'denuncia'],
    default: 'generico'
  },
  titulo: { type: String, required: true },
  mensaje: { type: String, required: true },
  leido: { type: Boolean, default: false }
}, { timestamps: true });

export default model('HistorialNotificacion', historialNotificacionSchema);
