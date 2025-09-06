import axios from 'axios';
import Mesa from '../models/Mesa.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado

const IMPRESION_SERVER = process.env.IMPRESION_SERVER;

// Función genérica para enviar a impresión
const enviarAImpresion = async (endpoint, payload) => {
  return await axios.post(`${IMPRESION_SERVER}/${endpoint}`, payload);
};

// Imprimir platos
export const imprimirPlatos = async (req, res) => {
  try {
    const { mesaNumero, comensales, productos, total } = req.body;
    const response = await enviarAImpresion('imprimir', {
      mesaNumero,
      comensales,
      productos,
      total,
    });
    res
      .status(200)
      .json({ message: 'Platos enviados a la impresora', data: response.data });
  } catch (error) {
    logger.error('Error al imprimir platos:', error.message);
    res
      .status(500)
      .json({ error: 'Error al imprimir platos', details: error.message });
  }
};

// Imprimir bebidas
export const imprimirBebidas = async (req, res) => {
  try {
    const { mesaNumero, comensales, productos, total } = req.body;
    const response = await enviarAImpresion('imprimir-bebidas', {
      mesaNumero,
      comensales,
      productos,
      total,
    });
    res.status(200).json({
      message: 'Bebidas enviadas a la impresora',
      data: response.data,
    });
  } catch (error) {
    logger.error('Error al imprimir bebidas:', error.message);
    res
      .status(500)
      .json({ error: 'Error al imprimir bebidas', details: error.message });
  }
};


export const imprimirFactura = async (req, res) => {
  const { mesaId } = req.params;
  const {
    clienteNombre,
    clienteNIF,
    metodoPago,
    productos,
    hash,
    numeroFactura,
    camarero
  } = req.body;

  try {
    // Buscar mesa en BD
    const mesa = await Mesa.findById(mesaId).lean();
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    // Calcular total
    const total = productos.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

    // Datos para impresión
    const datosImpresion = {
      mesaNumero: mesa.numero,
      comensales: mesa.comensales || 0,
      productos,
      total,
      clienteNombre,
      clienteNIF,
      metodoPago,
      hash,
      numeroFactura,
      camarero
    };

    console.log('Datos para impresión de factura:', datosImpresion);

    try {
      // Intentar enviar a impresión
      const response = await enviarAImpresion('imprimir-factura', datosImpresion);
      // Opcional: puedes hacer algo con response si quieres
    } catch (error) {
      // Loguear el error pero NO detener el flujo
      logger.warn('Error al enviar factura a impresión, pero se continúa flujo:', error.message);
    }

    // Responder éxito aunque haya fallado impresión
    return res.json({
      message: 'Factura procesada correctamente (la impresión pudo fallar)',
      data: {
        mesaId,
        numeroFactura,
      },
    });
  } catch (error) {
    // Error crítico: responder con error 500
    logger.error('Error general al imprimir factura:', error.message);
    return res.status(500).json({ error: 'Error general al procesar factura' });
  }
};

// Imprimir cuenta
export const imprimirCuenta = async (req, res) => {
  const { mesaId } = req.params;

  try {
    const mesa = await Mesa.findById(mesaId)
      .populate({
        path: 'pedidos',
        match: { estado: { $in: ['pendiente', 'listo'] } },
      })
      .lean();

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    const productos = mesa.pedidos.flatMap((pedido) =>
      pedido.productos.map((p) => ({
        nombre: p.nombre || 'Producto sin nombre',
        cantidad: p.cantidad,
        precio: p.precioSeleccionado || 0,
        opcionesPersonalizables: p.opcionesPersonalizables || [],
        alergiasComensal: p.alergiasComensal || '',
        tipoPrecio: p.tipoPrecio || '',
      }))
    );

    const total = productos.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

    const response = await enviarAImpresion('imprimir-cuenta', {
      mesaNumero: mesa.numero,
      comensales: mesa.comensales || 0,
      productos,
      total,
    });

    res.json({
      message: 'Cuenta enviada a impresión correctamente',
      data: response.data,
    });
  } catch (error) {
    logger.error('Error al imprimir cuenta:', error.message);
    res.status(500).json({ error: 'Error al imprimir cuenta' });
  }
};

// 👇 Añade este helper junto a tus otras funciones
export const abrirCajon = async () => {
  const base = IMPRESION_SERVER || 'http://127.0.0.1:4000';
  try {
    const { data } = await axios.post(`${base}/abrir-cajon`);
    logger.info(`Abrir cajón OK: ${data}`);
    return true;
  } catch (err) {
    logger.warn(`No se pudo abrir el cajón: ${err?.message || err}`);
    return false; // no rompemos el flujo de cierre
  }
};
