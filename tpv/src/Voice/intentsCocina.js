// Voice/intentsCocina.js
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// === Conversión de palabras a números ===
const spanishNumberToInt = (raw) => {
  if (!raw) return NaN;
  const s = norm(raw).replace(/-/g, " ");
  const units = { cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
  const teens = { diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19 };
  const twenties = { veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29 };
  const tens = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };

  if (s in units) return units[s];
  if (s in teens) return teens[s];
  if (s in twenties) return twenties[s];
  if (s in tens) return tens[s];

  const m = s.match(/^(\w+)\s+y\s+(\w+)$/);
  if (m && m[1] in tens && m[2] in units) return tens[m[1]] + units[m[2]];

  const v = s.match(/^veinti\s+(\w+)$/);
  if (v && v[1] in units) return 20 + units[v[1]];
  return NaN;
};

export const extraerNumeroMesaAny = (texto) => {
  const t = norm(texto);

  // cifras
  const d = t.match(/\bmesa\s+(\d{1,4})\b/);
  if (d) return parseInt(d[1], 10);

  // palabras tipo "mesa cinco", "mesa treinta y dos"
  const w = t.match(/\bmesa\s+([a-zñ]+(?:\s+y\s+[a-zñ]+)?)\b/);
  if (w) {
    const n = spanishNumberToInt(w[1]);
    if (!Number.isNaN(n)) return n;
  }
  return null;
};
// === PARSER PRINCIPAL ===
export const parseCocinaCommand = (rawText) => {
  const text = norm(rawText);

  // --- INTENT: RESUMEN PENDIENTES ---
  if (/(resumen|pendientes|que\s+falta|que\s+hay\s+pendiente|dame\s+el\s+resumen)/.test(text)) {
    const result = { type: "RESUMEN_PENDIENTES" };
    return result;
  }

  // --- INTENT: CONSULTAR MESA ---
  if (/(que\s+(tiene|hay)\s+la?\s*mesa|mesa\s+\d+\s+(tiene|hay)|que\s+tiene\s+mesa)/.test(text)) {
    const mesa = extraerNumeroMesaAny(text);
    if (mesa != null) {
      const result = { type: "CONSULTAR_MESA", mesa };
      return result;
    }
  }

  // --- INTENT: MARCAR PRODUCTO LISTO ---
  // Acepta frases con "marca", "como listo", "el plato", "los...", etc.
  if (/\bmarc(a|ar)\b/.test(text) || /\bplato\b/.test(text) || /\btermin(a|ar)\b/.test(text)) {
    // ⚠️ Si contiene "pedido", NO se considera producto (se delega abajo)
    if (!/\bpedido\b/.test(text)) {
      const mesa = extraerNumeroMesaAny(text);

      // 1️⃣ Por índice ("plato 2")
      const idxMatch = text.match(/\bplato\s+(\d{1,2})\b/);
      const idx = idxMatch ? parseInt(idxMatch[1], 10) : null;

      // 2️⃣ Por nombre del plato (“pimientos del padrón”, “patatas bravas”)
      const nombreMatch = text.match(
        /(?:marca(?:r)?(?:\s+como\s+list[oa]?)?\s+(?:el|la|los|las)?\s*|plato\s+)([a-zñáéíóúü\s]{2,}?)(?=\s+(?:de\s+la\s+mesa|mesa|\b\d+\b|list[oa]?|$))/
      );

      let nombre = null;
      if (nombreMatch) {
        nombre = nombreMatch[1]
          .trim()
          .replace(/\b(de|como|la|el|las|los)\b/g, "")
          .trim();
      }

      if (mesa != null && (idx != null || nombre)) {
        const result = { type: "MARCAR_PRODUCTO_LISTO", mesa, idx, nombre };
        return result;
      }
    }
  }

  // --- INTENT: MARCAR PEDIDO LISTO ---
  // ⚙️ Solo se activa si se dice explícitamente la palabra “pedido”
  const mesa = extraerNumeroMesaAny(text);
  if (/\bpedido\b/.test(text) && mesa != null) {
    const result = { type: "MARCAR_PEDIDO_LISTO", mesa };
    return result;
  }

  // --- INTENT: NONE ---
  return { type: "NONE" };
};
