import axios from 'axios';
import Mesa from '../models/Mesa.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado
import dotenv from 'dotenv';
dotenv.config();

const IMPRESION_SERVER = process.env.IMPRESION_SERVER;

// Función genérica para enviar a impresión
const enviarAImpresion = async (endpoint, payload) => {
  const PRINT_SECRET = process.env.PRINT_SECRET || "clave-secreta-demo";
  const baseURL = process.env.IMPRESION_SERVER || "http://127.0.0.1:4000";

  return await axios.post(`${baseURL}/${endpoint}`, payload, {
    headers: {
      "x-tpv-apikey": PRINT_SECRET,
      "Content-Type": "application/json",
    },
  });
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
        path: "pedidos",
        match: { estado: { $in: ["pendiente", "listo"] } },
      })
      .lean();

    if (!mesa) {
      console.warn("⚠️ [BACKEND] Mesa no encontrada");
      return res.status(404).json({ error: "Mesa no encontrada" });
    }
    // 📦 Recopilar productos
    const productos = mesa.pedidos.flatMap((pedido) =>
      pedido.productos.map((p) => ({
        nombre: p.nombre,
        cantidad: p.cantidad,
        precio: Number(p.precioSeleccionado) || 0,
        iva: p.iva ?? 10, // si tu modelo guarda IVA explícito
      }))
    );

    // 🧾 Calcular totales previos
    const totalMesa = productos.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

    // 👉 Simular el mismo desglose que usa la impresora
    const porTipo = new Map();
    for (const p of productos) {
      const iva = Number(p.iva ?? 10);
      const totalLinea = Number((p.precio * p.cantidad).toFixed(2));
      const base = Number((totalLinea / (1 + iva / 100)).toFixed(2));
      const cuota = Number((totalLinea - base).toFixed(2));
      const item = porTipo.get(iva) || { base: 0, cuota: 0, total: 0 };
      item.base += base;
      item.cuota += cuota;
      item.total += totalLinea;
      porTipo.set(iva, item);
    }

    let totalBase = 0;
    let totalCuota = 0;
    let totalConIVA = 0;
    for (const [iva, { base, cuota, total }] of porTipo.entries()) {
      totalBase += base;
      totalCuota += cuota;
      totalConIVA += total;
    }

    const response = await enviarAImpresion("imprimir-cuenta", {
      mesaNumero: mesa.numero,
      comensales: mesa.comensales || 0,
      productos,
    });

    res.json({
      message: "Cuenta enviada correctamente",
      data: response.data,
    });
  } catch (error) {
    console.error("❌ [BACKEND] Error al imprimir cuenta:", error);
    res.status(500).json({ error: "Error al imprimir cuenta", detalle: error.message });
  }
};

// 👇 Añade este helper junto a tus otras funciones

export const abrirCajon = async () => {
  const base = process.env.IMPRESION_SERVER || "http://127.0.0.1:4000";
  const url = `${base}/abrir-cajon`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 800); // ⏳ límite real

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn(`⚠️ Impresora respondió con error HTTP ${res.status}`);
      return false;
    }

    logger.info("🔓 Cajón abierto correctamente.");
    return true;

  } catch (err) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      logger.warn("⚠️ Timeout al intentar abrir el cajón (flujo continúa)");
      return false;
    }

    logger.warn(`⚠️ No se pudo abrir el cajón: ${err.message}`);
    return false;
  }
};