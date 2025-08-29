// controllers/remisionController.js
import {
  buildCabeceraNode,
  buildRegistroFacturaNode,
  buildRemisionXML,
} from '../services/remisionService.js';

// POST /api/v1/verifactu/remision
// Body:
// {
//   modo: "verifactu" | "requerimiento",
//   ot: { nif, nombreRazon? },
//   fechaFinVeriFactu?: "dd-mm-yyyy",
//   incidencia?: "S"|"N",
//   refRequerimiento?: "XXXXXXXXXXXXXXX",
//   finRequerimiento?: "S"|"N",
//   registros: [
//     { tipo: "alta", factura: { numSerie, fechaExpedicion, tipoFactura, cuotaTotal, importeTotal } },
//     { tipo: "anulacion", factura: { numSerie, fechaExpedicion } }
//   ]
// }
export const remitirRegistros = async (req, res) => {
  try {
    const {
      modo = 'verifactu',
      ot,
      fechaFinVeriFactu,
      incidencia = 'N',
      refRequerimiento,
      finRequerimiento = 'N',
      registros = [],
    } = req.body;

    if (!ot?.nif) return res.status(400).json({ error: 'Falta NIF del obligado' });
    if (!Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: 'Debe enviar al menos un registro' });
    }
    if (modo === 'requerimiento' && !refRequerimiento) {
      return res.status(400).json({ error: 'Falta RefRequerimiento en modo requerimiento' });
    }

    const cab = buildCabeceraNode({
      ot, modo, fechaFinVeriFactu, incidencia, refRequerimiento, finRequerimiento,
    });

    const nodos = [];
    for (const r of registros) {
      nodos.push(await buildRegistroFacturaNode({
        tipo: r.tipo, ot, factura: r.factura
      }));
    }

    const xml = await buildRemisionXML({ cabeceraNode: cab, registroFacturaNodes: nodos });

    // Aquí podrías llamar a tu cliente HTTP para **enviar** el XML a la AEAT
    // y devolver la respuesta de aceptación/rechazo si ya tienes endpoint.
    // Por ahora devolvemos el fichero generado.
    res.type('application/xml').status(200).send(xml);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
