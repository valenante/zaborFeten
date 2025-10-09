
import mongoose from 'mongoose';

const eventoFacturaSchema = new mongoose.Schema({
  tipoEvento: { type: String, required: true }, // "rectificación", "creación", etc.
  numeroFactura: { type: String, required: true },
  clienteNombre: { type: String, required: function () { return !this.facturaSinIdentificar; } },
  clienteNIF: { type: String, required: function () { return !this.facturaSinIdentificar; } },
  facturaSinIdentificar: { type: Boolean, default: false },
  motivo: { type: String },
  importeTotal: { type: Number, required: true },
  fecha: { type: Date, default: Date.now },
  hashFactura: { type: String }, // Este campo es útil si quieres almacenar el hash de la factura
  facturaOriginalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegistroVerifactu',
  },
  facturaRectificativaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegistroVerifactu',
  },
});

const EventoFactura = mongoose.model('EventoFactura', eventoFacturaSchema);
export default EventoFactura;
