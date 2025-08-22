// controllers/reportesController.js
import Venta from "../models/Ventas.js";

export const getVentasHoy = async (req, res) => {
  try {
    const ahora = new Date();

    const desde = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      0, 0, 0
    );

    const hasta = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate() + 1,
      0, 0, 0
    );

    const items = await Venta.aggregate([
      { $match: { fecha: { $gte: desde, $lt: hasta } } },
      {
        $group: {
          _id: "$producto",
          cantidad: { $sum: "$cantidad" },
          ingresos: { $sum: "$total" },
        },
      },
      {
        $lookup: {
          from: "productos",
          localField: "_id",
          foreignField: "_id",
          as: "producto",
        },
      },
      { $unwind: "$producto" },
      {
        $project: {
          productoId: "$_id",
          nombre: "$producto.nombre",
          categoria: "$producto.categoria",
          tipo: "$producto.tipo",          // 👈 añadimos tipo
          cantidad: 1,
          ingresos: 1,
          stockActual: "$producto.stock",
        },
      },
      { $sort: { cantidad: -1 } },
    ]);

    const totales = items.reduce(
      (acc, x) => ({
        cantidad: acc.cantidad + x.cantidad,
        ingresos: acc.ingresos + x.ingresos,
      }),
      { cantidad: 0, ingresos: 0 }
    );

    res.json({ desde, hasta, items, totales });
  } catch (err) {
    console.error("❌ Error en getVentasHoy:", err);
    res.status(500).json({ error: "No se pudo obtener ventas de hoy" });
  }
};
