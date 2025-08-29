import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import generarVerifactuXML from './generarVerifactuXML.js';
import RegistroVerifactu from '../src/models/RegistroVerifactu.js'; // ✅ modelo completo
import { Console } from 'console';

export async function enviarFacturaAEAT(datosFactura) {
  try {
    const xmlSinFirmar = await generarVerifactuXML(datosFactura);

    const tempInPath = join(__dirname, '../../temp-in.xml');
    const tempOutPath = join(__dirname, '../../temp-out.xml');

    writeFileSync(tempInPath, xmlSinFirmar, 'utf8');

    // Firmar usando JAR
    const certPath = join(__dirname, '../../certificados/certificado.p12');
    const certPassword = process.env.CERT_PASSWORD || 'MIKHAILTAL1!';

    const comandoFirma = `java -jar firmador.jar ${tempInPath} ${tempOutPath} ${certPath} ${certPassword}`;
    execSync(comandoFirma);

    const xmlFirmado = readFileSync(tempOutPath, 'utf8');

    // Enviar a AEAT
    const endpoint = process.env.VERIFACTU_ENDPOINT || 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';

    const curlCmd = `curl -k --cert-type P12 --cert ${certPath}:${certPassword} \
      -H "Content-Type: text/xml" \
      --data @${tempOutPath} \
      ${endpoint}`;

    const respuestaAEAT = execSync(curlCmd).toString();

    console.log('✅ Respuesta AEAT:', respuestaAEAT);

    // Guardar en la base de datos
    await RegistroVerifactu.create({
      numeroFactura: datosFactura.numeroFactura,
      xmlFirmado,
      respuestaAEAT,
      estado: respuestaAEAT.includes('<env:Fault>') ? 'error' : 'aceptado',
      fechaEnvio: new Date(),
      hashFactura: datosFactura.hash,
    });

    return respuestaAEAT;
  } catch (err) {
    console.error('❌ Error en enviarFacturaAEAT:', err);
    throw err;
  }
}

export default enviarFacturaAEAT;
