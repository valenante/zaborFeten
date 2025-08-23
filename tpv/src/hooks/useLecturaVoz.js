// src/hooks/useLecturaVoz.js
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook de lectura por voz con cola, antirepetición y encabezados opcionales.
 *
 * @param {number} maxLecturasPorClave  Máximo de repeticiones por clave (ej: 2)
 * @param {number} cooldownMs           Cooldown mínimo por clave (ej: 10000 ms)
 */
export function useLecturaVoz(maxLecturasPorClave = 2, cooldownMs = 10000) {
  const [habilitado, setHabilitado] = useState(false);
  const [hablando, setHablando] = useState(false);
  const [cola, setCola] = useState([]); // [{ text, key }]
  const procesandoRef = useRef(false);
  const vozRef = useRef(null);

  // key -> count (veces leídas en esta sesión)
  const lecturasRef = useRef(new Map());
  // key -> timestamp (última vez encolada/reproducida)
  const lastTsRef = useRef(new Map());

  // Cargar voces ES (elige Google/Microsoft si existen)
  useEffect(() => {
    const cargar = () => {
      const voces = window.speechSynthesis.getVoices() || [];
      vozRef.current =
        voces.find(v => v.lang?.startsWith("es") && /Google|Microsoft/i.test(v.name)) ||
        voces.find(v => v.lang?.startsWith("es")) || null;
    };
    cargar();
    window.speechSynthesis.onvoiceschanged = cargar;
  }, []);

  const activar = useCallback(() => {
    setHabilitado(true);
    try {
      const u = new SpeechSynthesisUtterance("Lectura activada");
      u.lang = "es-ES";
      window.speechSynthesis.speak(u);
    } catch { /* no-op */ }
  }, []);

  const normalizarEspacios = (s) => (s || "").replace(/\s+/g, " ").trim();

  /**
   * Construye el texto final a leer según el payload.
   * payload puede traer:
   *  - tipoLectura: 'comanda' | 'voz' (default 'voz')
   *  - area: 'cocina' | 'barra' | ...
   *  - mesa: number | string
   *  - itemsTexto: string[] (frases ya construidas)
   *  - items: { nombre, cantidad }[]
   *  - alergias: string[]
   *  - notas: string
   */
  const construirTexto = useCallback((c) => {
    const tipoLectura = c?.tipoLectura || "voz";

    // 1) Encabezado SOLO si es comanda real
    const encabezado =
      tipoLectura === "comanda"
        ? (c.area === "barra" ? "Nueva comanda en barra." : "Nueva comanda en cocina.")
        : "";

    // 2) Mesa (si viene)
    const lineaMesa = c?.mesa ? `Mesa ${c.mesa}.` : "";

    // 3) Items / frases
    let frases = [];
    if (Array.isArray(c?.itemsTexto) && c.itemsTexto.length) {
      frases = c.itemsTexto.map(t => `${t}`.trim()).filter(Boolean);
    } else if (Array.isArray(c?.items) && c.items.length) {
      frases = c.items.map(it => {
        const cant = Number(it.cantidad) === 1 ? "un" : String(it.cantidad ?? "");
        const nombre = it.nombre || "Producto";
        return normalizarEspacios(`${cant} ${nombre}`);
      });
    }
    const lineaItems = frases.length ? `${frases.join(". ")}.` : "";

    // 4) Alergias / notas
    const lineaAlergias =
      Array.isArray(c?.alergias) && c.alergias.length
        ? `Atención alergias: ${c.alergias.join(", ")}.`
        : "";

    const lineaNotas = c?.notas ? `Nota: ${c.notas}.` : "";

    // 5) Ensamblado y limpieza
    const texto = normalizarEspacios(
      [encabezado, lineaMesa, lineaItems, lineaAlergias, lineaNotas].filter(Boolean).join(" ")
    );

    return texto;
  }, []);

  // Clave para antirepetición (si el backend envía lecturaKey lo priorizamos)
  const keyFromPayload = useCallback((c) => {
    if (c?.lecturaKey) return c.lecturaKey;
    const area = c?.area ?? "";
    const mesa = c?.mesa ?? "";
    const itemsKey = Array.isArray(c?.items)
      ? c.items.map(i => `${i?.nombre || "?"}x${i?.cantidad ?? "?"}`).join("|")
      : Array.isArray(c?.itemsTexto)
        ? c.itemsTexto.join("|")
        : "";
    const tipo = c?.tipoLectura || "voz";
    return `${tipo}:${area}:${mesa}:${itemsKey}`;
  }, []);

  /**
   * Encola una lectura. Respetará cooldown y máximo por clave.
   * @param {object} payload  Ver construirTexto()
   */
  const encolarLectura = useCallback((payload) => {
    if (!habilitado) return;

    const key = keyFromPayload(payload);
    const now = Date.now();

    // Cooldown para eventos repetidos muy seguidos
    const last = lastTsRef.current.get(key) || 0;
    if (now - last < cooldownMs) return;
    lastTsRef.current.set(key, now);

    // Límite de lecturas por clave
    const count = lecturasRef.current.get(key) || 0;
    if (count >= maxLecturasPorClave) return;

    const texto = construirTexto(payload);
    if (!texto) return;

    // Encola tantas veces como falten hasta el máx. (p.ej., 2 - count), con tope 2
    const restantes = Math.min(maxLecturasPorClave - count, 2);
    setCola(prev => [
      ...prev,
      ...Array.from({ length: restantes }, () => ({ text: texto, key }))
    ]);
  }, [habilitado, keyFromPayload, construirTexto, maxLecturasPorClave, cooldownMs]);

  // Procesa la cola, 1 elemento a la vez
  useEffect(() => {
    if (!habilitado || procesandoRef.current || cola.length === 0) return;

    procesandoRef.current = true;
    const { text, key } = cola[0];

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    if (vozRef.current) u.voice = vozRef.current;
    u.rate = 1;

    u.onstart = () => {
      setHablando(true);
    };

    u.onend = () => {
      setHablando(false);

      // Incrementa contador de lecturas por clave
      const curr = lecturasRef.current.get(key) || 0;
      lecturasRef.current.set(key, curr + 1);

      // Saca el primero de la cola y libera el lock
      setCola(prev => prev.slice(1));
      procesandoRef.current = false;
    };

    u.onerror = () => {
      setHablando(false);
      // Saca el primero de la cola y libera el lock
      setCola(prev => prev.slice(1));
      procesandoRef.current = false;
    };

    // Limpia cualquier lectura anterior y habla
    try { window.speechSynthesis.cancel(); } catch {}
    window.speechSynthesis.speak(u);
  }, [habilitado, cola]);

  const silenciar = useCallback(() => {
    setHabilitado(false);
    setHablando(false);
    try { window.speechSynthesis.cancel(); } catch {}
    setCola([]);
  }, []);

  return {
    habilitado,
    hablando,      // <- útil para pausar micro cuando TTS está activo
    activar,
    encolarLectura,
    silenciar,
  };
}
