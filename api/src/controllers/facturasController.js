import axios from 'axios';
import crypto from 'crypto';
import { Parser } from 'json2csv';
import RegistroVerifactu from '../models/RegistroVerifactu.js';
import EventoFactura from '../models/EventosFactura.js';
import { emitirRegistroVerifactu } from '../../utils/emitirFactura.js';
import { generarNumeroFacturaRectificativa } from '../../utils/numeracionRectificativas.js';
import { generarProductoRectificativo } from '../../utils/generarProductoRectificativo.js';
import { generarVerifactuXML } from '../../utils/generarVerifactuXML.js';
import { enviarFacturaAEAT } from '../../utils/enviarAEAT.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado

function formatFechaDDMMYYYY(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export const listarFacturasEncadenadas = async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = 20;
    const skip = (page - 1) * limit;

    const pipeline = [
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'eventofacturas',        // nombre **real** de la colección
          let: { num: '$numeroFactura' },
          pipeline: [
            { $match: { $expr: { $eq: ['$numeroFactura', '$$num'] } } },
            { $sort: { fecha: -1, _id: -1 } }, // último evento por fecha
            { $limit: 1 },
          ],
          as: 'ultimoEvento',
        },
      },
      { $unwind: { path: '$ultimoEvento', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          numeroFactura: 1,
          // si no existe 'fechaExpedicion' en el doc, usar createdAt
          fechaExpedicion: { $ifNull: ['$fechaExpedicion', '$createdAt'] },
          clienteNombre: '$ultimoEvento.clienteNombre',
          clienteNIF: '$ultimoEvento.clienteNIF',
          // si guardas importeTotal en el registro, úsalo de respaldo
          importeTotal: { $ifNull: ['$ultimoEvento.importeTotal', '$importeTotal'] },
          hash: '$hashFactura',          // en tu UI lo llamas f.hash
          hashAnterior: 1,               // si lo tienes guardado en RegistroVerifactu
          xmlFirmado: 1,
          estado: 1,
        },
      },
    ];

    const [facturas, totalFacturas] = await Promise.all([
      RegistroVerifactu.aggregate(pipeline),
      RegistroVerifactu.countDocuments(),
    ]);

    res.json({ facturas, totalPaginas: Math.ceil(totalFacturas / limit) });
  } catch (error) {
    logger.error('❌ Error al obtener facturas:', error);
    res.status(500).json({ error: 'Error al obtener las facturas encadenadas.' });
  }
};

