import crypto from 'crypto';

export function generarHashFactura(factura, hashAnterior = '') {
  const fechaFormateada = new Date(factura.fechaExpedicion).toISOString().slice(0, 10); // YYYY-MM-DD

  const datos = [
    factura.numeroFactura,
    fechaFormateada,
    factura.clienteNombre,
    factura.clienteNIF,
    Number(factura.importeTotal).toFixed(2),
    hashAnterior || ''
  ].join(''); // sin separador

  const hash = crypto.createHash('sha256').update(datos).digest('base64');
  return hash;
}
