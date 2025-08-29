// models/VerifactuChain.js
import { Schema, model } from 'mongoose';

const VerifactuChainSchema = new Schema({
  otNif: { type: String, required: true, index: true, unique: true },
  // último registro generado (alta o anulación)
  ultimo: {
    tipo: { type: String, enum: ['alta', 'anulacion'], required: true },
    idEmisor: { type: String, required: true },      // NIF (IDEmisorFactura*)
    numSerie: { type: String, required: true },      // Nº Serie+Nº Factura
    fechaExpedicion: { type: String, required: true },// dd-mm-yyyy
    fechaHoraGenISO: { type: String, required: true },// ISO 8601 con TZ
    huella: { type: String, required: true },        // SHA-256 hex (64)
  },
}, { timestamps: true });

export default model('VerifactuChain', VerifactuChainSchema);
