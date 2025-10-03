import mongoose from 'mongoose';

const registroVerifactuSchema = new mongoose.Schema({
  numeroFactura: { type: String, required: true },
  fechaExpedicion: { type: Date, required: true }, // 👈 NUEVO CAMPO
  fechaEnvio: { type: Date, default: Date.now },
  estado: {
    type: String,
    enum: [
      'pendiente', 'enviado', 'aceptado', 'rechazado', 
      'error', 'generada', 'INCORRECTO', 
      'ACEPTADO_CON_ERRORES', 'CORRECTO', 'incorrecto', "correcto",
      "anulada"
    ],
    default: 'pendiente',
  },
  hashFactura: { type: String, required: true },
  huellaTCR: { type: String },
  xmlFirmado: { type: String },
  respuestaAEAT: { type: mongoose.Schema.Types.Mixed },
  errores: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.models.RegistroVerifactu || mongoose.model('RegistroVerifactu', registroVerifactuSchema);
