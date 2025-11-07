// modelo FechaEspecial.js
import { Schema, model } from "mongoose";

const fechaEspecialSchema = new Schema({
  fecha: { type: String, required: true }, // 'YYYY-MM-DD'
  habilitado: { type: Boolean, default: true },
  franjas: [
    {
      horaInicio: String,
      horaFin: String,
      maxReservas: Number,
    },
  ],
});

export default model("FechaEspecial", fechaEspecialSchema);
