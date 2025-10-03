import mongoose from "mongoose";
import Producto from "../src/models/Producto.js"; // ajusta la ruta según tu estructura

const MONGO_URI = "mongodb+srv://valenante:Torremolinos12!@cluster0.z4vjm.mongodb.net/Base?retryWrites=true&w=majority";

const categoriaEstacion = {
  burgers: "plancha",
  "platos principales": "plancha",
  postres: "frio",
  ensaladas: "frio",
  entrantes: "frito",
  especiales: "frito",
  tapas: "frito",
};

async function asignarEstaciones() {
  try {
    await mongoose.connect(MONGO_URI);

    const categorias = Object.keys(categoriaEstacion);

    // Actualizar productos
    const res = await Producto.updateMany(
      {
        tipo: { $ne: "bebida" },
        categoria: { $in: categorias },
      },
      [
        {
          $set: {
            estacion: {
              $switch: {
                branches: categorias.map((cat) => ({
                  case: { $eq: ["$categoria", cat] },
                  then: categoriaEstacion[cat],
                })),
                default: "sin-asignar",
              },
            },
          },
        },
      ]
    );

    // Buscar y mostrar los productos afectados
    const actualizados = await Producto.find({
      tipo: { $ne: "bebida" },
      categoria: { $in: categorias },
    }).select("nombre categoria estacion");

    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error asignando estaciones:", err);
    process.exit(1);
  }
}

asignarEstaciones();
