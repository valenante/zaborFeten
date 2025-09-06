// controllers/verifactuController.js
import { create } from 'xmlbuilder2';
import { SIF } from '../config/verifactuConfig.js';
import { nowISOWithTZ, huellaAlta, huellaAnulacion } from '../services/verifactuHashService.js';
import { signXadesEnveloped } from "../services/xadesService.js"
import { verifyXades } from '../services/xadesService.js';
import RegistroVerifactu from '../models/RegistroVerifactu.js';
import https from 'https';
import axios from 'axios';
import fs from 'fs';
import path from 'path';


export async function getPrevRegistro(otNif) {
  return await RegistroVerifactu.findOne({ otNif }).sort({ createdAt: -1 }).lean();
}

/**
 * Guarda un nuevo registro Verifactu
 */
export async function saveNuevoRegistro(data) {
  const registro = new RegistroVerifactu(data);
  return await registro.save();
}

// ──────────────────────────────────────────────────────────────
// Bloque 6: <SistemaInformatico> como NODO (no string)
// ──────────────────────────────────────────────────────────────
function buildSistemaInformaticoNode({ multiplesOT = 1 } = {}) {
  const si = create().ele('SistemaInformatico');
  si.ele('NombreRazon').txt(SIF.productor.nombreRazon).up();
  si.ele('NIF').txt(SIF.productor.nif).up();
  si.ele('NombreSistemaInformatico').txt(SIF.sistema.nombre).up();
  si.ele('IdSistemaInformatico').txt(SIF.sistema.id).up();
  si.ele('Version').txt(SIF.sistema.version).up();
  si.ele('NumeroInstalacion').txt(SIF.sistema.numeroInstalacion).up();
  si.ele('TipoUsoPosibleSoloVerifactu').txt(SIF.sistema.soloVerifactu).up(); // 'S'/'N'
  si.ele('TipoUsoPosibleMultiOT').txt(SIF.sistema.multiOT).up();             // 'S'/'N'
  si.ele('IndicadorMultiplesOT').txt(
    typeof SIF.sistema.indicadorMultiplesOT === 'function'
      ? SIF.sistema.indicadorMultiplesOT(multiplesOT)
      : (multiplesOT > 1 ? 'S' : 'N')
  ).up();
  return si; // ← devolvemos el nodo XMLBuilder
}

/**
 * Enviar a AEAT en entorno de PRUEBAS
 */

// Helper para sobre SOAP (ajusta la operación según WSDL)
function buildSoapEnvelope(xmlFirmado) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
${xmlFirmado}
  </soapenv:Body>
