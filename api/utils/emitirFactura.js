// utils/emitirFactura.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { generarHashFactura } from "./hashFactura.js";
import { generarVerifactuXML } from "./generarVerifactuXML.js";
import { enviarFacturaAEAT } from "./enviarAEAT.js";
import { signXadesEnveloped } from "../src/services/xadesService.js";
import RegistroVerifactu from "../src/models/RegistroVerifactu.js";
import { getVerifactuEnabled } from "../src/services/config.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function emitirFacturaBase({
  numeroFactura,
  fechaExpedicion,
  clienteNombre,
  clienteNIF,
  productos,
  importeTotal,
}) {
  console.log(clienteNombre, clienteNIF, "➡️ en emitirFacturaBase");

  try {
    const fecha = fechaExpedicion ? new Date(fechaExpedicion) : new Date();

    // 1) Estado VeriFactu desde la BD
    const verifactuEnabled = await getVerifactuEnabled();

    // 👉 Datos dinámicos del emisor
    const nombreEmisor =
      process.env.EMPRESA_NOMBRE || "ANTENUCCI AGUILAR VALENTINO NAHUEL";
    const nifEmisor = process.env.EMPRESA_NIF || "X6063327K";

    // 2) Hash encadenado
    const ultima = await RegistroVerifactu.findOne().sort({ createdAt: -1 });
    const huellaAnterior = ultima?.huellaTCR || ""; // ⚠️ usar huella real, no hashFactura interno

    // 3) Calcular cuota total de los productos (IVA)
    const cuotaTotal = productos.reduce((acc, p) => {
      const iva = p.iva ?? 10; // por defecto 10% en restaurantes
      const base = (p.precio || 0) * (p.cantidad || 1);
      return acc + (base * iva) / 100;
    }, 0);

    // 4) Fecha/hora registro AEAT
    const fechaHoraRegistro = new Date().toISOString().split(".")[0] + "+02:00";

    // 5) Generar hash/huella
    const hashFactura = generarHashFactura({
      numeroFactura,
      fechaExpedicion: fecha,
      tipoFactura: "F1",
      cuotaTotal,
      importeTotal,
      idEmisor: nifEmisor,
      huellaAnterior,
      fechaHoraRegistro,
    });

    // 6) Crear registro base
    const baseDoc = await RegistroVerifactu.create({
      numeroFactura,
      fechaEnvio: new Date(),
      estado: verifactuEnabled ? "pendiente" : "generada",
      hashFactura,
      huellaTCR: hashFactura,
      errores: [],
    });

    // 7) Modo LOCAL (sin VeriFactu)
    if (!verifactuEnabled) {
      const xml = await generarVerifactuXML({
        numeroFactura,
        fechaExpedicion: fecha,
        nombreEmisor,
        nifEmisor,
        clienteNombre,
        clienteNIF,
        productos,
        importeTotal,
        hashFactura,
        hashAnterior: huellaAnterior,
        cuotaTotal
      });

      const xmlFirmado = await signXadesEnveloped(xml);

      const carpeta = path.resolve(__dirname, "../facturas_emitidas");
      if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
      fs.writeFileSync(path.join(carpeta, `${numeroFactura}.xml`), xmlFirmado, "utf8");

      await RegistroVerifactu.findByIdAndUpdate(baseDoc._id, {
        $set: { estado: "generada", xmlFirmado },
      });

      return await RegistroVerifactu.findById(baseDoc._id);
    }

    // 8) Modo VeriFactu (enviar a AEAT)
    try {
      const resp = await enviarFacturaAEAT({
        numeroFactura,
        fechaExpedicion: fecha,
        nombreEmisor,
        nifEmisor,
        clienteNombre,
        clienteNIF,
        productos,
        importeTotal,
        hashFactura,
        hashAnterior: huellaAnterior,
        cuotaTotal
      });

      await RegistroVerifactu.findByIdAndUpdate(baseDoc._id, {
        $set: {
          estado: resp.estado,
          respuestaAEAT: resp.respuestaAEAT,
          xmlAEAT: resp.xmlAEAT,
        },
      });

      return await RegistroVerifactu.findById(baseDoc._id);
    } catch (err) {
      await RegistroVerifactu.findByIdAndUpdate(baseDoc._id, {
        $set: { estado: "error", respuestaAEAT: String(err?.message || err) },
      });
      throw err;
    }
  } catch (error) {
    console.error("❌ Error en emitirFacturaBase:", error);
    throw error;
  }
}
