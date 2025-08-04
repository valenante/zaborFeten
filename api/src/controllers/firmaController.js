// controllers/firmaController.js

import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { execSync } from 'child_process';

const CERT_FOLDER = path.join(process.cwd(), 'certificados');


export const subirCertificado = (req, res) => {
  const archivo = req.file;
  const { password } = req.body;

  // Validaciones iniciales
  if (!archivo || !password) {
    return res.status(400).send('Faltan datos requeridos');
  }

  if (!archivo.originalname.endsWith('.p12')) {
    return res.status(400).send('El archivo debe tener extensión .p12');
  }

  // Asegurar carpeta de certificados
  if (!fs.existsSync(CERT_FOLDER)) {
    fs.mkdirSync(CERT_FOLDER, { recursive: true });
  }

  const nombreBase = path.parse(archivo.originalname).name;
  const rutaP12 = path.join(CERT_FOLDER, `${nombreBase}.p12`);
  const rutaPem = path.join(CERT_FOLDER, `${nombreBase}.pem`);
  const rutaKey = path.join(CERT_FOLDER, `${nombreBase}.key`);

  try {
    // Mover el archivo a la ubicación final
    fs.renameSync(archivo.path, rutaP12);

    // Ejecutar comandos de conversión
    execSync(`openssl pkcs12 -in "${rutaP12}" -clcerts -nokeys -out "${rutaPem}" -passin pass:${password}`);
    execSync(`openssl pkcs12 -in "${rutaP12}" -nocerts -nodes -out "${rutaKey}" -passin pass:${password}`);

    // ✅ Si todo sale bien, responder sin exponer detalles
    res.send('Certificado subido y convertido correctamente');

    // 🧹 OPCIONAL: eliminar archivos sensibles después de usarlos
    // fs.unlinkSync(rutaP12);
    // fs.unlinkSync(rutaKey);
    // fs.unlinkSync(rutaPem);

  } catch (error) {
    console.error('[Error OpenSSL]', error.message);

    // 🛑 No reveles detalles técnicos al cliente
    return res.status(500).send('Error al procesar el certificado. Verifica que la contraseña sea correcta y que el archivo sea válido.');
  }
};

export const descargarDeclaracionResponsable = (req, res) => {
  const filePath = path.join(process.cwd(), 'public/docs', 'declaracion-responsable.pdf');

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Archivo no encontrado');
  }

  res.setHeader('Content-Disposition', 'attachment; filename="declaracion-responsable.pdf"');
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(filePath);
};
