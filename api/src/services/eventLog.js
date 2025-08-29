// services/eventLog.js
import { create } from 'xmlbuilder2';
import { nowISOWithTZ } from './verifactuHashService.js';
import { getPrevEvent, saveNewEvent, getEventsBetween, countEventsSince } from './eventRepo.js'; // crea este repo con Mongo

// Hash de evento (art. 13.c) -> se define en sede; usamos SHA-256 igual que facturas
import crypto from 'crypto';
function huellaEvento(payload) {
  const txt = [
    payload.productorId, payload.sifId, payload.version, payload.instalacion,
    payload.nif, payload.tipoEvento, payload.huellaAnterior || '',
    payload.fechaHoraGenISO
  ].join('|');
  return crypto.createHash('sha256').update(txt, 'utf8').digest('hex');
}

// Bloque 5: RegistroEvento
export async function buildRegistroEventoNode({
  ot,                // { nif, nombreRazon? }
  tipoEvento,        // L2E (01..10,90)
  datos = {},        // campos específicos (exportaciones, anomalías, resúmenes...)
  productor = { nombreRazon: '', nif: SIF.productor.nif },
  sif = {
    nombre: SIF.sistema.nombre, id: SIF.sistema.id,
    version: SIF.sistema.version, instalacion: SIF.sistema.numeroInstalacion
  },
}) {
  const prev = await getPrevEvent(ot.nif);
  const fechaHoraGenISO = nowISOWithTZ();

  const root = create().ele('RegistroEvento');
  root.ele('IDVersion').txt('1.0').up();

  const ev = root.ele('Evento');
  // SistemaInformatico (reusamos bloque 6 resumido para evento)
  const si = ev.ele('SistemaInformatico');
  si.ele('NombreRazon').txt(productor.nombreRazon || SIF.productor.nombreRazon).up();
  si.ele('NIF').txt(productor.nif || SIF.productor.nif).up();
  si.ele('NombreSistemaInformatico').txt(sif.nombre).up();
  si.ele('IdSistemaInformatico').txt(sif.id).up();
  si.ele('Version').txt(sif.version).up();
  si.ele('NumeroInstalacion').txt(sif.instalacion).up();
  si.up();

  const ob = ev.ele('ObligadoEmision');
  ob.ele('NombreRazon').txt(ot.nombreRazon || '').up();
  ob.ele('NIF').txt(ot.nif).up();
  ob.up();

  ev.ele('FechaHoraHusoGenEvento').txt(fechaHoraGenISO).up();
  ev.ele('TipoEvento').txt(tipoEvento).up();

  // DatosPropiosEvento (solo los que tengas)
  if (datos && Object.keys(datos).length) {
    const d = ev.ele('DatosPropiosEvento');
    for (const [k, v] of Object.entries(datos)) d.ele(k).txt(String(v)).up();
    d.up();
  }

  // Encadenamiento
  const enc = root.ele('Encadenamiento');
  if (!prev) {
    enc.ele('PrimerEvento').txt('S').up();
  } else {
    const ea = enc.ele('EventoAnterior');
    ea.ele('TipoEvento').txt(prev.tipoEvento).up();
    ea.ele('FechaHoraHusoGenEvento').txt(prev.fechaHoraGenISO).up();
    ea.ele('HuellaEvento').txt((prev.huella || '').slice(0, 64)).up();
    ea.up();
  }

  const h = huellaEvento({
    productorId: sif.id,
    sifId: sif.id,
    version: sif.version,
    instalacion: sif.instalacion,
    nif: ot.nif,
    tipoEvento,
    huellaAnterior: prev?.huella || '',
    fechaHoraGenISO,
  });

  root.ele('TipoHuella').txt('01').up();
  root.ele('HuellaEvento').txt(h).up();

  // Persistimos la cadena
  await saveNewEvent({
    otNif: ot.nif,
    tipoEvento,
    fechaHoraGenISO,
    huella: h,
  });

  return root;
}

// Resumen de eventos (cada 6h)
export async function buildAndPersistResumen6h({ ot }) {
  // Cuenta eventos por tipo desde el último resumen o arranque
  const counts = await countEventsSince({ otNif: ot.nif });
  const datos = { ResumenEventos: '' }; // puedes añadir pares (TipoEvento, NumeroDeEventos) si quieres detalle
  for (const [tipo, n] of Object.entries(counts)) {
    datos[`Tipo_${tipo}`] = tipo;
    datos[`Numero_${tipo}`] = n;
  }
  return buildRegistroEventoNode({ ot, tipoEvento: '10', datos });
}

// Exportación por período -> devuelve XML con muchos <RegistroEvento>
export async function exportEventosXML({ ot, fromISO, toISO }) {
  const eventos = await getEventsBetween({ otNif: ot.nif, fromISO, toISO });
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('ExportEventos');
  for (const ev of eventos) {
    // ya almacenaste los XML? Si no, podrías re-hidratar nodos
    // Para simplificar, ponemos los mínimos:
    const n = root.ele('RegistroEvento');
    n.ele('IDVersion').txt('1.0').up();
    const e = n.ele('Evento');
    const ob = e.ele('ObligadoEmision'); ob.ele('NIF').txt(ot.nif).up(); ob.up();
    e.ele('FechaHoraHusoGenEvento').txt(ev.fechaHoraGenISO).up();
    e.ele('TipoEvento').txt(ev.tipoEvento).up();
    const enc = n.ele('Encadenamiento');
    if (ev.prevHuella) {
      const ea = enc.ele('EventoAnterior');
      ea.ele('TipoEvento').txt(ev.prevTipo || '').up();
      ea.ele('FechaHoraHusoGenEvento').txt(ev.prevFecha || '').up();
      ea.ele('HuellaEvento').txt((ev.prevHuella || '').slice(0,64)).up();
      ea.up();
    } else {
      enc.ele('PrimerEvento').txt('S').up();
    }
    n.ele('TipoHuella').txt('01').up();
    n.ele('HuellaEvento').txt(ev.huella).up();
  }
  return root.end({ prettyPrint: true });
}
