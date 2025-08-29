// controllers/eventosController.js
import { logEvento, generarResumen6h } from '../services/eventosService.js';
import { create } from 'xmlbuilder2';
import EventLog from '../models/EventLog.js';

/** POST /api/v1/verifactu/eventos/log  */
export const registrarEvento = async (req, res) => {
  try {
    const { otNif, tipoEvento, payload } = req.body;
    if (!otNif || !tipoEvento) return res.status(400).json({ error: 'otNif y tipoEvento son obligatorios' });
    const ev = await logEvento({ otNif, tipoEvento, payload });
    res.json({ ok: true, id: ev._id, huella: ev.huella });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/** POST /api/v1/verifactu/eventos/resumen-6h  */
export const resumen6h = async (req, res) => {
  try {
    const { otNif } = req.body;
    if (!otNif) return res.status(400).json({ error: 'otNif es obligatorio' });
    const ev = await generarResumen6h(otNif);
    res.json({ ok: true, id: ev._id, huella: ev.huella, payload: ev.payload });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/** GET /api/v1/verifactu/eventos/export?otNif=...&desde=...&hasta=...
 *  Devuelve XML del Bloque 5 (RegistroEvento) por periodo (para conservación/exportación).
 */
export const exportarEventosXML = async (req, res) => {
  try {
    const { otNif, desde, hasta } = req.query;
    if (!otNif) return res.status(400).json({ error: 'otNif es obligatorio' });

    const filtro = { otNif };
    if (desde || hasta) filtro.createdAt = {};
    if (desde) filtro.createdAt.$gte = new Date(desde);
    if (hasta) filtro.createdAt.$lte = new Date(hasta);

    const eventos = await EventLog.find(filtro).sort({ createdAt: 1 });

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('RegistroEventos');
    for (const ev of eventos) {
      const e = root.ele('RegistroEvento');
      e.ele('IDVersion').txt('1.0').up();
      const evt = e.ele('Evento');
      const oblig = evt.ele('ObligadoEmision');
      oblig.ele('NombreRazon').txt('OT').up(); // si tienes el nombre, rellénalo
      oblig.ele('NIF').txt(ev.otNif).up();
      evt.up(); // Evento

      e.ele('FechaHoraHusoGenEvento').txt(ev.fechaHoraISO).up();
      e.ele('TipoEvento').txt(ev.tipoEvento).up();

      // DatosPropiosEvento (payload serializado simple)
      e.ele('DatosPropiosEvento').txt(JSON.stringify(ev.payload)).up();

      // Encadenamiento
      const enc = e.ele('Encadenamiento');
      if (!ev.anterior?.huella) {
        enc.ele('PrimerEvento').txt('S').up();
      } else {
        const ea = enc.ele('EventoAnterior');
        ea.ele('TipoEvento').txt(ev.anterior.tipoEvento).up();
        ea.ele('FechaHoraHusoGenEvento').txt(ev.anterior.fechaHoraISO).up();
        ea.ele('HuellaEvento').txt(ev.anterior.huella.slice(0, 64)).up();
        ea.up();
      }
      enc.ele('TipoHuella').txt('01').up(); // SHA-256
      enc.ele('HuellaEvento').txt(ev.huella).up();

      // Signature (XAdES) → cuando enchufes firma, añádela aquí
      // e.ele('Signature').txt('...').up();

      e.up();
    }

    const xml = root.end({ prettyPrint: true });
    res.type('application/xml').send(xml);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
