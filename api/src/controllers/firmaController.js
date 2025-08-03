// controllers/firmaController.js

import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { execSync } from 'child_process';

const CERT_FOLDER = path.join(process.cwd(), 'certificados');

export const subirCertificado = (req, res) => {
  const archivo = req.file;
  const { password } = req.body;

  if (!archivo || !password) return res.status(400).send('Faltan datos');

  if (!fs.existsSync(CERT_FOLDER)) fs.mkdirSync(CERT_FOLDER);

  const nombreBase = path.parse(archivo.originalname).name;
  const rutaP12 = path.join(CERT_FOLDER, `${nombreBase}.p12`);
  const rutaPem = path.join(CERT_FOLDER, `${nombreBase}.pem`);
  const rutaKey = path.join(CERT_FOLDER, `${nombreBase}.key`);
  const rutaPass = path.join(CERT_FOLDER, `${nombreBase}.pass`);

  // Guardar .p12 y .pass
  fs.renameSync(archivo.path, rutaP12);
  fs.writeFileSync(rutaPass, password);

  try {
    // Extraer .pem (certificado público)
    execSync(`openssl pkcs12 -in "${rutaP12}" -clcerts -nokeys -out "${rutaPem}" -passin pass:${password}`);

    // Extraer .key (clave privada)
    execSync(`openssl pkcs12 -in "${rutaP12}" -nocerts -nodes -out "${rutaKey}" -passin pass:${password}`);
  } catch (error) {
    return res.status(500).send('Error al convertir el certificado: ' + error.message);
  }

  res.send('Certificado subido y convertido correctamente');
};

export const descargarDeclaracionResponsable = (req, res) => {
  // Ruta absoluta al archivo
  const filePath = path.join(process.cwd(), 'public/docs', 'declaracion-responsable.pdf');

  // Verificar si el archivo existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Archivo no encontrado');
  }

  // Configurar headers para descarga
  res.setHeader('Content-Disposition', 'attachment; filename=declaracion-responsable.pdf');
  res.setHeader('Content-Type', 'application/pdf');

  // Enviar archivo
  res.sendFile(filePath);
};