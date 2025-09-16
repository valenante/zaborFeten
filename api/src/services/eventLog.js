import { create } from 'xmlbuilder2';
import crypto from 'crypto';
import { nowISOWithTZ } from './verifactuHashService.js';
import { getPrevEvent, saveNewEvent, getEventsBetween, countEventsSince } from './eventRepo.js';
import { SIF } from '../config/verifactuConfig.js';
import { signXadesEnveloped } from './xadesService.js';

/** Catálogo de tipos de evento (L2E) según AEAT */
export const EVENT_TYPES = {
  INICIO_NO_VERIFACTU: '01',
  FIN_NO_VERIFACTU: '02',
  ANOMALIA_FACTURAS: '03',
  ANOMALIA_EVENTOS: '04',
  RESTAURACION_BACKUP: '05',
  EXPORT_FACTURAS: '06',
  EXPORT_EVENTOS: '07',
  RESUMEN_6H: '10',
};

/** Calcula huella SHA-256 encadenada de un evento */
function huellaEvento({ productorId, sifId, version, instalacion, nif, tipoEvento, huellaAnterior, fechaHoraISO }) {
  const txt = [
    productorId, sifId, version, instalacion,
    nif, tipoEvento, huellaAnterior || '',
    fechaHoraISO,
  ].join('|');
  return crypto.createHash('sha256').update(txt, 'utf8').digest('hex');
}

/** Crear y persistir un RegistroEvento (Bloque 5) */
export async function buildRegistroEventoNode({
  ot,                // { nif, nombreRazon? }
  tipoEvento,        // usar EVENT_TYPES
  datos = {},        // payload opcional
}) {
  const prev = await getPrevEvent(ot.nif);
  const fechaHoraISO = nowISOWithTZ();

  const root = create().ele('RegistroEvento');
  root.ele('IDVersion').txt('1.0').up();

  const ev = root.ele('Evento');

  // SistemaInformatico
  const si = ev.ele('SistemaInformatico');
  si.ele('NombreRazon').txt(SIF.productor.nombreRazon).up();
  si.ele('NIF').txt(SIF.productor.nif).up();
  si.ele('NombreSistemaInformatico').txt(SIF.sistema.nombre).up();
  si.ele('IdSistemaInformatico').txt(SIF.sistema.id).up();
  si.ele('Version').txt(SIF.sistema.version).up();
  si.ele('NumeroInstalacion').txt(SIF.sistema.numeroInstalacion).up();
  si.up();

  // ObligadoEmision
  const ob = ev.ele('ObligadoEmision');
  ob.ele('NombreRazon').txt(ot.nombreRazon || '').up();
  ob.ele('NIF').txt(ot.nif).up();
  ob.up();

  ev.ele('FechaHoraHusoGenEvento').txt(fechaHoraISO).up();
  ev.ele('TipoEvento').txt(tipoEvento).up();

  // DatosPropiosEvento
  if (Object.keys(datos).length) {
    const d = ev.ele('DatosPropiosEvento');
    for (const [k, v] of Object.entries(datos)) {
      d.ele(k).txt(String(v)).up();
    }
    d.up();
  }

  // Encadenamiento
  const enc = root.ele('Encadenamiento');
  if (!prev) {
    enc.ele('PrimerEvento').txt('S').up();
  } else {
    const ea = enc.ele('EventoAnterior');
    ea.ele('TipoEvento').txt(prev.tipoEvento).up();
    ea.ele('FechaHoraHusoGenEvento').txt(prev.fechaHoraISO).up();
    ea.ele('HuellaEvento').txt((prev.huella || '').slice(0, 64)).up();
    ea.up();
  }

  // Huella
  const h = huellaEvento({
    productorId: SIF.sistema.id,
    sifId: SIF.sistema.id,
    version: SIF.sistema.version,
    instalacion: SIF.sistema.numeroInstalacion,
    nif: ot.nif,
    tipoEvento,
    huellaAnterior: prev?.huella || '',
    fechaHoraISO,
  });

  root.ele('TipoHuella').txt('01').up();
  root.ele('HuellaEvento').txt(h).up();

  // Persistimos en Mongo
  await saveNewEvent({
    otNif: ot.nif,
    tipoEvento,
    fechaHoraISO,
    huella: h,
    payload: datos,
  });

  return root;
}

/** Generar y persistir resumen 6h (tipoEvento = 10) */
export async function buildAndPersistResumen6h({ ot }) {
  const counts = await countEventsSince({ otNif: ot.nif });
  const datos = { ResumenEventos: '' };
  for (const [tipo, n] of Object.entries(counts)) {
    datos[`Tipo_${tipo}`] = tipo;
    datos[`Numero_${tipo}`] = n;
  }
  return buildRegistroEventoNode({ ot, tipoEvento: EVENT_TYPES.RESUMEN_6H, datos });
}

/** Exportar eventos en XML firmado (conservación/exportación) */
export async function exportEventosXML({ ot, fromISO, toISO }) {
  const eventos = await getEventsBetween({ otNif: ot.nif, fromISO, toISO });

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('ExportEventos');

  for (const ev of eventos) {
    const n = root.ele('RegistroEvento');
    n.ele('IDVersion').txt('1.0').up();
    const e = n.ele('Evento');
    const ob = e.ele('ObligadoEmision');
    ob.ele('NIF').txt(ot.nif).up();
    ob.up();
    e.ele('FechaHoraHusoGenEvento').txt(ev.fechaHoraISO).up();
    e.ele('TipoEvento').txt(ev.tipoEvento).up();

    // DatosPropiosEvento si lo hay
    if (ev.payload && Object.keys(ev.payload).length) {
      const d = e.ele('DatosPropiosEvento');
      for (const [k, v] of Object.entries(ev.payload)) {
        d.ele(k).txt(String(v)).up();
      }
      d.up();
    }

    // Encadenamiento
    const enc = n.ele('Encadenamiento');
    if (ev.anterior?.huella) {
      const ea = enc.ele('EventoAnterior');
      ea.ele('TipoEvento').txt(ev.anterior.tipoEvento || '').up();
      ea.ele('FechaHoraHusoGenEvento').txt(ev.anterior.fechaHoraISO || '').up();
      ea.ele('HuellaEvento').txt((ev.anterior.huella || '').slice(0, 64)).up();
      ea.up();
    } else {
      enc.ele('PrimerEvento').txt('S').up();
    }

    n.ele('TipoHuella').txt('01').up();
    n.ele('HuellaEvento').txt(ev.huella).up();
  }

  const xml = root.end({ prettyPrint: true });
  // Firmar con XAdES antes de devolver
  const firmado = await signXadesEnveloped(xml);
  return firmado;
}
