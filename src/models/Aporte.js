import mongoose from "mongoose";

const AporteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  motive: {
    type: String,
    default: "Aporte para el mantenimiento de Amikuna",
  },
  status: {
    type: String,
    enum: ["pendiente", "pagado", "fallido"],
    default: "pendiente",
  },
  paymentIntentId: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Aporte", AporteSchema);
