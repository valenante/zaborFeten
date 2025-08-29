// models/EventLog.js
import { Schema, model } from 'mongoose';

/**
 * Event types (L2E) que vamos a registrar:
 * 01 Inicio NO VERI*FACTU
 * 02 Fin NO VERI*FACTU
 * 03 Lanzamiento detección anomalías Reg. Facturación
 * 04 Detección de anomalías Reg. Facturación
 * 05 Lanzamiento detección anomalías Reg. Evento
 * 06 Detección de anomalías Reg. Evento
 * 07 Restauración de copia
 * 08 Exportación registros facturación periodo
 * 09 Exportación registros evento periodo
 * 10 Resumen 6h
 * 90 Otros
 */
const EventLogSchema = new Schema({
  otNif: { type: String, required: true },           // NIF obligado (art. 9.4)
  tipoEvento: { type: String, required: true },      // L2E
  fechaHoraISO: { type: String, required: true },    // ISO 8601 con TZ (art. 9.4)
  payload: { type: Object, default: {} },            // datos extra (números, huellas, etc.)
  huella: { type: String },                          // (cuando apliques hash encadenado de eventos)
  anterior: {                                        // encadenamiento (art. 9.3 analógico a art. 7)
    tipoEvento: String,
    fechaHoraISO: String,
    huella: String,
  },
}, { timestamps: true });

export default model('EventLog', EventLogSchema);
