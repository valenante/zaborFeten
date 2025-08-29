// services/remisionService.js
import { create } from 'xmlbuilder2';
import { nowISOWithTZ, huellaAlta, huellaAnulacion } from './verifactuHashService.js';
import { SIF } from '../config/verifactuConfig.js';

export async function getPrevRegistro(otNif) {
  return await RegistroVerifactu.findOne({ otNif }).sort({ createdAt: -1 }).lean();
}

/**
 * Guarda un nuevo registro Verifactu
 */
export async function saveNuevoRegistro(data) {
  const registro = new RegistroVerifactu(data);
  return await registro.save();
}

// Reutilizamos el bloque 6 como NODO
function buildSistemaInformaticoNode({ multiplesOT = 1 } = {}) {
  const si = create().ele('SistemaInformatico');
  si.ele('NombreRazon').txt(SIF.productor.nombreRazon).up();
  si.ele('NIF').txt(SIF.productor.nif).up();
  si.ele('NombreSistemaInformatico').txt(SIF.sistema.nombre).up();
  si.ele('IdSistemaInformatico').txt(SIF.sistema.id).up();
  si.ele('Version').txt(SIF.sistema.version).up();
  si.ele('NumeroInstalacion').txt(SIF.sistema.numeroInstalacion).up();
  si.ele('TipoUsoPosibleSoloVerifactu').txt(SIF.sistema.soloVerifactu).up(); // 'S'/'N'
  si.ele('TipoUsoPosibleMultiOT').txt(SIF.sistema.multiOT).up();             // 'S'/'N'
  si.ele('IndicadorMultiplesOT').txt(
    typeof SIF.sistema.indicadorMultiplesOT === 'function'
      ? SIF.sistema.indicadorMultiplesOT(multiplesOT)
      : (multiplesOT > 1 ? 'S' : 'N')
  ).up();
  return si;
}

// ──────────────────────────────────────────────────────────────
// Bloque 1: Cabecera (para VERI*FACTU o Requerimiento)
// ──────────────────────────────────────────────────────────────
export function buildCabeceraNode({
  ot,                     // { nombreRazon?, nif }
  modo = 'verifactu',     // 'verifactu' | 'requerimiento'
  fechaFinVeriFactu,      // dd-mm-yyyy (solo renuncia)
  incidencia = 'N',       // 'S' | 'N'
  refRequerimiento,       // obligatorio en requerimiento
  finRequerimiento = 'N', // 'S' | 'N' indica último envío
} = {}) {
  const cab = create().ele('Cabecera');

  // Identificación obligado (OT)
  const ob = cab.ele('ObligadoEmision');
  if (ot?.nombreRazon) ob.ele('NombreRazon').txt(ot.nombreRazon).up();
  ob.ele('NIF').txt(ot.nif).up();
  ob.up();

  if (modo === 'verifactu') {
    if (fechaFinVeriFactu) {
      cab.ele('RemisionVoluntaria').ele('FechaFinVeriFactu').txt(fechaFinVeriFactu).up().up();
    }
    cab.ele('Incidencia').txt(incidencia === 'S' ? 'S' : 'N').up();
  } else if (modo === 'requerimiento') {
    const rr = cab.ele('RemisionRequerimiento');
    rr.ele('RefRequerimiento').txt(refRequerimiento || '').up();
    rr.ele('FinRequerimiento').txt(finRequerimiento === 'S' ? 'S' : 'N').up();
    rr.up();
  }

  return cab;
}

