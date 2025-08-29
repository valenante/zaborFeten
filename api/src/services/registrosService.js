// services/registrosService.js
import crypto from 'crypto';
import dayjs from 'dayjs';
import { create } from 'xmlbuilder2';
import SifConfig from '../models/SifConfig.js';
import FacturaChain from '../models/FacturaChain.js';

// === util fechas
export const toISO8601TZ = (d = new Date()) => dayjs(d).format('YYYY-MM-DDTHH:mm:ssZ');
export const toDDMMYYYY = (d) => dayjs(d).format('DD-MM-YYYY');

// === HASH (art.13) — usamos los campos listados por la Orden HAC/1177/2024
// Para ALTA: NIF, Serie+Número, FechaExp, TipoFactura, CuotaTotal, ImporteTotal,
// Huella registro anterior, FechaHoraHusoGeneracion
function calcHashAlta({
  otNif, serie, numero, fechaExpedicion, tipoFactura,
  cuotaTotal, importeTotal, huellaAnterior64, fechaHoraGenISO
}) {
  const payload = [
    otNif, `${serie}${numero}`, fechaExpedicion, tipoFactura,
    Number(cuotaTotal).toFixed(2), Number(importeTotal).toFixed(2),
    (huellaAnterior64 || ''), fechaHoraGenISO
  ].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex'); // 64 chars
}

