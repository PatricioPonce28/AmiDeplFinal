import mongoose from "mongoose";

const TesoreriaSchema = new mongoose.Schema({
  saldoTotal: {
    type: Number,
    default: 0
  },
  movimientos: [{
    tipo: {
      type: String,
      enum: ["ingreso", "gasto"],
      required: true
    },
    monto: {
      type: Number,
      required: true
    },
    razon: {
      type: String,
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    }
  }]
});

export default mongoose.model("Tesoreria", TesoreriaSchema);