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
    enum: ['queja', 'sugerencia'],
    required: true
  },
  razon: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  fecha: {
    type: Date,
    default: Date.now,
  }
});

const Strike = mongoose.model("strikes", strikeSchema);
export default Strike;
