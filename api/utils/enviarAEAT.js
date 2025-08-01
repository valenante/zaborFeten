import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { mapFacturaToVerifactu } from './verifactuMapper.js';

const basePath = path.join(process.cwd(), 'certificados');

export async function enviarFacturaAEAT(factura) {
  const CERT_PATH = path.join(basePath, 'certificado.pem');
  const KEY_PATH = path.join(basePath, 'certificado.key');
  const PASS_PATH = path.join(basePath, 'certificado.p12.pass');

  if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH) || !fs.existsSync(PASS_PATH)) {
    throw new Error('❌ No se encontraron certificado, clave o contraseña en la carpeta certificados');
  }

  const cert = fs.readFileSync(CERT_PATH);
  const key = fs.readFileSync(KEY_PATH);
  const passphrase = fs.readFileSync(PASS_PATH, 'utf-8').trim();

  const httpsAgent = new https.Agent({
    cert,
    key,
    passphrase,
    rejectUnauthorized: false,
  });

  const json = mapFacturaToVerifactu(factura);

  try {
    const res = await axios.post(
      'https://prewww10.aeat.es/webservices-verifactu/FACT/wsFacturacion/verifactu',
      json,
      {
        httpsAgent,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Envío a AEAT exitoso:', res.data);
    return res.data;
  } catch (error) {
    console.error('❌ Error al enviar factura a AEAT:', error.response?.data || error.message);
    throw error;
  }
}
