// models/FacturaChain.js
import { Schema, model } from 'mongoose';

const UltimoSchema = new Schema({
  otNif: { type: String, required: true },        // NIF del obligado a emitir
  sifId: { type: String, required: true },        // IdSistemaInformatico (de SifConfig)
  serie: { type: String, required: true },        // Serie última factura
  numero: { type: String, required: true },       // Nº última factura
  fechaExpedicion: { type: String, required: true }, // dd-mm-yyyy
  huella64: { type: String, required: true },     // 64 primeros chars del hash previo
  fechaHoraGenISO: { type: String, required: true }, // ISO 8601 con TZ
}, { _id: false });

const FacturaChainSchema = new Schema({
  otNif: { type: String, required: true, index: true },
  sifId: { type: String, required: true, index: true },
  ultimo: { type: UltimoSchema, required: false },
  // histórico mínimo (opcional)
  history: [{
    tipo: { type: String, enum: ['alta','anulacion'], required: true },
    serie: String, numero: String, fechaExpedicion: String,
    huella64: String, fechaHoraGenISO: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default model('FacturaChain', FacturaChainSchema);
