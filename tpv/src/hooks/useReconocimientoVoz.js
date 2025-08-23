// src/hooks/useReconocimientoVoz.js
import { useCallback, useEffect, useRef, useState } from "react";

/** Normaliza a minúsculas y elimina tildes (útil para regex robustos) */
export const _norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Convierte números en palabras (es-ES) a entero (1–99): "dos"→2, "veintidos"→22, "treinta y cinco"→35 */
export const spanishNumberToInt = (raw) => {
  if (!raw) return NaN;
  const s = _norm(raw).replace(/-/g, " "); // "veinti-dos" → "veinti dos"

  const units = {
    cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9
  };
  const teens = {
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19
  };
  const twenties = {
    veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
    veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29
  };
  const tens = {
    treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
    setenta: 70, ochenta: 80, noventa: 90
  };

  if (s in units) return units[s];
  if (s in teens) return teens[s];
  if (s in twenties) return twenties[s];
  if (s in tens) return tens[s];

  // "treinta y cinco"
  const m = s.match(/^(\w+)\s+y\s+(\w+)$/);
  if (m && m[1] in tens && m[2] in units) return tens[m[1]] + units[m[2]];

  // "veinti dos"
  const v = s.match(/^veinti\s+(\w+)$/);
  if (v && v[1] in units) return 20 + units[v[1]];

  return NaN;
};

/** Extrae el número de mesa tanto en cifras como en palabras (1–99) */
export const extraerNumeroMesa = (texto) => {
  const t = _norm(texto);

  // 1) cifras: "mesa 12"
  const md = t.match(/mesa\s+(\d{1,4})\b/);
  if (md) return parseInt(md[1], 10);

  // 2) palabras: "mesa dos", "mesa veintidos", "mesa treinta y cinco"
  const mw = t.match(/mesa\s+([a-z\u00f1]+(?:\s+y\s+[a-z\u00f1]+)?)/i);
  if (mw) {
    const n = spanishNumberToInt(mw[1]);
    if (!Number.isNaN(n)) return n;
  }
  return null;
};

const HOTWORD_RE = /^(?:oye\s+)?cocina\b/;
const HOT_WINDOW_MS = 6000;                // ventana post-hotword

export function useReconocimientoVoz({ idioma = "es-ES" } = {}) {
  const [soportado, setSoportado] = useState(false);
  const [activo, setActivo] = useState(false); // escuchando ahora mismo
  const recRef = useRef(null);
  const continuousRef = useRef(false);
  const hotUntilRef = useRef(0);
  const lastFinalRef = useRef(""); // evitar repetir el mismo final varias veces
  const stoppedByUserRef = useRef(false);

  // Handlers externos
  const onResultHandlerRef = useRef(null);
  const onEndHandlerRef = useRef(null);
  const onErrorHandlerRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSoportado(false);
      return;
    }
    const rec = new SR();
    rec.lang = idioma;
    rec.interimResults = true;   // baja latencia
    rec.maxAlternatives = 1;
    rec.continuous = true;       // clave para sesiones largas
    recRef.current = rec;
    setSoportado(true);
  }, [idioma]);

  // --- Core listeners
  useEffect(() => {
    const rec = recRef.current;
    if (!rec) return;

    rec.onresult = (e) => {
      // Tomamos la última alternativa (la más completa)
      const res = e.results[e.results.length - 1];
      const transcript = _norm(res[0]?.transcript || "");
      const isFinal = res.isFinal;

      // Anti-ruido básico
      if (!transcript || transcript.length < 3) return;

      // Gestionamos hotword / ventana caliente SOLO cuando sea final
      if (isFinal) {
        // Evitar repetir exactamente el mismo texto final
        if (transcript === lastFinalRef.current) return;
        lastFinalRef.current = transcript;

        const now = Date.now();
        const startsWithHot = HOTWORD_RE.test(transcript);

        if (startsWithHot) {
          // abre ventana “caliente” (comandos sin hotword durante X segundos)
          hotUntilRef.current = now + HOT_WINDOW_MS;
        }

        const inHotWindow = now <= hotUntilRef.current;

        // Si empieza por hotword, quitamos el prefijo para dejar el comando limpio
        const clean = startsWithHot ? transcript.replace(HOTWORD_RE, "").trim() : transcript;

        // Solo pasamos el resultado si (a) trae hotword o (b) estamos dentro de la ventana
        if (startsWithHot || inHotWindow) {
          onResultHandlerRef.current?.({
            text: clean || transcript, // comando “limpio”
            raw: transcript,           // lo que reconoció
            hadHotword: startsWithHot, // si activó por hotword
            inHotWindow,               // si estaba en ventana activa
          });
        }
      }
    };

    rec.onend = () => {
      setActivo(false);
      onEndHandlerRef.current?.();

      // Si estamos en modo continuo y NO hemos sido detenidos manualmente, re-arranca
      if (continuousRef.current && !stoppedByUserRef.current) {
        // micro descanso para evitar “NotAllowedError: already started”
        setTimeout(() => {
          try {
            rec.start();
            setActivo(true);
          } catch (_) { }
        }, 120);
      }
    };

    rec.onerror = (e) => {
      // Si el usuario no permitió micro (denied), no insistir
      if (e?.error === "not-allowed") {
        continuousRef.current = false;
        stoppedByUserRef.current = true;
      }
      onErrorHandlerRef.current?.(e);
      setActivo(false);
    };
  }, []);

  // --- API pública
  const onResultado = useCallback((handler) => {
    onResultHandlerRef.current = handler;
  }, []);
  const onFin = useCallback((handler) => {
    onEndHandlerRef.current = handler;
  }, []);
  const onError = useCallback((handler) => {
    onErrorHandlerRef.current = handler;
  }, []);

  const escuchar = useCallback(() => {
    // MODO “pulsar para hablar” (sigue disponible por si quieres usarlo)
    const rec = recRef.current;
    if (!rec) return false;
    try {
      rec.start();
      setActivo(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const iniciarContinua = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return false;
    try {
      stoppedByUserRef.current = false;
      continuousRef.current = true;
      rec.start();
      setActivo(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const detenerContinua = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    stoppedByUserRef.current = true;
    continuousRef.current = false;
    try {
      rec.stop();
    } catch { }
  }, []);

  return {
    soportado,
    activo,
    escuchar,          // modo manual (lo mantengo)
    iniciarContinua,   // 🔥 nuevo: auto-restart
    detenerContinua,   // 🔥 nuevo: parar
    onResultado,
    onFin,
    onError,
  };
}