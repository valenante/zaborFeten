// utils/emitirFactura.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { generarHashFactura } from './hashFactura.js';          // si sigues usando tu hash simple
import { generarVerifactuXML } from './generarVerifactuXML.js';      // tu XML “interno” (no VERI*FACTU)
import { enviarFacturaAEAT } from './enviarAEAT.js';             // tu stub de envío (modo VERI*FACTU)

// 👇 NUEVO: usamos el servicio de firma XAdES que llama a firmador.jar
import { signXadesEnveloped } from '../src/services/xadesService.js';

// Si persistes la cadena/último hash/factura:
import registroVerifactus from '../src/models/RegistroVerifactu.js';

// __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// “modo verifactu” = true => no firmamos tu XML interno; en su lugar,
// generas los bloques de remisión y los envías con enviarFacturaAEAT()
const modoVerifactu = String(process.env.MODO_VERIFACTU || 'false').toLowerCase() === 'true';

export async function emitirFacturaBase({
  numeroFactura,
  fechaExpedicion,
  clienteNombre,
  clienteNIF,
  productos,
  importeTotal,
}) {
  try {
    // normaliza fecha
    const fecha = fechaExpedicion ? new Date(fechaExpedicion) : new Date();

    // tu cadena/encadenamiento “interno” (si lo sigues usando)
    const ultima = await registroVerifactus.findOne().sort({ createdAt: -1 });
    const hashAnterior = ultima?.hash || '0000';

    const hash = generarHashFactura(
      { numeroFactura, fechaExpedicion: fecha, clienteNombre, clienteNIF, importeTotal },
      hashAnterior
    );

    const datosFactura = {
      numeroFactura,
      fechaExpedicion: fecha,
      clienteNombre,
      clienteNIF,
      productos,
      importeTotal,
      hashFactura: hash,
      hashAnterior,
    };

    let xmlFirmado = null;

    if (!modoVerifactu) {
      // 1) Construyes tu XML “interno”
      const xml = await generarVerifactuXML(datosFactura);

      // 2) Lo firmas con XAdES (el servicio usa firmador.jar si VERIFACTU_SIGN_ENABLED=true)
      //    Si VERIFACTU_SIGN_ENABLED=false, devuelve el XML tal cual (útil para dev)
      xmlFirmado = await signXadesEnveloped(xml);
      datosFactura.xmlFirmado = xmlFirmado;

      // 3) Guardar en disco (opcional)
      const carpetaFacturas = path.resolve(__dirname, '../facturas_emitidas');
      if (!fs.existsSync(carpetaFacturas)) fs.mkdirSync(carpetaFacturas, { recursive: true });
      const ruta = path.join(carpetaFacturas, `${numeroFactura}.xml`);
      fs.writeFileSync(ruta, xmlFirmado, 'utf8');
    } else {
      // Modo VERI*FACTU: en vez de firmar “tu” XML, prepara Bloque1+2 y remite
      // (tu enviarFacturaAEAT debería construir la Cabecera + RegistroFactura y hacer POST a la AEAT cuando esté disponible)
      await enviarFacturaAEAT(datosFactura);
    }

    // Persiste el “último” para tu cadena interna
    const nuevaFactura = new registroVerifactus(datosFactura);
    await nuevaFactura.save();

    return nuevaFactura;
  } catch (error) {
    console.error('Error en emitirFacturaBase:', error);
    throw error;
  }
}
