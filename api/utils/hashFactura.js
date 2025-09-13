import crypto from "crypto";

export function generarHashFactura({
  numeroFactura,
  fechaExpedicion,
  tipoFactura = "F1",
  cuotaTotal,
  importeTotal,
  idEmisor,
  huellaAnterior = "",
  fechaHoraRegistro
}) {
  // 👉 Fecha en formato DD-MM-YYYY
  const fecha = new Date(fechaExpedicion);
  const fechaExpedicionStr = fecha
    .toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-"); // "10-09-2025"

  // 👉 Normalizar valores numéricos a dos decimales
  const cuota = Number(cuotaTotal).toFixed(2);
  const importe = Number(importeTotal).toFixed(2);

  // 👉 Construir cadena AEAT
  const cadena =
    `IDEmisorFactura=${idEmisor}` +
    `&NumSerieFactura=${numeroFactura}` +
    `&FechaExpedicionFactura=${fechaExpedicionStr}` +
    `&TipoFactura=${tipoFactura}` +
    `&CuotaTotal=${cuota}` +
    `&ImporteTotal=${importe}` +
    `&Huella=${huellaAnterior || ""}` +
    `&FechaHoraHusoGenRegistro=${fechaHoraRegistro}`;

  console.log("📌 Cadena a hashear:", cadena);

  return crypto.createHash("sha256").update(cadena, "utf8").digest("hex").toUpperCase();
}
