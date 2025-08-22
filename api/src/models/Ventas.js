import { Schema, model } from 'mongoose';

const VentaSchema = new Schema({
  producto: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  cantidad: { type: Number, required: true },
  total: { type: Number, required: true },
  fecha: { type: Date, default: Date.now },
  tipo: { type: String, required: true }
});

export default model('Venta', VentaSchema);
