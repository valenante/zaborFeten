// models/ObligadoTributario.js
import { Schema, model } from 'mongoose';

const ObligadoTributarioSchema = new Schema({
  nombreRazon: { type: String, required: true },
  nif: { type: String, required: true, unique: true },
  direccionPostal: { type: String },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

export default model('ObligadoTributario', ObligadoTributarioSchema);
