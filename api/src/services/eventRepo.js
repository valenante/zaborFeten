import EventLog from '../models/EventLog.js';

/**
 * Devuelve el último evento registrado para un NIF
 */
export async function getPrevEvent(otNif) {
  return EventLog.findOne({ otNif }).sort({ createdAt: -1 }).lean();
}

/**
 * Guarda un nuevo evento en la base de datos
 */
export async function saveNewEvent({ otNif, tipoEvento, fechaHoraISO, huella, payload }) {
  const prev = await getPrevEvent(otNif);

  return EventLog.create({
    otNif,
    tipoEvento,
    fechaHoraISO,
    huella,
    payload,
    anterior: prev
      ? {
          tipoEvento: prev.tipoEvento,
          fechaHoraISO: prev.fechaHoraISO,
          huella: prev.huella,
        }
      : undefined,
  });
}

/**
 * Devuelve todos los eventos en un rango de fechas
 */
export async function getEventsBetween({ otNif, fromISO, toISO }) {
  const filtro = { otNif };
  if (fromISO || toISO) filtro.createdAt = {};
  if (fromISO) filtro.createdAt.$gte = new Date(fromISO);
  if (toISO) filtro.createdAt.$lte = new Date(toISO);

  return EventLog.find(filtro).sort({ createdAt: 1 }).lean();
}

/**
 * Cuenta eventos agrupados por tipo desde el último resumen (tipoEvento = '10')
 */
export async function countEventsSince({ otNif }) {
  const ultimoResumen = await EventLog.findOne({
    otNif,
    tipoEvento: '10',
  }).sort({ createdAt: -1 }).lean();

  const filtro = { otNif };
  if (ultimoResumen) {
    filtro.createdAt = { $gte: ultimoResumen.createdAt };
  }

  const eventos = await EventLog.find(filtro).lean();
  return eventos.reduce((acc, ev) => {
    acc[ev.tipoEvento] = (acc[ev.tipoEvento] || 0) + 1;
    return acc;
  }, {});
}
