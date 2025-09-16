import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function enviarFacturaAEAT(xml) {
  try {
    // 1. Generar XML sin firmar
    const tempInPath = join(__dirname, '../../temp-in.xml');
    const tempOutPath = join(__dirname, '../../temp-out.xml');
    writeFileSync(tempInPath, xml, 'utf8');

    // 2. Firmar usando JAR
    const certPath = process.env.CERT_PATH || join(__dirname, '../certificados/certificado.p12');
    const certPassword = process.env.CERT_PASSWORD || 'MIKHAILTAL1!';

    const comandoFirma = `java -jar firmador.jar "${tempInPath}" "${tempOutPath}" "${certPath}" "${certPassword}"`;
    execSync(comandoFirma, { stdio: 'pipe' });

    const xmlFirmado = readFileSync(tempOutPath, 'utf8');

    // 3. Enviar a AEAT
    const endpoint = process.env.VERIFACTU_ENDPOINT ||
      'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';

    const curlCmd = `curl -s --http1.1 --tlsv1.2 --cert-type P12 --cert "${certPath}:${certPassword}" \
      -H "Content-Type: text/xml; charset=utf-8" \
      --data-binary @"${tempOutPath}" \
      "${endpoint}"`;

    const respuestaAEAT = execSync(curlCmd, { stdio: 'pipe' }).toString();

    // 4. Determinar estado en base a respuesta
    let estado = 'enviado';
    if (respuestaAEAT.includes('<faultcode>')) {
      estado = 'error';
    } else if (respuestaAEAT.includes('<EstadoEnvio>Correcto</EstadoEnvio>')) {
      estado = 'correcto';
    } else if (respuestaAEAT.includes('<EstadoEnvio>ParcialmenteCorrecto</EstadoEnvio>')) {
      estado = 'aceptadoConErrores';
    } else if (respuestaAEAT.includes('Incorrecto')) {
      estado = 'incorrecto';
    }

    // 5. Devolver objeto estructurado
    return {
      estado,
      respuestaAEAT,
      xmlFirmado,        // lo que mandaste
      xmlRespuesta: respuestaAEAT // lo que recibiste
    };
  } catch (err) {
    console.error('❌ Error en enviarFacturaAEAT:', err);
    return {
      estado: 'error',
      respuestaAEAT: String(err?.message || err),
      xmlFirmado: null,
      xmlRespuesta: null
    };
  }
}

export default enviarFacturaAEAT;
