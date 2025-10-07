import React, { useContext, useEffect, useState } from "react";
import { ProductosContext } from "../../context/ProductosContext";
import ProductoCard from "./ProductoCard";
import "../../styles/Carta.css";
import api from "../../utils/api";
import * as logger from "../../utils/logger";
import Navbar from "../Navbar/Navbar";

const normaliza = (str) => (str ?? "Otros").trim().toLowerCase();

const Carta = () => {
  const { productos, categoriaSeleccionada, cargarProductos } = useContext(ProductosContext);
  const [valoraciones, setValoraciones] = useState({});
  const [mostrarSoloBebidas, setMostrarSoloBebidas] = useState(false);

  useEffect(() => {
    const cargarValoraciones = async () => {
      try {
        const { data } = await api.get("/valoraciones/valoraciones/mas-valorados");
        const valoracionesMapeadas = data.reduce((acc, { _id, estrellas }) => {
          acc[_id] = parseFloat(estrellas.toFixed(1));
          return acc;
        }, {});
        setValoraciones(valoracionesMapeadas);
      } catch (error) {
        logger.error("Error al cargar valoraciones:", error);
      }
    };

    cargarProductos();
    cargarValoraciones();
  }, [cargarProductos]);

  // Filtrar productos según categoría o bebidas
  const productosFiltrados = productos.filter((producto) => {
    const esCategoriaValida = categoriaSeleccionada
      ? producto.categoria === categoriaSeleccionada
      : true;
    const estaHabilitado = producto.estado === "habilitado";
    const esBebida = producto.tipo === "bebida";

    if (mostrarSoloBebidas) return esBebida && estaHabilitado;
    return esCategoriaValida && estaHabilitado;
  });

  // Agrupar productos por categoría (normalizando la clave, pero conservando la etiqueta "bonita")
  const categoriasMap = new Map();
  for (const p of productosFiltrados) {
    const etiquetaOriginal = (p.categoria ?? "Otros").trim();
    const key = normaliza(etiquetaOriginal);
    if (!categoriasMap.has(key)) {
      categoriasMap.set(key, {
        etiqueta: etiquetaOriginal || "Otros",
        items: [],
        hasBebida: false,
        hasComida: false,
      });
    }
    const meta = categoriasMap.get(key);
    meta.items.push(p);
    if (p.tipo === "bebida") meta.hasBebida = true;
    else meta.hasComida = true;
  }

  // Pasar a array para poder ordenar
  const categoriasArr = Array.from(categoriasMap.entries()); // [key, meta]

  // Orden:
  // 1) Bloque comidas/mixtas (hasComida) antes que bebidas-only (solo hasBebida)
  // 2) Dentro de comidas: Entrantes primero, Postres último, resto alfabético
  // 3) Bebidas-only alfabético
  categoriasArr.sort(([keyA, a], [keyB, b]) => {
    const aBloque = a.hasComida ? 0 : 1; // 0 = comidas/mixtas, 1 = solo bebidas
    const bBloque = b.hasComida ? 0 : 1;
    if (aBloque !== bBloque) return aBloque - bBloque;

    // Si estamos en bloque comidas/mixtas:
    if (aBloque === 0) {
      const aIsEntrantes = keyA === "entrantes";
      const bIsEntrantes = keyB === "entrantes";
      if (aIsEntrantes && !bIsEntrantes) return -1;
      if (!aIsEntrantes && bIsEntrantes) return 1;

      const aIsPostres = keyA === "postres";
      const bIsPostres = keyB === "postres";
      if (aIsPostres && !bIsPostres) return 1;   // Postres al final
      if (!aIsPostres && bIsPostres) return -1;

      return a.etiqueta.localeCompare(b.etiqueta, "es", { sensitivity: "base" });
    }

    // Bloque bebidas-only: alfabético
    return a.etiqueta.localeCompare(b.etiqueta, "es", { sensitivity: "base" });
  });

  return (
    <>
      <Navbar
        setMostrarSoloBebidas={setMostrarSoloBebidas}
        mostrarSoloBebidas={mostrarSoloBebidas}
      />

      <div className="carta-container">
        {categoriasArr.map(([_, meta]) => (
          <div key={meta.etiqueta} className="categoria-seccion">
            <h2 className="categoria-titulo">{meta.etiqueta}</h2>
            <div className="productos-grid">
              {meta.items
                .sort((a, b) => {
                  if (a.tipo === "bebida" && b.tipo !== "bebida") return 1;
                  if (a.tipo !== "bebida" && b.tipo === "bebida") return -1;
                  return 0;
                })
                .map((producto) => (
                  <ProductoCard
                    key={producto._id}
                    producto={producto}
                    estrellas={valoraciones[producto._id]}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Carta;
