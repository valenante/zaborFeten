import { generarHashFactura } from './hashFactura.js';
import { generarFacturaXML } from './generarFacturaXML.js';
import { enviarFacturaAEAT } from './enviarAEAT.js';
import { firmarFacturaConJava } from './firmarFactura.js';
import FacturaHash from '../src/models/FacturaHash.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const modoVerifactu = process.env.MODO_VERIFACTU === 'true';
// Obtener __dirname equivalente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rutaCertificado = path.resolve(__dirname, '../certificados/certificado.p12');

export async function emitirFacturaBase({
  numeroFactura,
  fechaExpedicion,
  clienteNombre,
  clienteNIF,
  productos,
  importeTotal,
}) {
  const ultimaFactura = await FacturaHash.findOne().sort({ createdAt: -1 });
  const hashAnterior = ultimaFactura?.hash || '0000';
  const hash = generarHashFactura(
    { numeroFactura, fechaExpedicion, clienteNombre, clienteNIF, importeTotal },
    hashAnterior
  );

  const datosFactura = {
    numeroFactura,
    fechaExpedicion,
    clienteNombre,
    clienteNIF,
    productos,
    importeTotal,
    hash,
    hashAnterior,
  };

  let xmlFirmado = null;

  if (!modoVerifactu) {
    // Firmar con java
    const xml = generarFacturaXML(datosFactura);
    xmlFirmado = await firmarFacturaConJava(
      xml,
      rutaCertificado,
      'MIKHAILTAL1!'
    );

    datosFactura.xmlFirmado = xmlFirmado;

    // Guardar XML firmado en archivo (opcional)
    const carpetaFacturas = path.resolve('facturas_emitidas');
    if (!fs.existsSync(carpetaFacturas)) fs.mkdirSync(carpetaFacturas);
    const ruta = path.join(carpetaFacturas, `${numeroFactura}.xml`);
    fs.writeFileSync(ruta, xmlFirmado);
  } else {
    // Enviar a AEAT si está en modo VERI*FACTU
    await enviarFacturaAEAT(datosFactura);
  }

  // Guardar factura en DB (con el xml firmado si aplica)
  const nuevaFactura = new FacturaHash(datosFactura);
  await nuevaFactura.save();

  return nuevaFactura;
}
