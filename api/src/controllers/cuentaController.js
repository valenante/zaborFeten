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
        path: "pedidos",
        populate: { path: "productos.producto" },
      })
      .populate({
        path: "pedidosBebidas",
        populate: { path: "productos.producto" },
      });

    if (!mesa) return res.status(404).json({ error: "Mesa no encontrada." });

    // ✅ Evita duplicar productos de bebidas
    const productosPlatos = mesa.pedidos.flatMap((pedido) =>
      pedido.productos.map((p) => ({
        nombre: p.producto?.nombre || "Producto sin nombre",
        cantidad: Number(p.cantidad) || 0,
        precio: Number(p.precioSeleccionado) || 0,
      }))
    );

    const productosBebidas = mesa.pedidosBebidas.flatMap((pedido) =>
      pedido.productos.map((p) => ({
        nombre: p.producto?.nombre || "Producto sin nombre",
        cantidad: Number(p.cantidad) || 0,
        precio: Number(p.precioSeleccionado) || 0,
      }))
    );

    // 🧠 Agrupa bebidas por nombre + precio
    const agrupados = {};
    [...productosPlatos, ...productosBebidas].forEach((p) => {
      const key = `${p.nombre}-${p.precio}`;
      if (!agrupados[key]) agrupados[key] = { ...p };
      else agrupados[key].cantidad += p.cantidad;
    });

    const productos = Object.values(agrupados);

    // ✅ Calcula total real con IVA incluido
    const totalConIVA = productos
      .reduce((acc, p) => acc + p.precio * p.cantidad, 0)
      .toFixed(2);

    await axios.post(
      `${process.env.IMPRESION_SERVER}/imprimir-cuenta`,
      {
        mesaNumero: mesa.numero,
        comensales: mesa.comensales,
        productos,
        total: totalConIVA,
      },
      {
        headers: {
          "x-tpv-apikey": process.env.PRINT_SECRET || "clave-secreta-demo",
          "Content-Type": "application/json",
        },
      }
    );

    mesa.cuentaImpresa = true;
    await mesa.save();
    req.io.emit("cuentaImpresa", { mesaId: mesa._id, numero: mesa.numero });

    res.status(200).json({ message: "Cuenta enviada a impresión." });
  } catch (error) {
    console.error("❌ Error al imprimir la cuenta:", error);
    res.status(500).json({ error: "Error al imprimir la cuenta." });
  }
};
