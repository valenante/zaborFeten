import {buildVerifactuXML} from './plantillaVerifactu.js';

export async function generarVerifactuXML(datosFactura) {
  const {
    numeroFactura,
    fechaExpedicion,
    clienteNombre,
    clienteNIF,
    productos,
    importeTotal,
    hashFactura,
  } = datosFactura;

  return buildVerifactuXML({
    numeroFactura,
    fecha: new Date(fechaExpedicion).toISOString().slice(0, 10),
    nombreCliente: clienteNombre,
    nifCliente: clienteNIF,
    productos,
    total: importeTotal,
    huella: hashFactura,
  });
}

export default generarVerifactuXML;
