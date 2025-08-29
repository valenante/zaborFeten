// models/SifConfig.js
import { Schema, model } from 'mongoose';

const ProductorSchema = new Schema({
  nombreRazon: { type: String, required: true },   // NombreRazon (productor)
  nif: { type: String },                            // NIF (si hay)
  idOtro: {
    codigoPais: String,     // ISO 3166-1 alpha2
    idType: String,         // L7 (02,03,04,05,06,07)
    id: String,
  },
}, { _id: false });

const SifConfigSchema = new Schema({
  productor: { type: ProductorSchema, required: true },

  nombreSistemaInformatico: { type: String, required: true }, // NombreSistemaInformatico
  idSistemaInformatico: { type: String, required: true },     // IdSistemaInformatico (código corto único)
  version: { type: String, required: true },                  // Version del SIF
  numeroInstalacion: { type: String, required: true },        // NumeroInstalacion

  // Flags del bloque 6
  tipoUsoPosibleSoloVerifactu: { type: String, enum: ['S','N'], default: 'N' }, // Solo VERI*FACTU (S/N)
  tipoUsoPosibleMultiOT: { type: String, enum: ['S','N'], default: 'N' },       // Multi-obligado tributario (S/N)

  // Estado runtime (derivado): cuántos OT hay activos (para “IndicadorMultiplesOT”)
  multiplesOTActivos: { type: Boolean, default: false },

  // Metadatos opcionales
  createdBy: { type: String },
}, { timestamps: true });

export default model('SifConfig', SifConfigSchema);
