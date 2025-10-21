import mongoose from 'mongoose';

const registroVerifactuSchema = new mongoose.Schema({
  numeroFactura: { type: String, required: true },
  fechaExpedicion: { type: Date, required: true }, // 👈 Fecha real
  fechaEnvio: { type: Date, default: Date.now },

  estado: {
    type: String,
    enum: [
      'pendiente', 'enviado', 'aceptado', 'rechazado',
      'error', 'generada', 'INCORRECTO',
      'ACEPTADO_CON_ERRORES', 'CORRECTO', 'incorrecto', 'correcto',
      'anulada', 'aceptadoConErrores'
    ],
    default: 'pendiente',
  },

  hashFactura: { type: String, required: true },
  huellaTCR: { type: String },
  hashAnterior: { type: String },

  xmlFirmado: { type: String },
  respuestaAEAT: { type: mongoose.Schema.Types.Mixed },
  errores: { type: [String], default: [] },

  // 🆕 --- CAMPOS NUEVOS PARA VERIFICACIÓN Y TRAZABILIDAD ---
  fechaExpedicionXML: { type: String }, // DD-MM-YYYY exacto usado para AEAT
  fechaHoraHusoGenRegistro: { type: String }, // Fecha+hora con zona (2025-10-21T17:58:14+02:00)
  cuotaTotal: { type: Number }, // Cuota de IVA usada para el hash
  importeTotal: { type: Number }, // Total factura (igual que XML)
  tipoFactura: { type: String, default: 'F1' }, // F1, F2, R1, etc.
  emisorNIF: { type: String }, // NIF del emisor (para el hash)
  cadenaHashAEAT: { type: String }, // Cadena literal usada para generar el hash
  xmlAEAT: { type: String }, // XML enviado a AEAT (puede diferir del firmado local)
}, { timestamps: true });

export default mongoose.models.RegistroVerifactu ||
  mongoose.model('RegistroVerifactu', registroVerifactuSchema);
