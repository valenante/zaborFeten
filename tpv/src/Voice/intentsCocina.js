// Voice/intentsCocina.js
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Extrae número 1–99 en cifras o palabras muy usadas
const spanishNumberToInt = (raw) => {
  if (!raw) return NaN;
  const s = norm(raw).replace(/-/g, " ");
  const units = { cero:0, uno:1, una:1, un:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9 };
  const teens = { diez:10, once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19 };
  const twenties = { veinte:20, veintiuno:21, veintidos:22, veintitres:23, veinticuatro:24, veinticinco:25, veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29 };
  const tens = { treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90 };

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

const extraerNumeroMesaAny = (texto) => {
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

export const parseCocinaCommand = (rawText) => {
  const text = norm(rawText);

  // --- INTENT: RESUMEN PENDIENTES
  // "resumen", "pendientes", "que falta", "que hay pendiente"
  if (/(resumen|pendientes|que\s+falta|que\s+hay\s+pendiente|dame\s+el\s+resumen)/.test(text)) {
    return { type: 'RESUMEN_PENDIENTES' };
  }

  // --- INTENT: CONSULTAR MESA
  // "que tiene la mesa 5", "que hay en la mesa 5", "que tiene mesa 5", "mesa 5 que tiene"
  if (/(que\s+(tiene|hay)\s+la?\s*mesa|mesa\s+\d+\s+(tiene|hay)|que\s+tiene\s+mesa)/.test(text)) {
    const mesa = extraerNumeroMesaAny(text);
    if (mesa != null) return { type: 'CONSULTAR_MESA', mesa };
  }

  // --- INTENT: MARCAR PEDIDO LISTO
  // "mesa 5 lista", "marcar pedido mesa 5", "terminar pedido mesa cinco", "cerrar mesa 7"
  if (/(marc(a|ar)|termin(a|ar)|finaliz(a|ar)|cierr(a|ar)).*(pedido|mesa)?|lista\b/.test(text)) {
    const mesa = extraerNumeroMesaAny(text);
    // Evitar confundir con producto (si dice "plato", lo tratamos en otro intent)
    if (mesa != null && !/\bplato\b/.test(text)) {
      return { type: 'MARCAR_PEDIDO_LISTO', mesa };
    }
  }

  // --- INTENT: MARCAR PRODUCTO LISTO
  // "marcar plato 2 de la mesa 3", "plato dos mesa 3 listo", "marcar la ensalada de la mesa 4"
  if (/\bplato\b/.test(text) || /\bmarcar\b.*\b(ensalada|hamburguesa|croquetas|pasta|pizza|tarta|cafe|café)\b/.test(text)) {
    const mesa = extraerNumeroMesaAny(text);
    // por índice "plato 2"
    const idxM = text.match(/\bplato\s+(\d{1,2})\b/);
    const idx = idxM ? parseInt(idxM[1], 10) : null;

    // por nombre aproximado (palabra clave después de "marcar" o "plato")
    let nombre = null;
    const byName = text.match(/(?:marcar|plato)\s+([a-zñ]+(?:\s+[a-zñ]+){0,3})/);
    if (byName) {
      const cand = byName[1].trim();
      if (!/^\d+$/.test(cand)) nombre = cand; // no es número puro
    }

    if (mesa != null && (idx != null || nombre)) {
      return { type: 'MARCAR_PRODUCTO_LISTO', mesa, idx, nombre };
    }
  }

  return { type: 'NONE' };
};