// Para ANULACIÓN: NIF, Serie+Número, FechaExp, HuellaAnterior, FechaHoraGen
function calcHashAnulacion({
  otNif, serie, numero, fechaExpedicion, huellaAnterior64, fechaHoraGenISO
}) {
  const payload = [
    otNif, `${serie}${numero}`, fechaExpedicion,
    (huellaAnterior64 || ''), fechaHoraGenISO
  ].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

// === obtener eslabón previo de la cadena (por OT + SIF)
async function getPrevChain({ otNif, sifId }) {
  const chain = await FacturaChain.findOne({ otNif, sifId });
  return chain?.ultimo || null;
}

// === actualizar eslabón
async function updateChain({ otNif, sifId, tipo, serie, numero, fechaExpedicion, huella64, fechaHoraGenISO }) {
  const upd = await FacturaChain.findOneAndUpdate(
    { otNif, sifId },
    {
      $set: { ultimo: { otNif, sifId, serie, numero, fechaExpedicion, huella64, fechaHoraGenISO } },
      $push: { history: { tipo, serie, numero, fechaExpedicion, huella64, fechaHoraGenISO } }
    },
    { upsert: true, new: true }
  );
  return upd;
}

// === construir bloque SistemaInformatico (Bloque 6)
function buildSistemaInformaticoBlock(sif) {
  const prod = sif.productor || {};
  return {
    NombreRazon: prod.nombreRazon || '',
    NIF: prod.nif || '',
    IDOtro: prod.nif ? undefined : {
      CodigoPais: sif?.productor?.idOtro?.codigoPais || '',
      IDType: sif?.productor?.idOtro?.idType || '',
      ID: sif?.productor?.idOtro?.id || ''
    },
    NombreSistemaInformatico: sif.nombreSistemaInformatico,
    IdSistemaInformatico: sif.idSistemaInformatico,
    Version: sif.version,
    NumeroInstalacion: sif.numeroInstalacion,
    TipoUsoPosibleSoloVerifactu: sif.tipoUsoPosibleSoloVerifactu, // S/N
    TipoUsoPosibleMultiOT: sif.tipoUsoPosibleMultiOT,             // S/N
    IndicadorMultiplesOT: sif.multiplesOTActivos ? 'S' : 'N'
  };
}

// === builder de RegistroAlta (Bloque 3) → XML UTF-8
export async function buildRegistroAltaXML({
  ot,                 // { nombreRazon, nif }
  factura,            // { serie, numero, fechaExpedicion, tipoFactura, descripcion, fechaOperacion? }
  totales,            // { base, cuotaTotal, importeTotal }
  desglose,           // array de líneas de impuesto con claves L8/L9/L10…
  opciones = {}       // { primerRegistro?:bool, numRegistroAcuerdo?, idAcuerdo? }
}) {
  const sif = await SifConfig.findOne();
  if (!sif) throw new Error('SIF no configurado');

  const prev = await getPrevChain({ otNif: ot.nif, sifId: sif.idSistemaInformatico });
  const fechaHoraGenISO = toISO8601TZ(new Date());
  const fechaExp = factura.fechaExpedicion || toDDMMYYYY(new Date());

  // Validación art.7.i (máx 1 minuto respecto ahora)
  if (prev?.fechaHoraGenISO) {
    const prevMs = new Date(prev.fechaHoraGenISO).getTime();
    const nowMs = new Date(fechaHoraGenISO).getTime();
    if (nowMs - prevMs > 60*1000) {
      // no bloqueamos, pero deberías alarmar (art.7.i + 6.f)
      // aquí podrías generar un registro de evento con tipo anómalo
    }
  }

  const huella = calcHashAlta({
    otNif: ot.nif,
    serie: factura.serie,
    numero: factura.numero,
    fechaExpedicion: fechaExp,
    tipoFactura: factura.tipoFactura, // L2
    cuotaTotal: totales.cuotaTotal,
    importeTotal: totales.importeTotal,
    huellaAnterior64: prev?.huella64 || '',
    fechaHoraGenISO
  });

  const doc = {
    RegistroAlta: {
      IDVersion: '1.0',
      IDFactura: {
        IDEmisorFactura: ot.nif,
        NumSerieFactura: `${factura.serie}${factura.numero}`,
        FechaExpedicionFactura: fechaExp,
        RefExterna: opciones.refExterna || undefined,
        NombreRazonEmisor: ot.nombreRazon,
        Subsanacion: opciones.subsanacion || 'N',
        RechazoPrevio: opciones.rechazoPrevio || 'N',
        TipoFactura: factura.tipoFactura, // L2
        FechaOperacion: factura.fechaOperacion || undefined,
        DescripcionOperacion: factura.descripcion || '',
        FacturaSimplificadaArt7273: opciones.fs7273 || 'N',
        FacturaSinIdentifDestinatarioArt61d: opciones.fs61d || 'N',
        Macrodato: opciones.macrodato || 'N',
        EmitidaPorTerceroODestinatario: opciones.emitidaPor || undefined,
        Destinatarios: opciones.destinatarios || undefined,
        Desglose: (desglose || []).map(d => ({
          DetalleDesglose: {
            Impuesto: d.impuesto || '01', // IVA
            ClaveRegimen: d.claveRegimen, // L8A/L8B
            CalificacionOperacion: d.calificacionOperacion, // L9
            OperacionExenta: d.operacionExenta, // L10
            TipoImpositivo: d.tipoImpositivo,
            BaseImponibleOimporteNoSujeto: d.base,
            BaseImponibleACoste: d.baseACoste || undefined,
            CuotaRepercutida: d.cuota,
            TipoRecargoEquivalencia: d.tipoRE || undefined,
            CuotaRecargoEquivalencia: d.cuotaRE || undefined,
            CuotaTotal: d.cuotaTotal,
            ImporteTotal: d.importeTotal
          }
        })),
        Encadenamiento: {
          PrimerRegistro: prev ? 'N' : 'S',
          RegistroAnterior: prev ? {
            IDEmisorFactura: prev.otNif,
            NumSerieFactura: `${prev.serie}${prev.numero}`,
            FechaExpedicionFactura: prev.fechaExpedicion,
            Huella: prev.huella64
          } : undefined
        },
        SistemaInformatico: buildSistemaInformaticoBlock(sif),
        FechaHoraHusoGenRegistro: fechaHoraGenISO,
        NumRegistroAcuerdoFacturacion: opciones.numRegistroAcuerdo || undefined,
        IdAcuerdoSistemaInformatico: opciones.idAcuerdo || undefined,
        TipoHuella: '01', // SHA-256
        Huella: huella,
        // Signature: (se añadirá al firmar XAdES)
      }
    }
  };

  const xml = create({ version: '1.0', encoding: 'UTF-8' }).ele(doc).end({ prettyPrint: true });

  // actualizar cadena
  await updateChain({
    otNif: ot.nif,
    sifId: sif.idSistemaInformatico,
    tipo: 'alta',
    serie: factura.serie,
    numero: factura.numero,
    fechaExpedicion: fechaExp,
    huella64: huella.slice(0, 64),
    fechaHoraGenISO
  });

  return { xml, huella, fechaHoraGenISO, prev };
}

// === builder de RegistroAnulacion (Bloque 4) → XML UTF-8
// services/registrosService.js  (continuación)

export async function buildRegistroAnulacionXML({
  ot,                 // { nombreRazon, nif }
  facturaAnulada,     // { serie, numero, fechaExpedicion }
  opciones = {}       // { refExterna?, sinRegistroPrevio? ('S'/'N'), generadoPor? }
}) {
  const sif = await SifConfig.findOne();
  if (!sif) throw new Error('SIF no configurado');

  const prev = await getPrevChain({ otNif: ot.nif, sifId: sif.idSistemaInformatico });
  const fechaHoraGenISO = toISO8601TZ(new Date());
  const fechaExp = facturaAnulada.fechaExpedicion; // dd-mm-yyyy (obligatorio en anulación)

  // Validación art.7.i (máx 1 minuto respecto ahora) — igual que en alta
  if (prev?.fechaHoraGenISO) {
    const prevMs = new Date(prev.fechaHoraGenISO).getTime();
    const nowMs = new Date(fechaHoraGenISO).getTime();
    if (nowMs - prevMs > 60 * 1000) {
      // aquí podrías disparar una alarma/registro de evento (art.6.f + 7.i)
    }
  }

  const huella = calcHashAnulacion({
    otNif: ot.nif,
    serie: facturaAnulada.serie,
    numero: facturaAnulada.numero,
    fechaExpedicion: fechaExp,
    huellaAnterior64: prev?.huella64 || '',
    fechaHoraGenISO
  });

  const sistema = buildSistemaInformaticoBlock(sif);

  const doc = {
    RegistroAnulacion: {
      IDVersion: '1.0',
      IDFactura: {
        IDEmisorFacturaAnulada: ot.nif,
        NumSerieFacturaAnulada: `${facturaAnulada.serie}${facturaAnulada.numero}`,
        FechaExpedicionFacturaAnulada: fechaExp,
        RefExterna: opciones.refExterna || undefined,
        SinRegistroPrevio: opciones.sinRegistroPrevio || 'N',
        RechazoPrevio: opciones.rechazoPrevio || 'N',
        GeneradoPor: opciones.generadoPor ? {
          NombreRazon: opciones.generadoPor.nombreRazon || '',
          NIF: opciones.generadoPor.nif || undefined,
          IDOtro: (!opciones.generadoPor.nif && opciones.generadoPor.idOtro) ? {
            CodigoPais: opciones.generadoPor.idOtro.codigoPais || '',
            IDType: opciones.generadoPor.idOtro.idType || '',
            ID: opciones.generadoPor.idOtro.id || ''
          } : undefined
        } : undefined,
        Encadenamiento: {
          PrimerRegistro: prev ? 'N' : 'S',
          RegistroAnterior: prev ? {
            IDEmisorFactura: prev.otNif,
            NumSerieFactura: `${prev.serie}${prev.numero}`,
            FechaExpedicionFactura: prev.fechaExpedicion,
            Huella: prev.huella64
          } : undefined
        },
        SistemaInformatico: sistema,
        FechaHoraHusoGenRegistro: fechaHoraGenISO,
        TipoHuella: '01', // SHA-256
        Huella: huella,
        // Signature: (pendiente de firma XAdES)
      }
    }
  };

  const xml = create({ version: '1.0', encoding: 'UTF-8' }).ele(doc).end({ prettyPrint: true });

  // Actualizar cadena (el último es ahora esta anulación)
  await updateChain({
    otNif: ot.nif,
    sifId: sif.idSistemaInformatico,
    tipo: 'anulacion',
    serie: facturaAnulada.serie,
    numero: facturaAnulada.numero,
    fechaExpedicion: fechaExp,
    huella64: huella.slice(0, 64),
    fechaHoraGenISO
  });

  return { xml, huella, fechaHoraGenISO, prev };
}

// === Stub de firma XAdES (para integrar más tarde)
export async function firmarXAdES(xmlString, { certificadoPEM, clavePrivadaPEM }) {
  // TODO: implementar firma ETSI EN 319 132 (XAdES Enveloped)
  // con "xmldsig" / "xml-crypto" y política de la AEAT cuando publiques el doc técnico.
  // Devuelve el mismo XML por ahora (sin firma) para no bloquear el flujo.
  return xmlString;
}
