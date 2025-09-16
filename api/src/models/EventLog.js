import mongoose from 'mongoose';

const eventLogSchema = new mongoose.Schema(
  {
    otNif: { type: String, required: true },       // NIF del obligado (ej: X6063327K)
    tipoEvento: { type: String, required: true },  // INICIO_NO_VERIFACTU, FIN_NO_VERIFACTU, etc.
    fechaHoraISO: { type: String, required: true },// Fecha con zona horaria ISO
    huella: { type: String, required: true },      // Hash del evento actual
    huellaAnterior: { type: String },              // Hash encadenado previo
    payload: { type: Object },                     // Datos adicionales
    anterior: {
      tipoEvento: String,
      fechaHoraISO: String,
      huella: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('EventLog', eventLogSchema);
