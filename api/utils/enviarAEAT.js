import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import generarVerifactuXML from './generarVerifactuXML.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function enviarFacturaAEAT(datosFactura) {
  try {
    // 1. Generar XML sin firmar
    const xmlSinFirmar = await generarVerifactuXML(datosFactura);

    const tempInPath = join(__dirname, '../../temp-in.xml');
    const tempOutPath = join(__dirname, '../../temp-out.xml');

    writeFileSync(tempInPath, xmlSinFirmar, 'utf8');

    // 2. Firmar usando JAR
    const certPath = join(__dirname, '../certificados/certificado.p12');
    const certPassword = process.env.CERT_PASSWORD || 'MIKHAILTAL1!';

    const comandoFirma = `java -jar firmador.jar ${tempInPath} ${tempOutPath} ${certPath} ${certPassword}`;
    execSync(comandoFirma);

    const xmlFirmado = readFileSync(tempOutPath, 'utf8');

    // 3. Enviar a AEAT
    const endpoint =
      process.env.VERIFACTU_ENDPOINT ||
      'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';

    const curlCmd = `curl -s -k --cert-type P12 --cert ${certPath}:${certPassword} \
      -H "Content-Type: text/xml" \
      --data @${tempOutPath} \
      ${endpoint}`;

    const respuestaAEAT = execSync(curlCmd).toString();

    // 4. Determinar estado en base a respuesta
    let estado = 'enviado';
    if (respuestaAEAT.includes('<faultcode>')) {
      estado = 'error';
    } else if (respuestaAEAT.includes('Aceptado')) {
      estado = 'aceptado';
    } else if (respuestaAEAT.includes('Rechazado')) {
      estado = 'rechazado';
    }

    // 5. Devolver objeto estructurado
    return {
      estado,
      respuestaAEAT,
      xmlAEAT: xmlFirmado
    };
  } catch (err) {
    console.error('❌ Error en enviarFacturaAEAT:', err);
    return {
      estado: 'error',
      respuestaAEAT: String(err?.message || err),
      xmlAEAT: null
    };
  }
}

export default enviarFacturaAEAT;
