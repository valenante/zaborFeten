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

    const huellaAnterior =
      ultima?.huellaTCR ||
      "0000000000000000000000000000000000000000000000000000000000000000";
    const numFacturaAnterior = ultima?.numeroFactura || "0";
    const fechaFacturaAnterior = ultima?.fechaExpedicion
      ? formatFechaDDMMYYYY(ultima.fechaExpedicion)
      : undefined;

    // 3) Helpers
    function formatFechaDDMMYYYY(date) {
      const d = new Date(date);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }

    function getFechaHoraRegistro() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const offsetMinutes = now.getTimezoneOffset();
      const sign = offsetMinutes <= 0 ? "+" : "-";
      const absMinutes = Math.abs(offsetMinutes);
      const hh = String(Math.floor(absMinutes / 60)).padStart(2, "0");
      const mm = String(absMinutes % 60).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${hh}:${mm}`;
    }

    // 4) Tipo de factura
    let tipoFacturaFinal = datos.tipoFactura;
    if (
      (!datos.clienteNombre ||
        datos.clienteNombre.trim() === "" ||
        datos.clienteNombre.trim().toLowerCase() === "consumidor final") &&
      (!datos.clienteNIF || datos.clienteNIF.trim() === "")
    ) {
      tipoFacturaFinal = "F2";
    }

    // 5) Fechas
    const fechaExpedicionDate = datos.fechaExpedicion
      ? new Date(datos.fechaExpedicion)
      : new Date();

    const fechaExpedicionStr = formatFechaDDMMYYYY(fechaExpedicionDate);
    const fechaHoraRegistro = getFechaHoraRegistro();

    // 6) Usar totales recibidos si existen, o calcularlos si faltan
    let baseTotal = Number(datos.baseTotal) || 0;
    let cuotaTotal = Number(datos.cuotaTotal) || 0;

    // ⚙️ Solo recalcular si no vienen en datos
    if ((!baseTotal || !cuotaTotal) && Array.isArray(datos.productos)) {
      for (const p of datos.productos) {
        const iva = Number(p.iva ?? 10);
        const cantidad = Number(p.cantidad ?? 1);
        const pvpUnit = Number(p.precio ?? 0); // PVP (IVA incluido)
        const importeLinea = +(pvpUnit * cantidad).toFixed(2);
        const base = +(importeLinea / (1 + iva / 100)).toFixed(2);
        const cuota = +(importeLinea - base).toFixed(2);
        baseTotal += base;
        cuotaTotal += cuota;
      }
      baseTotal = +baseTotal.toFixed(2);
      cuotaTotal = +cuotaTotal.toFixed(2);
    }

    // 7) Generar huella/hash
    const hashFactura = generarHashFactura({
      tipo,
      idEmisor: nifEmisor,
      numeroFactura: datos.numeroFactura,
      fechaExpedicion: fechaExpedicionStr,
      tipoFactura: tipoFacturaFinal,
      cuotaTotal,
      importeTotal: datos.importeTotal || baseTotal + cuotaTotal,
      huellaAnterior,
      fechaHoraRegistro,
      anulacion: datos.anulacion,
      evento: datos.evento,
    });

    // 8) Guardar en BD
    const baseDoc = await RegistroVerifactu.create({
      tipo,
      numeroFactura: datos.numeroFactura,
      fechaExpedicion: fechaExpedicionDate, // Date real
      fechaEnvio: new Date(),
      estado: verifactuEnabled ? "pendiente" : "generada",
      hashFactura,
      hashAnterior: huellaAnterior,
      fechaHoraHusoGenRegistro: fechaHoraRegistro,
      cuotaTotal,
      importeTotal: Number(datos.importeTotal) || 0,
      huellaTCR: hashFactura,
      errores: [],
    });

    // 9) Generar XML
    // 9) Generar XML
    const xml = buildVerifactuXML({
      tipo,
      ...datos,
      fechaExpedicion: fechaExpedicionStr,
      nombreEmisor,
      nifEmisor,
      baseTotal,            // ✅ valores corregidos
      cuotaTotal,           // ✅ valores corregidos
      importeTotal: +(datos.importeTotal || baseTotal + cuotaTotal).toFixed(2),
      huellaAnterior,
      numFacturaAnterior,
      fechaFacturaAnterior,
      huellaNueva: hashFactura,
      fechaHoraRegistro,
      tipoFactura: tipoFacturaFinal,
    });

    // 10) Firmar XML
    const xmlFirmado = await signXadesEnveloped(xml, {
      pfxPath: path.resolve(__dirname, "../certs/certificado.pfx"),
      pfxPassword: process.env.CERT_PASSWORD || "1234",
      signatureId: `xmldsig-${baseDoc._id}`,
    });

    // 11) Guardar local o enviar
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

    if (verifactuEnabled) {
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
    }
  } catch (error) {
    console.error("❌ Error en emitirRegistroVerifactu:", error);
    throw error;
  }
}
