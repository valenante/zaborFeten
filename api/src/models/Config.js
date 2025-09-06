// models/Config.js
import mongoose from "mongoose";

/**
 * Config global (singleton). Guardamos un único documento con _id = "global".
 * Así evitas restauranteId y puedes upsertear sin líos.
 */
const ConfigSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "global" },

    // === Firma y certificados ===
    certificadoPath: { type: String },
    certificadoSubido: { type: Boolean, default: false },
    certificadoPassword: { type: String }, // ⚠️ mejor encriptar/guardar hash

    // === Declaración responsable ===
    declaracionAceptada: { type: Boolean, default: false },
    fechaDeclaracion: { type: Date },

    // === VeriFactu ===
    verifactuEnabled: { type: Boolean, default: false },
    fechaActivacionVerifactu: { type: Date },

    // === Otros ajustes globales opcionales ===
    permitePedidosComida: { type: Boolean, default: true },
    permitePedidosBebida: { type: Boolean, default: true },
    stockHabilitado: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Config", ConfigSchema);
