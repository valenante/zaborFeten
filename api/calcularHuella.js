import fs from "fs";
import crypto from "crypto";
import { DOMParser } from "xmldom";

// Lee el XML
const xml = fs.readFileSync("./temp-out.xml", "utf-8");
const doc = new DOMParser().parseFromString(xml, "text/xml");

// Helper para sacar el valor de un nodo
const getValue = (tag) => {
  const els = Array.from(doc.getElementsByTagName("*"));
  const el = els.find((e) => e.tagName.endsWith(tag));
  return el && el.textContent ? el.textContent.trim() : "";
};

// Campos que pide la AEAT para Alta
const IDEmisorFactura = getValue("IDEmisorFactura");
const NumSerieFactura = getValue("NumSerieFactura");
const FechaExpedicionFactura = getValue("FechaExpedicionFactura");
const TipoFactura = getValue("TipoFactura");
const CuotaTotal = getValue("CuotaTotal");
const ImporteTotal = getValue("ImporteTotal");
const HuellaAnterior = getValue("Encadenamiento")
  ? getValue("Huella")
  : "";
const FechaHoraHusoGenRegistro = getValue("FechaHoraHusoGenRegistro");

// Construye la cadena EXACTA como AEAT
const cadena =
  `IDEmisorFactura=${IDEmisorFactura}` +
  `&NumSerieFactura=${NumSerieFactura}` +
  `&FechaExpedicionFactura=${FechaExpedicionFactura}` +
  `&TipoFactura=${TipoFactura}` +
  `&CuotaTotal=${CuotaTotal}` +
  `&ImporteTotal=${ImporteTotal}` +
  `&Huella=${HuellaAnterior}` +
  `&FechaHoraHusoGenRegistro=${FechaHoraHusoGenRegistro}`;

console.log("Cadena a hashear:");
console.log(cadena);

// Calcula SHA-256 en hex mayúsculas
const huella = crypto.createHash("sha256").update(cadena, "utf8").digest("hex").toUpperCase();

console.log("\nHuella calculada:");
console.log(huella);
