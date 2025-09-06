// utils/emitirFactura.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { generarHashFactura } from './hashFactura.js';
import { generarVerifactuXML } from './generarVerifactuXML.js';
import { enviarFacturaAEAT } from './enviarAEAT.js'; // <- usa el estructurado que te pasé antes
import { signXadesEnveloped } from '../src/services/xadesService.js';
import RegistroVerifactu from '../src/models/RegistroVerifactu.js';
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
  try {
    const fecha = fechaExpedicion ? new Date(fechaExpedicion) : new Date();

    // 1) Estado VeriFactu desde la BD
    const verifactuEnabled = await getVerifactuEnabled();

    // 2) Hash encadenado
    const ultima = await RegistroVerifactu.findOne().sort({ createdAt: -1 });
    const hashAnterior = ultima?.hashFactura || '0000';
    const hashFactura = generarHashFactura(
      { numeroFactura, fechaExpedicion: fecha, clienteNombre, clienteNIF, importeTotal },
      hashAnterior
    );

    // 3) Crear registro base (SIEMPRE antes de enviar)
    const baseDoc = await RegistroVerifactu.create({
      numeroFactura,
      fechaEnvio: new Date(),
      estado: verifactuEnabled ? 'pendiente' : 'generada',
      hashFactura,
      huellaTCR: hashFactura,
      errores: []
    });

    // 4) Modo LOCAL (sin VeriFactu)
    if (!verifactuEnabled) {
      const xml = await generarVerifactuXML({
        numeroFactura,
        fechaExpedicion: fecha,
        clienteNombre,
        clienteNIF,
        productos,
        importeTotal,
        hashFactura,
        hashAnterior,
      });

      const xmlFirmado = await signXadesEnveloped(xml);

      // Guardar XML en disco (opcional)
      const carpeta = path.resolve(__dirname, '../facturas_emitidas');
      if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
      fs.writeFileSync(path.join(carpeta, `${numeroFactura}.xml`), xmlFirmado, 'utf8');

      await RegistroVerifactu.findByIdAndUpdate(baseDoc._id, {
        $set: { estado: 'generada', xmlFirmado }
      });

      return await RegistroVerifactu.findById(baseDoc._id);
    }

    // 5) Modo VeriFactu (enviar a AEAT)
    try {
      const resp = await enviarFacturaAEAT({
        numeroFactura,
        fechaExpedicion: fecha,
        clienteNombre,
        clienteNIF,
        productos,
        importeTotal,
        hashFactura,
        hashAnterior,
      });

      await RegistroVerifactu.findByIdAndUpdate(baseDoc._id, {
        $set: {
          estado: resp.estado,
          respuestaAEAT: resp.respuestaAEAT,
          xmlAEAT: resp.xmlAEAT
        }
      });

      return await RegistroVerifactu.findById(baseDoc._id);
    } catch (err) {
      await RegistroVerifactu.findByIdAndUpdate(baseDoc._id, {
        $set: { estado: 'error', respuestaAEAT: String(err?.message || err) }
      });
      throw err;
    }
  } catch (error) {
    console.error('❌ Error en emitirFacturaBase:', error);
    throw error;
  }
}