export const exportarFacturasCSV = async (req, res) => {
  try {
    const facturas = await RegistroVerifactu.find().sort({ createdAt: 1 });
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

    // 👇 Registrar evento 06 (Exportación Facturas)
    await buildRegistroEventoNode({
      ot: { nif: 'X6063327K', nombreRazon: 'ANTENUCCI AGUILAR VALENTINO NAHUEL' },
      tipoEvento: EVENT_TYPES.EXPORT_FACTURAS,
      datos: { totalFacturas: facturas.length, formato: 'CSV' }
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('facturas.csv');
    res.send(csv);
  } catch (error) {
    logger.error('❌ Error al exportar facturas:', error);
    res.status(500).json({ error: 'Error al exportar facturas.' });
  }
};export const rectificarFactura = async (req, res) => {
  const { id } = req.params;
  const {
    motivo,
    importeTotal,
    clienteNombre,
    clienteNIF,
    productos = [],
    tipoFactura,       // R1, R2, R3, R4 o R5
    tipoRectificativa  // "S" o "I"
  } = req.body;

  try {
    // 1️⃣ Buscar la factura original
    const facturaOriginal = await RegistroVerifactu.findById(id);
    if (!facturaOriginal)
      return res.status(404).json({ error: "Factura original no encontrada." });

    if (facturaOriginal.rectificada)
      return res.status(400).json({ error: "La factura ya fue rectificada." });

    // 2️⃣ Generar número para la factura rectificativa
    const nuevoNumeroFactura = await generarNumeroFacturaRectificativa();

    // 3️⃣ Detectar consumidor final
    const esConsumidorFinal =
      !clienteNIF || clienteNIF.trim() === "" || clienteNIF === "-" || clienteNIF === "99999999R";

    // 4️⃣ Preparar productos para la rectificativa
    const productosRectificativos = productos.length
      ? productos
      : generarProductoRectificativo(
          importeTotal,
          10,
          motivo || "Rectificación de factura"
        );

    // 5️⃣ Emitir la nueva factura rectificativa
    const nuevaFactura = await emitirRegistroVerifactu({
      tipo: "alta",
      datos: {
        numeroFactura: nuevoNumeroFactura,
        fechaExpedicion: new Date(),
        clienteNombre: esConsumidorFinal ? "" : clienteNombre,
        clienteNIF: esConsumidorFinal ? "" : clienteNIF,
        facturaSinIdentificar: esConsumidorFinal, // 👈 NUEVO
        productos: productosRectificativos,
        importeTotal,
        descripcionOperacion: motivo || "Rectificación de factura",

        // Encadenamiento
        numFacturaAnterior: facturaOriginal.numeroFactura,
        fechaFacturaAnterior: facturaOriginal.fechaExpedicion
          ? formatFechaDDMMYYYY(facturaOriginal.fechaExpedicion)
          : undefined,
        huellaAnterior: facturaOriginal.huellaTCR,

        // Tipos de factura
        tipoFactura,
        tipoRectificativa:
          ["R1", "R2"].includes(tipoFactura)
            ? tipoRectificativa || "I"
            : ["R3", "R4"].includes(tipoFactura)
            ? "S"
            : undefined,
      },
    });

    // 6️⃣ Marcar la original como rectificada
    facturaOriginal.rectificada = true;
    facturaOriginal.facturaRectificativaId = nuevaFactura._id;
    await facturaOriginal.save();

    // 7️⃣ Registrar evento interno
    await new EventoFactura({
      tipoEvento: "rectificacion",
      numeroFactura: nuevoNumeroFactura,
      clienteNombre: esConsumidorFinal ? "Consumidor final" : clienteNombre,
      clienteNIF: esConsumidorFinal ? "—" : clienteNIF,
      motivo,
      importeTotal,
      hashFactura: nuevaFactura.hashFactura,
      facturaOriginalId: facturaOriginal._id,
      facturaRectificativaId: nuevaFactura._id,
      facturaSinIdentificar: esConsumidorFinal, // 👈 NUEVO
    }).save();

    // 8️⃣ Intentar imprimir
    try {
      await axios.post("http://100.91.21.52:4000/imprimir-factura-rectificativa", {
        numeroFactura: nuevoNumeroFactura,
        fechaExpedicion: nuevaFactura.fechaExpedicion,
        clienteNombre: esConsumidorFinal ? "Consumidor final" : clienteNombre,
        clienteNIF: esConsumidorFinal ? "—" : clienteNIF,
        importeTotal,
        motivo,
        hash: nuevaFactura.hashFactura,
        tipoFactura,
        tipoRectificativa,
      });
    } catch (printError) {
      logger.warn("⚠️ No se pudo imprimir la factura rectificativa:", printError.message);
    }

    res.json({
      message: "Factura rectificativa generada correctamente.",
      facturaOriginal,
      facturaRectificativa: nuevaFactura,
    });
  } catch (error) {
    logger.error("❌ Error al rectificar factura:", error);
    res.status(500).json({ error: "Error al rectificar la factura." });
  }
};

export const verificarFactura = async (req, res) => {
  const { hash } = req.params;

  const factura = await RegistroVerifactu.findOne({ hash }).lean();
  if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

  const fecha = new Date(factura.fechaExpedicion).toISOString().slice(0, 10);
  const datosOriginales = [
    factura.numeroFactura,
    fecha,
    factura.clienteNombre, // ✅ Agregado aquí
    factura.clienteNIF,
    Number(factura.importeTotal).toFixed(2),
    factura.hashAnterior || ''
  ].join('');

  const hashCalculado = crypto.createHash('sha256').update(datosOriginales).digest('base64');

  res.json({
    numeroFactura: factura.numeroFactura,
    fecha,
    cliente: factura.clienteNombre,
    clienteNIF: factura.clienteNIF,
    total: Number(factura.importeTotal).toFixed(2),
    hash: factura.hash,
    hashCalculado,
    hashAnterior: factura.hashAnterior,
    valido: hashCalculado === factura.hash
  });
};

export const anularFactura = async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Buscar la factura original
    const facturaOriginal = await RegistroVerifactu.findById(id);
    if (!facturaOriginal) {
      return res.status(404).json({ error: "Factura no encontrada." });
    }

    // 2) Emitir registro de anulación con la misma lógica central
    const anulacion = await emitirRegistroVerifactu({
      tipo: "anulacion",
      datos: {
        numeroFactura: facturaOriginal.numeroFactura,
        fechaExpedicion: facturaOriginal.fechaExpedicion,
        huellaAnterior: facturaOriginal.huellaTCR,
        huellaNueva: facturaOriginal.huellaTCR, // en anulaciones, huella = la misma
        anulacion: true,
      },
    });

    // 3) Marcar la original como anulada
    facturaOriginal.estado = "anulada";
    facturaOriginal.facturaAnulacionId = anulacion._id;
    await facturaOriginal.save();

    // 4) Respuesta al frontend
    res.json({
      message: "Factura anulada correctamente",
      numeroFactura: facturaOriginal.numeroFactura,
      estado: anulacion.estado,
    });
  } catch (error) {
    console.error("❌ Error al anular factura:", error);
    res.status(500).json({ error: "Error al anular la factura." });
  }
};
