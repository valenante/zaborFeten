import FacturaHash from '../models/FacturaHash.js';
import { generarHashFactura } from '../../utils/hashFactura.js';
import { firmarHashFactura as firmarReal } from '../../utils/firmarFactura.js';
import { firmarFacturaMock as firmarMock } from '../../utils/firmarFacturaMock.js';
import logger from '../../utils/logger.js'; // si tienes un sistema de logs

const esProduccion = process.env.NODE_ENV === 'production';
const rutaCert = './certificados/mi_certificado.p12';
const certPassword = 'MIKHAILTAL1!';

/**
 * Firma el hash dependiendo del entorno.
 */
const firmar = async (hash) => {
  if (esProduccion) {
    return firmarReal(hash, rutaCert, certPassword);
  } else {
    return firmarMock(hash);
  }
};

/**
 * Registra una factura con hash y firma digital.
 */
export const registrarFacturaConHash = async (datosFactura) => {
  const {
    numeroFactura,
    fechaExpedicion,
    clienteNombre,
    clienteNIF,
    productos,
    importeTotal,
  } = datosFactura;

  try {
    // Verificar duplicado
    const existente = await FacturaHash.findOne({ numeroFactura });
    if (existente) {
      throw new Error(`Ya existe una factura con número ${numeroFactura}`);
    }

    // Obtener hash anterior
    const ultimaFactura = await FacturaHash.findOne().sort({ createdAt: -1 });
    const hashAnterior = ultimaFactura?.hash || 'INICIO';

    // Generar hash nuevo
    const datosParaHash = {
      numeroFactura,
      fechaExpedicion,
      clienteNombre,
      clienteNIF,
      importeTotal,
    };
    const nuevoHash = generarHashFactura(datosParaHash, hashAnterior);

    // Firmar el hash
    const firmaDigital = await firmar(nuevoHash);

    // Guardar factura
    const nuevaFactura = new FacturaHash({
      numeroFactura,
      fechaExpedicion,
      clienteNombre,
      clienteNIF,
      productos,
      importeTotal,
      hash: nuevoHash,
      hashAnterior,
      firmaDigital,
    });

    await nuevaFactura.save();
    return nuevaFactura;
  } catch (error) {
    logger.error('❌ Error al registrar factura con hash:', error);
    throw error;
  }
};
