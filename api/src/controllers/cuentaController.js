import axios from 'axios';
import Mesa from '../models/Mesa.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado
import { io } from '../../index.js';

// Solicitar la cuenta
export const pedirCuenta = async (req, res) => {
  try {
    const { numeroMesa } = req.params;
    const mesa = await Mesa.findOne({ numero: numeroMesa });

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada.' });

    io.emit('cuentaSolicitada', { numeroMesa });
    res
      .status(200)
      .json({ message: `Cuenta solicitada para la mesa ${numeroMesa}` });
  } catch (error) {
    logger.error('❌ Error al solicitar la cuenta:', error);
    res.status(500).json({ error: 'Error al solicitar la cuenta.' });
  }
};

// Imprimir la cuenta
export const imprimirCuenta = async (req, res) => {
  try {
    const mesa = await Mesa.findById(req.params.id)
      .populate({
        path: 'pedidos',
        populate: { path: 'productos.producto' },
      })
      .populate({
        path: 'pedidosBebidas',
        populate: { path: 'productos.producto' },
      });

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada.' });

    const productos = [...mesa.pedidos, ...mesa.pedidosBebidas].flatMap(
      (pedido) =>
        pedido.productos.map((p) => ({
          nombre: p.producto?.nombre || 'Producto sin nombre',
          cantidad: p.cantidad,
          opcionesPersonalizables: p.opcionesPersonalizables || [],
          alergiasComensal: p.alergiasComensal || '',
          tipoPrecio: p.tipoPrecio || '',
          precio: p.precioSeleccionado || 0,
        }))
    );

    await axios.post(
      `${process.env.IMPRESION_SERVER}/imprimir-cuenta`,
      {
        mesaNumero: mesa.numero,
        comensales: mesa.comensales,
        productos,
        total: mesa.total,
      },
      {
        headers: {
          "x-tpv-apikey": process.env.PRINT_SECRET || "clave-secreta-demo",
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({ message: 'Cuenta enviada a impresión.' });
  } catch (error) {
    logger.error('❌ Error al imprimir la cuenta:', error);
    res.status(500).json({ error: 'Error al imprimir la cuenta.' });
  }
};
