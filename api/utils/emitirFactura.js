// utils/emitirFactura.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { generarHashFactura } from "./hashFactura.js";
import { buildVerifactuXML } from "./plantillaVerifactu.js";
import { enviarFacturaAEAT } from "./enviarAEAT.js";
import { signXadesEnveloped } from "../src/services/xadesService.js";
import RegistroVerifactu from "../src/models/RegistroVerifactu.js";
import { getVerifactuEnabled } from "../src/services/config.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function emitirRegistroVerifactu({ tipo = "alta", datos }) {
  try {
    // 1) Estado VeriFactu desde la BD
    const verifactuEnabled = await getVerifactuEnabled();

    // 👉 Datos dinámicos del emisor
    const nombreEmisor =
      process.env.EMPRESA_NOMBRE || "ANTENUCCI AGUILAR VALENTINO NAHUEL";
    const nifEmisor = process.env.EMPRESA_NIF || "X6063327K";

    // 2) Última factura encadenada
    const ultima = await RegistroVerifactu.findOne().sort({ createdAt: -1 });

    const huellaAnterior = ultima?.huellaTCR || "0000000000000000000000000000000000000000000000000000000000000000";
    const numFacturaAnterior = ultima?.numeroFactura || "0";
    const fechaFacturaAnterior = ultima?.fechaExpedicion
      ? new Date(ultima.fechaExpedicion).toISOString().split("T")[0]
      : "01-01-1900";

    // 3) Preparar datos comunes
    function formatFechaDDMMYYYY(date) {
      const d = new Date(date);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }

    // 3.1) Determinar tipoFactura según datos de cliente
    let tipoFacturaFinal = datos.tipoFactura || "F1"; // por defecto F1

    if (
      (!datos.clienteNombre || datos.clienteNombre.trim() === "" || datos.clienteNombre.trim().toLowerCase() === "consumidor final") &&
      (!datos.clienteNIF || datos.clienteNIF.trim() === "")
    ) {
      tipoFacturaFinal = "F2";
    }

    const fechaExpedicion = formatFechaDDMMYYYY(datos.fechaExpedicion || new Date());

    const cuotaTotal =
      tipo === "alta"
        ? datos.productos.reduce((acc, p) => {
          const iva = p.iva ?? 10;
          const base = (p.precio || 0) * (p.cantidad || 1);
          return acc + (base * iva) / 100;
        }, 0)
        : 0;

    function getFechaHoraRegistro() {
      const now = new Date();

      // Formato YYYY-MM-DDTHH:MM:SS
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      // Offset respecto a UTC
      const offsetMinutes = now.getTimezoneOffset(); // ej: -120 para UTC+2
      const sign = offsetMinutes <= 0 ? "+" : "-";
      const absMinutes = Math.abs(offsetMinutes);
      const hh = String(Math.floor(absMinutes / 60)).padStart(2, "0");
      const mm = String(absMinutes % 60).padStart(2, "0");

      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${hh}:${mm}`;
    }

    const fechaHoraRegistro = getFechaHoraRegistro();

    // 4) Generar huella según tipo
    const hashFactura = generarHashFactura({
      tipo,
      idEmisor: nifEmisor,
      numeroFactura: datos.numeroFactura,
      fechaExpedicion: fechaExpedicion,
      tipoFactura: tipoFacturaFinal,
      cuotaTotal,
      importeTotal: datos.importeTotal,
      huellaAnterior,
      fechaHoraRegistro,
      anulacion: datos.anulacion, // solo si tipo=anulacion
      evento: datos.evento,       // solo si tipo=evento
    });

    // 5) Crear documento en BD
    const baseDoc = await RegistroVerifactu.create({
      tipo,
      numeroFactura: datos.numeroFactura,
      fechaExpedicion: fechaExpedicion,
      fechaEnvio: new Date(),
      estado: verifactuEnabled ? "pendiente" : "generada",
      hashFactura,
      huellaTCR: hashFactura,
      errores: [],
    });

    // 6) Generar XML en función del tipo
    const xml = buildVerifactuXML({
      tipo,
      ...datos,
      fechaExpedicion,
      nombreEmisor,
      nifEmisor,
      cuotaTotal,
      huellaAnterior,
      numFacturaAnterior,
      fechaFacturaAnterior,
      huellaNueva: hashFactura,
      fechaHoraRegistro,
      tipoFactura: tipoFacturaFinal,
    });

    // 7) Firmar XML
    const xmlFirmado = await signXadesEnveloped(xml, {
      pfxPath: path.resolve(__dirname, "../certs/certificado.pfx"),
      pfxPassword: process.env.CERT_PASSWORD || "1234",
      signatureId: `xmldsig-${baseDoc._id}`,
    });

    // 8) Guardar local o enviar
    if (!verifactuEnabled) {
      const carpeta = path.resolve(__dirname, "../facturas_emitidas");
      if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
      fs.writeFileSync(
        path.join(carpeta, `${datos.numeroFactura || tipo}_${Date.now()}.xml`),
        xmlFirmado,
        "utf8"
      );

      await RegistroVerifactu.findByIdAndUpdate(baseDoc._id, {
        $set: { estado: "generada", xmlFirmado },
      });

      return await RegistroVerifactu.findById(baseDoc._id);
    }

    // 9) Enviar a AEAT (modo VeriFactu)
    try {
      const resp = await enviarFacturaAEAT(xml);

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
    console.error("❌ Error en emitirRegistroVerifactu:", error);
    throw error;
  }
}
