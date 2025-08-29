// src/services/verifactuHashService.js
import crypto from 'crypto';

/**
 * Devuelve fecha/hora ISO con zona horaria local incluida
 * Ejemplo: 2025-08-25T20:53:00+02:00
 */
export function nowISOWithTZ() {
  const date = new Date();
  const tzOffsetMin = date.getTimezoneOffset(); // en minutos
  const abs = Math.abs(tzOffsetMin);
  const sign = tzOffsetMin > 0 ? '-' : '+';
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const tz = `${sign}${hh}:${mm}`;
  return date.toISOString().replace('Z', tz);
}

/**
 * Calcula la huella SHA-256 para un Registro de Alta
 * Art. 13: NIF, Nº factura, fecha expedición, tipo, cuota, importe, huella anterior, fecha/hora gen.
 */
export function huellaAlta({
  nifEmisor,
  numSerie,
  fechaExpedicion,
  tipoFactura,
  cuotaTotal,
  importeTotal,
  huellaAnterior,
  fechaHoraGenISO,
}) {
  const datos = [
    nifEmisor,
    numSerie,
    fechaExpedicion,
    tipoFactura,
    cuotaTotal,
    importeTotal,
    huellaAnterior || '',
    fechaHoraGenISO,
  ].join('|');
  return crypto.createHash('sha256').update(datos).digest('hex');
}

/**
 * Calcula la huella SHA-256 para un Registro de Anulación
 * Art. 13: NIF, Nº factura, fecha expedición, huella anterior, fecha/hora gen.
 */
export function huellaAnulacion({
  nifEmisor,
  numSerie,
  fechaExpedicion,
  huellaAnterior,
  fechaHoraGenISO,
}) {
  const datos = [
    nifEmisor,
    numSerie,
    fechaExpedicion,
    huellaAnterior || '',
    fechaHoraGenISO,
  ].join('|');
  return crypto.createHash('sha256').update(datos).digest('hex');
}

/**
 * Calcula la huella SHA-256 para un Registro de Evento
 * Art. 13: productor, sistema, versión, nº instalación, NIF obligado, tipo evento, huella anterior, fecha/hora gen.
 */
export function huellaEvento({
  idProductor,
  idSistema,
  version,
  numInstalacion,
  nifObligado,
  tipoEvento,
  huellaAnterior,
  fechaHoraGenISO,
}) {
  const datos = [
    idProductor,
    idSistema,
    version,
    numInstalacion,
    nifObligado,
    tipoEvento,
    huellaAnterior || '',
    fechaHoraGenISO,
  ].join('|');
  return crypto.createHash('sha256').update(datos).digest('hex');
}