// ──────────────────────────────────────────────────────────────
// Bloque 2: RegistroFactura (envuelve Bloque 3 ó 4)
//  - Genera el alta/anulación SIN Signature (no obligatoria en remisión)
//  - Encadena y persiste la cadena
// ──────────────────────────────────────────────────────────────
export async function buildRegistroFacturaNode({
  tipo,     // 'alta' | 'anulacion'
  ot,       // { nif, nombreRazon? }
  factura,  // { numSerie, fechaExpedicion, tipoFactura?, cuotaTotal?, importeTotal? }
}) {
  const nif = ot.nif;
  const prev = await getPrevRegistro(nif);
  const fechaHoraGenISO = nowISOWithTZ();

  const root = create().ele('RegistroFactura');

  if (tipo === 'alta') {
    const h = huellaAlta({
      nifEmisor: nif,
      numSerie: factura.numSerie,
      fechaExpedicion: factura.fechaExpedicion,
      tipoFactura: factura.tipoFactura,
      cuotaTotal: factura.cuotaTotal ?? 0,
      importeTotal: factura.importeTotal ?? 0,
      huellaAnterior: prev?.huella || '',
      fechaHoraGenISO,
    });

    const ra = root.ele('RegistroAlta');
    ra.ele('IDVersion').txt('1.0').up();
    const id = ra.ele('IDFactura');
    id.ele('IDEmisorFactura').txt(nif).up();
    id.ele('NumSerieFactura').txt(factura.numSerie).up();
    id.ele('FechaExpedicionFactura').txt(factura.fechaExpedicion).up();
    id.up();
    if (ot?.nombreRazon) ra.ele('NombreRazonEmisor').txt(ot.nombreRazon).up();
    ra.ele('Subsanacion').txt('N').up();
    ra.ele('RechazoPrevio').txt('N').up();
    ra.ele('TipoFactura').txt(factura.tipoFactura).up();

    const enc = ra.ele('Encadenamiento');
    if (!prev) enc.ele('PrimerRegistro').txt('S').up();
    else {
      const x = enc.ele('RegistroAnterior');
      x.ele('IDEmisorFactura').txt(prev.idEmisor).up();
      x.ele('NumSerieFactura').txt(prev.numSerie).up();
      x.ele('FechaExpedicionFactura').txt(prev.fechaExpedicion).up();
      x.ele('Huella').txt((prev.huella || '').slice(0, 64)).up();
      x.up();
    }
    enc.import(buildSistemaInformaticoNode().root());
    enc.ele('FechaHoraHusoGenRegistro').txt(fechaHoraGenISO).up();
    enc.ele('TipoHuella').txt('01').up();
    enc.ele('Huella').txt(h).up();
    enc.up();

    // Guardamos cadena
    await saveNuevoRegistro({
      otNif: nif, tipo: 'alta',
      idEmisor: nif,
      numSerie: factura.numSerie,
      fechaExpedicion: factura.fechaExpedicion,
      fechaHoraGenISO,
      huella: h,
    });

  } else if (tipo === 'anulacion') {
    const h = huellaAnulacion({
      nifEmisor: nif,
      numSerie: factura.numSerie,
      fechaExpedicion: factura.fechaExpedicion,
      huellaAnterior: prev?.huella || '',
      fechaHoraGenISO,
    });

    const ran = root.ele('RegistroAnulacion');
    ran.ele('IDVersion').txt('1.0').up();
    const id = ran.ele('IDFactura');
    id.ele('IDEmisorFacturaAnulada').txt(nif).up();
    id.ele('NumSerieFacturaAnulada').txt(factura.numSerie).up();
    id.ele('FechaExpedicionFacturaAnulada').txt(factura.fechaExpedicion).up();
    id.up();

    ran.ele('RefExterna').txt('').up();
    ran.ele('SinRegistroPrevio').txt('N').up();
    ran.ele('RechazoPrevio').txt('N').up();

    const enc = ran.ele('Encadenamiento');
    if (!prev) enc.ele('PrimerRegistro').txt('S').up();
    else {
      const x = enc.ele('RegistroAnterior');
      x.ele('IDEmisorFactura').txt(prev.idEmisor).up();
      x.ele('NumSerieFactura').txt(prev.numSerie).up();
      x.ele('FechaExpedicionFactura').txt(prev.fechaExpedicion).up();
      x.ele('Huella').txt((prev.huella || '').slice(0, 64)).up();
      x.up();
    }
    enc.import(buildSistemaInformaticoNode().root());
    enc.ele('FechaHoraHusoGenRegistro').txt(fechaHoraGenISO).up();
    enc.ele('TipoHuella').txt('01').up();
    enc.ele('Huella').txt(h).up();
    enc.up();

    await saveNuevoRegistro({
      otNif: nif, tipo: 'anulacion',
      idEmisor: nif,
      numSerie: factura.numSerie,
      fechaExpedicion: factura.fechaExpedicion,
      fechaHoraGenISO,
      huella: h,
    });
  } else {
    throw new Error('Tipo de registro no soportado');
  }

  return root; // nodo <RegistroFactura> con hijo Alta/Anulacion
}

// ──────────────────────────────────────────────────────────────
// Ensamblar fichero de remisión (Cabecera + 1..1000 RegistroFactura)
// ──────────────────────────────────────────────────────────────
export async function buildRemisionXML({ cabeceraNode, registroFacturaNodes }) {
  if (!cabeceraNode) throw new Error('Falta Cabecera');
  if (!registroFacturaNodes?.length) throw new Error('No hay registros a remitir');

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('Remision');
  root.import(cabeceraNode.root());

  // Hasta 1000 por fichero
  registroFacturaNodes.slice(0, 1000).forEach(n => {
    root.import(n.root());
  });

  return root.end({ prettyPrint: true });
}