</soapenv:Envelope>`.trim();
}


export const enviarAEAT = async (req, res) => {
  try {
    let { xml } = req.body;
    if (!xml || typeof xml !== "string") {
      return res.status(400).json({ error: "XML no proporcionado o inválido" });
    }

    // (opcional) limpiar encabezado si duplicas más abajo
    // xml = xml.replace(/<\?xml[^>]*\?>\s*/i, "");

    // 1) Firmar XAdES (enveloped)
    let xmlFirmado = await signXadesEnveloped(xml);
    xmlFirmado = xmlFirmado.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
    if (!xmlFirmado.includes("<ObligadoEmision")) {
      console.warn("⚠️ ObligadoEmision NO está en el XML final que se envía");
    }

    // 2) Envolver en SOAP (literal, sin wrappers)
    const soapEnvelope = buildSoapEnvelope(xmlFirmado);

    // 3) mTLS con P12
    const pfx = fs.readFileSync(path.resolve(process.env.VERIFACTU_P12_PATH));
    const agent = new https.Agent({
      pfx,
      passphrase: process.env.VERIFACTU_P12_PASS,
      rejectUnauthorized: true,     // mejor true
      keepAlive: true,
      minVersion: "TLSv1.2",
      // ca: fs.readFileSync('/ruta/cadena_fnmt.pem') // si tu entorno lo requiere
    });

    const { data, status, headers } = await axios.post(
      process.env.VERIFACTU_ENDPOINT,
      soapEnvelope,
      {
        httpsAgent: agent,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": ""  // según WSDL
        },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    return res.status(200).json({
      ok: status >= 200 && status < 300,
      status,
      headers,
      respuestaAEAT: data
    });
  } catch (error) {
    const status = error?.response?.status || 500;
    return res.status(500).json({
      ok: false,
      status,
      error: error?.response?.data || error.message
    });
  }
};

// ──────────────────────────────────────────────────────────────
// POST /api/v1/verifactu/registros/alta
// ──────────────────────────────────────────────────────────────
export const crearRegistroAlta = async (req, res) => {
  try {
    console.log("📥 [crearRegistroAlta] Body:", JSON.stringify(req.body, null, 2));

    const { ot, factura } = req.body;

    if (!ot?.nif) {
      console.error("❌ Falta NIF del obligado");
      return res.status(400).json({ error: 'Falta NIF del obligado' });
    }

    if (!factura?.numSerie || !factura?.fechaExpedicion || !factura?.tipoFactura) {
      console.error("❌ Faltan campos en factura");
      return res.status(400).json({ error: 'Faltan campos de factura: numSerie, fechaExpedicion, tipoFactura' });
    }

    const nif = "x6063327k";
    const prev = await getPrevRegistro(nif);
    console.log("📚 Registro anterior:", prev);

    const fechaHoraGenISO = nowISOWithTZ();
    console.log("🕒 FechaHoraGenISO:", fechaHoraGenISO);

    const huella = huellaAlta({
      nifEmisor: nif,
      numSerie: factura.numSerie,
      fechaExpedicion: factura.fechaExpedicion,
      tipoFactura: factura.tipoFactura,
      cuotaTotal: factura.cuotaTotal ?? 0,
      importeTotal: factura.importeTotal ?? 0,
      huellaAnterior: prev?.huella || '',
      fechaHoraGenISO,
    });

    console.log("🔐 Huella:", huella);

    // Construcción XML
    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('RegistroAlta');
    root.ele('IDVersion').txt('1.0').up();
    const id = root.ele('IDFactura');
    id.ele('IDEmisorFactura').txt(nif).up();
    id.ele('NumSerieFactura').txt(factura.numSerie).up();
    id.ele('FechaExpedicionFactura').txt(factura.fechaExpedicion).up();
    id.up();

    if (ot?.nombreRazon) root.ele('NombreRazonEmisor').txt(ot.nombreRazon).up();
    root.ele('Subsanacion').txt('N').up();
    root.ele('RechazoPrevio').txt('N').up();
    root.ele('TipoFactura').txt(factura.tipoFactura).up();

    const enc = root.ele('Encadenamiento');

    if (!prev) {
      enc.ele('PrimerRegistro').txt('S').up();
    } else {
      const ra = enc.ele('RegistroAnterior');
      ra.ele('IDEmisorFactura').txt(prev.idEmisor).up();
      ra.ele('NumSerieFactura').txt(prev.numSerie).up();
      ra.ele('FechaExpedicionFactura').txt(prev.fechaExpedicion).up();
      ra.ele('Huella').txt((prev.huella || '').slice(0, 64)).up();
      ra.up();
    }

    enc.import(buildSistemaInformaticoNode({ multiplesOT: 1 }).root());
    enc.ele('FechaHoraHusoGenRegistro').txt(fechaHoraGenISO).up();
    enc.ele('TipoHuella').txt('01').up();
    enc.ele('Huella').txt(huella).up();
    enc.up();

    const xmlSinFirma = root.end({ prettyPrint: true });
    console.log("📄 XML generado:\n", xmlSinFirma);

    const xmlFirmado = await signXadesEnveloped(xmlSinFirma);
    console.log("✅ XML firmado correctamente");

    await saveNuevoRegistro({
      otNif: nif,
      tipo: 'alta',
      idEmisor: nif,
      numSerie: factura.numSerie,
      fechaExpedicion: factura.fechaExpedicion,
      fechaHoraGenISO,
      huella,
    });

    res.type('application/xml').status(201).send(xmlFirmado);
  } catch (e) {
    console.error("❌ Error en crearRegistroAlta:", e);
    res.status(400).json({ error: e.message });
  }
};

// ──────────────────────────────────────────────────────────────
export const crearRegistroAnulacion = async (req, res) => {
  try {
    const { ot, factura } = req.body;
    if (!ot?.nif) return res.status(400).json({ error: 'Falta NIF del obligado' });
    if (!factura?.numSerie || !factura?.fechaExpedicion) {
      return res.status(400).json({ error: 'Faltan campos de factura: numSerie, fechaExpedicion' });
    }

    const nif = ot.nif;
    const prev = await getPrevRegistro(nif);
    const fechaHoraGenISO = nowISOWithTZ();

    const huella = huellaAnulacion({
      nifEmisor: nif,
      numSerie: factura.numSerie,
      fechaExpedicion: factura.fechaExpedicion,
      huellaAnterior: prev?.huella || '',
      fechaHoraGenISO,
    });

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('RegistroAnulacion');
    root.ele('IDVersion').txt('1.0').up();

    const id = root.ele('IDFactura');
    id.ele('IDEmisorFacturaAnulada').txt(nif).up();
    id.ele('NumSerieFacturaAnulada').txt(factura.numSerie).up();
    id.ele('FechaExpedicionFacturaAnulada').txt(factura.fechaExpedicion).up();
    id.up();

    root.ele('RefExterna').txt('').up();
    root.ele('SinRegistroPrevio').txt('N').up(); // L4
    root.ele('RechazoPrevio').txt('N').up();     // L4

    const enc = root.ele('Encadenamiento');
    if (!prev) {
      enc.ele('PrimerRegistro').txt('S').up();
    } else {
      const ra = enc.ele('RegistroAnterior');
      ra.ele('IDEmisorFactura').txt(prev.idEmisor).up();
      ra.ele('NumSerieFactura').txt(prev.numSerie).up();
      ra.ele('FechaExpedicionFactura').txt(prev.fechaExpedicion).up();
      ra.ele('Huella').txt((prev.huella || '').slice(0, 64)).up();
      ra.up();
    }
    enc.import(buildSistemaInformaticoNode({ multiplesOT: 1 }).root());
    enc.ele('FechaHoraHusoGenRegistro').txt(fechaHoraGenISO).up();
    enc.ele('TipoHuella').txt('01').up();
    enc.ele('Huella').txt(huella).up();
    enc.up();

    const xmlSinFirma = root.end({ prettyPrint: true });
    const xmlFirmado = await signXadesEnveloped(xmlSinFirma);

    await saveNuevoRegistro({
      otNif: nif,
      tipo: 'anulacion',
      idEmisor: nif,
      numSerie: factura.numSerie,
      fechaExpedicion: factura.fechaExpedicion,
      fechaHoraGenISO,
      huella,
    });

    res.type('application/xml').status(201).send(xmlFirmado);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// Nuevo: verificación (recibe { xml } o texto)
export const verificarFirma = async (req, res) => {
  try {
    let xml = req.body.xml;

    if (!xml && req.body.xmlBase64) {
      const buff = Buffer.from(req.body.xmlBase64, 'base64');
      xml = buff.toString('utf8');
    }

    if (!xml) {
      return res.status(400).json({ ok: false, error: 'Falta XML para verificar' });
    }

    const result = await verifyXades(xml);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};