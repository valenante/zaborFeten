import axios from 'axios';
import https from 'https';
import fs from 'fs';
import { mapFacturaToVerifactu } from './verifactuMapper.js';

const CERT_PATH = './certificados/certificado.pem';
const KEY_PATH = './certificados/clave.key';
const CERT_PASSPHRASE = 'MIKHAILTAL1!';

const httpsAgent = new https.Agent({
  cert: fs.readFileSync(CERT_PATH),
  key: fs.readFileSync(KEY_PATH),
  passphrase: CERT_PASSPHRASE,
  rejectUnauthorized: false
});

export async function enviarFacturaAEAT(factura) {
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
