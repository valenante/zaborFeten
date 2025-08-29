import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JAR = process.env.VERIFACTU_JAR_PATH;
const CERT = process.env.VERIFACTU_P12_PATH;
const PASS = process.env.VERIFACTU_P12_PASS;

export async function signXadesEnveloped(xml) {
  console.log("🛠 [signXadesEnveloped] INICIO");

  if (process.env.VERIFACTU_SIGN_ENABLED !== "true") {
    console.log("⚠️ Firma desactivada por variable de entorno VERIFACTU_SIGN_ENABLED");
    return xml;
  }

  const tempIn = path.join(__dirname, "../../temp-in.xml");
  const tempOut = path.join(__dirname, "../../temp-out.xml");

  try {
    console.log("📄 Guardando XML sin firmar en:", tempIn);
    await fs.writeFile(tempIn, xml, "utf8");

    console.log("☕ Ejecutando JAR para firmar:");
    console.log("   📁 JAR:", JAR);
    console.log("   🔐 CERT:", CERT);
    console.log("   🔑 PASS:", PASS ? "(oculto)" : "(vacío)");
    console.log("   📥 IN:", tempIn);
    console.log("   📤 OUT:", tempOut);

    await new Promise((resolve, reject) => {
      execFile("java", ["-jar", JAR, tempIn, tempOut, CERT, PASS], (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Error al ejecutar firmador:");
          console.error("   ❗ STDERR:", stderr);
          console.error("   ❗ STDOUT:", stdout);
          return reject(err);
        }
        console.log("✅ Firma ejecutada correctamente");
        console.log("   📤 STDOUT:", stdout);
        console.log("   📤 STDERR:", stderr);
        resolve();
      });
    });

    const xmlFirmado = await fs.readFile(tempOut, "utf8");

    console.log("📄 XML firmado cargado con éxito desde:", tempOut);
    console.log("📑 Primeros 5 líneas del XML firmado:");
    console.log(xmlFirmado.split("\n").slice(0, 5).join("\n"));

    return xmlFirmado;
  } catch (error) {
    console.error("❌ Error general en signXadesEnveloped:", error.message);
    throw error;
  }
}

export async function verifyXades(xml) {
  if (!xml || typeof xml !== 'string') return { ok: false, error: 'XML vacío' };

  const contieneFirma = /<(ds:)?Signature[\s>]/i.test(xml);
  const contieneNsFirma = xml.includes('http://www.w3.org/2000/09/xmldsig#');
  const contieneXades = xml.includes('http://uri.etsi.org/01903/v1.3.2#');

  return {
    ok: true,
    signed: contieneFirma && contieneNsFirma,
    tipo: contieneXades ? 'XAdES' : 'XMLDSig',
  };
}


