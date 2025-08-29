// services/eventosService.js
import EventLog from '../models/EventLog.js';
import crypto from 'crypto';

/** ISO con TZ (YYYY-MM-DDThh:mm:ss+01:00) */
const nowISO = () => {
  const d = new Date();
  const tz = -d.getTimezoneOffset(); // minutos
  const sgn = tz >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, '0');
  const mm = String(Math.abs(tz) % 60).padStart(2, '0');
  return d.toISOString().replace('Z', `${sgn}${hh}:${mm}`);
};

export async function logEvento({ otNif, tipoEvento, payload = {} }) {
  // buscamos último evento para encadenar
  const prev = await EventLog.findOne({ otNif }).sort({ createdAt: -1 });
  const fechaHoraISO = nowISO();

  // huella básica (puedes ampliarla con el "documento de huella" cuando lo publiquen)
  const contenido = JSON.stringify({ otNif, tipoEvento, fechaHoraISO, payload, prevHuella: prev?.huella || '' });
  const huella = crypto.createHash('sha256').update(contenido, 'utf8').digest('hex');

  const ev = await EventLog.create({
    otNif,
    tipoEvento,
    fechaHoraISO,
    payload,
    huella,
    anterior: prev ? {
      tipoEvento: prev.tipoEvento,
      fechaHoraISO: prev.fechaHoraISO,
      huella: prev.huella,
    } : undefined,
  });

  return ev;
}

/** Genera resumen 6h (tipoEvento = '10') con contadores desde el último resumen */
export async function generarResumen6h(otNif) {
  const ultimoResumen = await EventLog.findOne({ otNif, tipoEvento: '10' }).sort({ createdAt: -1 });
  const filtro = { otNif };
  if (ultimoResumen) filtro.createdAt = { $gt: ultimoResumen.createdAt };

  const eventos = await EventLog.find(filtro);
  const porTipo = eventos.reduce((acc, e) => { acc[e.tipoEvento] = (acc[e.tipoEvento] || 0) + 1; return acc; }, {});
  return logEvento({ otNif, tipoEvento: '10', payload: { resumen: porTipo } });
}
