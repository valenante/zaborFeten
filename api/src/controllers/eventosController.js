import {
  buildRegistroEventoNode,
  buildAndPersistResumen6h,
  exportEventosXML,
  EVENT_TYPES,
} from '../services/eventLog.js';

/** POST /api/v1/verifactu/eventos/log  
 *  Registra un nuevo evento encadenado
 */
export const registrarEvento = async (req, res) => {
  try {
    const { otNif, nombreRazon, tipoEvento, payload } = req.body;
    if (!otNif || !tipoEvento) {
      return res.status(400).json({ error: 'otNif y tipoEvento son obligatorios' });
    }

    const nodo = await buildRegistroEventoNode({
      ot: { nif: otNif, nombreRazon },
      tipoEvento,
      datos: payload,
    });

    res.type('application/xml').send(nodo.end({ prettyPrint: true }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/** POST /api/v1/verifactu/eventos/resumen-6h  
 *  Genera y persiste un evento resumen periódico
 */
export const resumen6h = async (req, res) => {
  try {
    const { otNif, nombreRazon } = req.body;
    if (!otNif) return res.status(400).json({ error: 'otNif es obligatorio' });

    const nodo = await buildAndPersistResumen6h({
      ot: { nif: otNif, nombreRazon },
    });

    res.type('application/xml').send(nodo.end({ prettyPrint: true }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/** GET /api/v1/verifactu/eventos/export?otNif=...&desde=...&hasta=...  
 *  Exporta todos los eventos de un periodo como XML firmado
 */
export const exportarEventosXML = async (req, res) => {
  try {
    const { otNif, nombreRazon, desde, hasta } = req.query;
    if (!otNif) return res.status(400).json({ error: 'otNif es obligatorio' });

    const firmado = await exportEventosXML({
      ot: { nif: otNif, nombreRazon },
      fromISO: desde,
      toISO: hasta,
    });

    res.type('application/xml').send(firmado);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
