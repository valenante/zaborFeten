import mongoose from 'mongoose';

const registroEventoSchema = new mongoose.Schema({
  tipoEvento: { type: String, required: true }, // "INICIO_NO_VERIFACTU", "FIN_NO_VERIFACTU", "ANOMALIA_FACTURAS", etc.
  fechaHora: { type: Date, default: Date.now, required: true },
  huellaEvento: { type: String, required: true }, // Hash SHA-256
  huellaAnterior: { type: String }, // Encadenamiento
  nifEmisor: { type: String, required: true },
  idSistema: { type: String, required: true },
  versionSistema: { type: String, required: true },
  numeroInstalacion: { type: String, required: true },
  primerEvento: { type: Boolean, default: false },
});

const RegistroEvento = mongoose.model('RegistroEvento', registroEventoSchema);
export default RegistroEvento;
