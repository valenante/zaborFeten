/**
 * Script para asignar automáticamente el campo "seccion"
 * a los productos según su categoría.
 *
 * Ejemplo de ejecución:
 *   node asignarSecciones.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Producto from "./src/models/Producto.js"; // 👈 Ajusta la ruta según tu estructura

dotenv.config(); // Carga las variables de entorno (MONGO_URI, etc.)

const MONGO_URI = process.env.MONGO_URI;

const asignarSecciones = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a la base de datos");

    // Mapeo de categorías a secciones
    const mapa = {
      entrante: ["ensaladas", "entrantes", "extras"],
      medio: ["especiales", "tapas"],
      final: ["platos principales", "postres"],
    };

    // Obtenemos todos los productos
    const productos = await Producto.find({});
    console.log(`📦 ${productos.length} productos encontrados`);

    let actualizados = 0;

    for (const producto of productos) {
      const categoria = producto.categoria?.toLowerCase()?.trim();

      if (!categoria) continue;

      let nuevaSeccion = null;
      if (mapa.entrante.includes(categoria)) nuevaSeccion = "entrante";
      else if (mapa.medio.includes(categoria)) nuevaSeccion = "medio";
      else if (mapa.final.includes(categoria)) nuevaSeccion = "final";

      if (nuevaSeccion && producto.seccion !== nuevaSeccion) {
        producto.seccion = nuevaSeccion;
        await producto.save();
        actualizados++;
        console.log(`🟢 ${producto.nombre} → ${nuevaSeccion}`);
      }
    }

    console.log(`\n✅ Secciones actualizadas correctamente: ${actualizados}`);
    await mongoose.disconnect();
    console.log("🔌 Desconectado de la base de datos");
  } catch (error) {
    console.error("❌ Error asignando secciones:", error);
    process.exit(1);
  }
};

asignarSecciones();
