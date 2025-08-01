import axios from 'axios';
import { Parser } from 'json2csv';
import FacturaHash from '../models/FacturaHash.js';
import EventoFactura from '../models/EventosFactura.js';
import { emitirFacturaBase } from '../../utils/emitirFactura.js';
import { generarNumeroFacturaRectificativa } from '../../utils/numeracionRectificativas.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado


export const listarFacturasEncadenadas = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const totalFacturas = await FacturaHash.countDocuments();
    const facturas = await FacturaHash.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ facturas, totalPaginas: Math.ceil(totalFacturas / limit) });
  } catch (error) {
    logger.error('❌ Error al obtener facturas:', error);
    res
      .status(500)
      .json({ error: 'Error al obtener las facturas encadenadas.' });
  }
};

export const exportarFacturasCSV = async (_req, res) => {
  try {
    const facturas = await FacturaHash.find().sort({ createdAt: 1 });
    if (!facturas.length) {
      return res.status(404).json({ error: 'No hay facturas registradas.' });
    }

    const fields = [
      'numeroFactura',
      'fechaExpedicion',
      'clienteNombre',
      'clienteNIF',
      'importeTotal',
      'hash',
      'hashAnterior',
    ];
    const csv = new Parser({ fields }).parse(facturas);

    res.header('Content-Type', 'text/csv');
    res.attachment('facturas.csv');
    res.send(csv);
  } catch (error) {
    logger.error('❌ Error al exportar facturas:', error);
    res.status(500).json({ error: 'Error al exportar facturas.' });
  }
};

export const rectificarFactura = async (req, res) => {
  const { id } = req.params;
  const { motivo, importeTotal, clienteNombre, clienteNIF } = req.body;

  try {
    const facturaOriginal = await FacturaHash.findById(id);
    if (!facturaOriginal)
      return res.status(404).json({ error: 'Factura original no encontrada.' });

    if (facturaOriginal.rectificada)
      return res.status(400).json({ error: 'La factura ya fue rectificada.' });

    // Generar nuevo número para la factura rectificativa
    const nuevoNumeroFactura = await generarNumeroFacturaRectificativa();

    const nuevaFactura = await emitirFacturaBase({
      numeroFactura: nuevoNumeroFactura,
      fechaExpedicion: new Date(), // Fecha actual
      clienteNombre,
      clienteNIF,
      productos: [], // o con detalles si lo deseas
      importeTotal,
      hashAnterior: facturaOriginal.hash,
      descripcionFactura: motivo || 'Rectificación de factura',
      tipoComunicacion: 'A0', // Alta
    });

    // Marcar la original como rectificada
    facturaOriginal.rectificada = true;
    facturaOriginal.facturaRectificativaId = nuevaFactura._id;
    await facturaOriginal.save();

    // Registrar evento (ajusta si tienes modelo EventoFactura)
    await new EventoFactura({
      tipoEvento: 'rectificación',
      numeroFactura: nuevoNumeroFactura,
      clienteNombre,
      clienteNIF,
      motivo,
      importeTotal,
      hashFactura: nuevaFactura.hash,
      facturaOriginalId: facturaOriginal._id,
      facturaRectificativaId: nuevaFactura._id,
    }).save();

    try {
      await axios.post('http://100.91.21.52:4000/imprimir-factura-rectificativa', {
        numeroFactura: nuevoNumeroFactura,
        fechaExpedicion: nuevaFactura.fechaExpedicion,
        clienteNombre,
        clienteNIF,
        importeTotal,
        motivo,
        hash: nuevaFactura.hash,
      });
    } catch (printError) {
      logger.warn('⚠️ No se pudo imprimir la factura rectificativa:', printError.message);
      // No interrumpir el flujo, sólo loguear
    }
    res.json({
      message: 'Factura rectificativa generada correctamente.',
      facturaOriginal,
      facturaRectificativa: nuevaFactura,
    });
  } catch (error) {
    logger.error('❌ Error al rectificar factura:', error);
    res.status(500).json({ error: 'Error al rectificar la factura.' });
  }
};