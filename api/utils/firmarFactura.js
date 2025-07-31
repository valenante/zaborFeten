import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';

export const firmarFacturaConJava = async (xmlSinFirma, rutaCertP12, password) => {
  const carpetaTemp = path.resolve('./temp');
  const archivoEntrada = path.join(carpetaTemp, 'factura.xml');
  const archivoSalida = path.join(carpetaTemp, 'factura-firmada.xml');

  // Asegurarse que carpeta temp exista
  try {
    await fs.mkdir(carpetaTemp);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }

  // Guardar XML sin firma en archivo temporal
  await fs.writeFile(archivoEntrada, xmlSinFirma, 'utf8');

  const rutaJar = path.resolve('./firmador.jar');
  const rutaCertAbs = path.resolve(rutaCertP12); // en caso que no sea absoluta

  console.log('Ejecutando java con estos argumentos:');
  console.log(rutaJar);
  console.log(archivoEntrada);
  console.log(archivoSalida);
  console.log(rutaCertAbs);
  console.log(password);

  // Ejecutar el firmador Java con rutas absolutas
  await new Promise((resolve, reject) => {
    execFile('java', [
      '-jar',
      rutaJar,
      archivoEntrada,
      archivoSalida,
      rutaCertAbs,
      password
    ], (error, stdout, stderr) => {
      if (error) {
        console.error('Error al firmar con Java:', stderr);
        return reject(error);
      }
      console.log('Firmador Java output:', stdout);
      resolve();
    });
  });

  // Leer el XML firmado y devolverlo
  const xmlFirmado = await fs.readFile(archivoSalida, 'utf8');
  return xmlFirmado;
};
