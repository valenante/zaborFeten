// src/services/firmadorJava.js
import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas configurables desde .env
const JAR_PATH = process.env.VERIFACTU_JAR_PATH || path.resolve(__dirname, '../../firmador.jar');
const P12_PATH = process.env.VERIFACTU_P12_PATH || path.resolve(__dirname, '../../certificados/certificado.p12');
const P12_PASS = process.env.VERIFACTU_P12_PASS || '';

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (_) {}
}

/**
 * Firma un XML con el firmador.jar y devuelve el XML firmado
 */
export async function firmarFacturaConJava(xmlSinFirma, rutaCertP12 = P12_PATH, password = P12_PASS) {
  const carpetaTemp = path.resolve('./temp');
  await ensureDir(carpetaTemp);

  // Usar mismo timestamp para entrada y salida
  const stamp = Date.now();
  const archivoEntrada = path.join(carpetaTemp, `factura-${stamp}.xml`);
  const archivoSalida = path.join(carpetaTemp, `factura-${stamp}-firmada.xml`);

  // Guardar XML sin firma
  await fs.writeFile(archivoEntrada, xmlSinFirma, 'utf8');

  // Ejecutar el firmador
  await new Promise((resolve, reject) => {
    execFile(
      'java',
      ['-jar', JAR_PATH, archivoEntrada, archivoSalida, rutaCertP12, password],
      (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Error al firmar con Java:', stderr || error.message);
          return reject(error);
        }
        resolve();
      }
    );
  });

  // Leer XML firmado
  const xmlFirmado = await fs.readFile(archivoSalida, 'utf8');
  return xmlFirmado;
}

/**
 * Verificación de firma:
 * - Si tu JAR soporta "verify", puedes llamarlo aquí.
 * - Por defecto hacemos un check básico: ¿existe un nodo <Signature ...> con namespace xmldsig?
 */
export async function verificarFirmaConJava(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    return { ok: false, signed: false, error: 'XML vacío' };
  }

  // Fallback: check simple de firma XAdES Enveloped
  const hasSignature =
    /<\s*Signature(\s|>)/i.test(xmlString) &&
    /http:\/\/www\.w3\.org\/2000\/09\/xmldsig#/i.test(xmlString);

  return { ok: true, signed: !!hasSignature };
}
