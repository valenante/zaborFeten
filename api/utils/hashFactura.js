import crypto from "crypto";

const trim = (v) => (v == null ? "" : String(v).trim());

// Forzar siempre 2 decimales como en el XML
const to2 = (n) => {
  if (n == null || isNaN(n)) return "";
  return Number(n).toFixed(2);
};

/**
 * Genera la huella encadenada SHA-256 en HEX mayúsculas.
 * @param {Object} opts
 * @param {"alta"|"anulacion"|"evento"} opts.tipo
 * @param {string} opts.idEmisor - NIF del emisor
 * @param {string|number} opts.numeroFactura - Nº de factura
 * @param {string} opts.fechaExpedicion - EXACTA como va en el XML (ej: 2024-01-01)
 * @param {string} opts.tipoFactura - ej: "F1"
 * @param {number} opts.cuotaTotal
 * @param {number} opts.importeTotal
 * @param {string} opts.huellaAnterior
 * @param {string} opts.fechaHoraRegistro - EXACTA como en el XML con huso (ej: 2024-01-01T19:20:30+01:00)
 * @param {Object} [opts.evento] - datos de evento (solo si tipo="evento")
 *   - id, idSistemaInformatico, version, numeroInstalacion, tipoEvento
 */
export function generarHashFactura({
  tipo,
  idEmisor,
  numeroFactura,
  fechaExpedicion,
  tipoFactura,
  cuotaTotal,
  importeTotal,
  huellaAnterior,
  fechaHoraRegistro,
  evento = {},
}) {
  let cadena = "";

  if (tipo === "alta") {
    cadena =
      `IDEmisorFactura=${trim(idEmisor)}` +
      `&NumSerieFactura=${trim(numeroFactura)}` +
      `&FechaExpedicionFactura=${fechaExpedicion}` +
      `&TipoFactura=${trim(tipoFactura)}` +
      `&CuotaTotal=${to2(cuotaTotal)}` +
      `&ImporteTotal=${to2(importeTotal)}` +
      `&Huella=${trim(huellaAnterior)}` +
      `&FechaHoraHusoGenRegistro=${trim(fechaHoraRegistro)}`;
  }

  if (tipo === "anulacion") {
    cadena =
      `IDEmisorFacturaAnulada=${trim(idEmisor)}` +
      `&NumSerieFacturaAnulada=${trim(numeroFactura)}` +
      `&FechaExpedicionFacturaAnulada=${trim(fechaExpedicion)}` +
      `&Huella=${trim(huellaAnterior)}` +
      `&FechaHoraHusoGenRegistro=${trim(fechaHoraRegistro)}`;
  }

  if (tipo === "evento") {
    cadena =
      `NIF=${trim(idEmisor)}` +
      `&ID=${trim(evento.id || "")}` +
      `&IdSistemaInformatico=${trim(evento.idSistemaInformatico)}` +
      `&Version=${trim(evento.version)}` +
      `&NumeroInstalacion=${trim(evento.numeroInstalacion)}` +
      `&NIF=${trim(idEmisor)}` + // ObligadoEmision
      `&TipoEvento=${trim(evento.tipoEvento)}` +
      `&HuellaEvento=${trim(huellaAnterior)}` +
      `&FechaHoraHusoGenEvento=${trim(fechaHoraRegistro)}`;
  }

  return crypto
    .createHash("sha256")
    .update(cadena, "utf8")
    .digest("hex")
    .toUpperCase();
}
