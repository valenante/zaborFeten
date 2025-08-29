import mongoose from 'mongoose';

const registroVerifactuSchema = new mongoose.Schema({
  numeroFactura: { type: String, required: true },
  fechaEnvio: { type: Date, default: Date.now },
  estado: {
    type: String,
    enum: ['pendiente', 'enviado', 'aceptado', 'rechazado', 'error'],
    default: 'pendiente',
  },
  hashFactura: { type: String, required: true },
  huellaTCR: { type: String },
  xmlFirmado: { type: String },
  respuestaAEAT: { type: mongoose.Schema.Types.Mixed },
  errores: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.models.RegistroVerifactu || mongoose.model('RegistroVerifactu', registroVerifactuSchema);
