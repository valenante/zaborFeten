import { useState } from "react";
import api from "../utils/api";
import * as logger from '../utils/logger';

const usePedidosMesa = (mesa, setMesa) => {
  const [mensajeAlerta, setMensajeAlerta] = useState(null);

  const refrescarMesa = async () => {
    try {
      const { data } = await api.get(`/mesas/${mesa._id}`);
      setMesa(data); // ← actualiza pedidos, pedidosBebidas y total correctamente
    } catch (error) {
      console.error("Error al refrescar la mesa:", error);
    }
  };

  const agregarProducto = async (productoPersonalizado) => {
    try {
      const esBebida = productoPersonalizado.tipo === "bebida";
      const ruta = esBebida
        ? `pedidosBebidas/${mesa._id}/agregar-producto`
        : `pedidos/${mesa._id}/agregar-producto`;

      const { data } = await api.post(ruta, {
        productos: {
          producto: productoPersonalizado._id,
          cantidad: productoPersonalizado.cantidad,
          total:
            productoPersonalizado.precioSeleccionado *
            productoPersonalizado.cantidad,
          precioSeleccionado: productoPersonalizado.precioSeleccionado,
          tipoPrecio: productoPersonalizado.tipoPrecio,
          tipoPlato: productoPersonalizado.tipoPlato || null,
          acompanante: productoPersonalizado.acompanante || null,
          tipo: productoPersonalizado.tipo,
          categoria: productoPersonalizado.categoria,
          ingredientes: productoPersonalizado.ingredientes || [],
          opcionesPersonalizables:
            productoPersonalizado.opciones &&
              Object.keys(productoPersonalizado.opciones).length > 0
              ? Object.entries(productoPersonalizado.opciones).map(
                ([tipo, opcion]) => ({ tipo, opcion })
              )
              : [],
        },
      });

      setMensajeAlerta({
        tipo: "exito",
        mensaje: `Producto ${esBebida ? "bebida" : "plato"} agregado al pedido con éxito.`,
      });

      await refrescarMesa(); // en lugar de window.location.reload()
    } catch (error) {
      logger.error("Error al agregar el producto al pedido:", error);
      setMensajeAlerta({
        tipo: "error",
        mensaje: error.response?.data?.error || "Hubo un problema.",
      });
    }
  };

  const eliminarProducto = async (pedidoId, productoId) => {
  try {
    const response = await api.post(`/productos/${pedidoId}/${productoId}`);

    setMesa((prevMesa) => ({
      ...prevMesa,
      pedidos: response.data.pedidos,
    }));

    setMensajeAlerta({
      tipo: "exito",
      mensaje: "Producto eliminado con éxito.",
    });
  } catch (error) {
    logger.error("Error al eliminar el producto:", error);
    setMensajeAlerta({
      tipo: "error",
      mensaje: "Hubo un problema al eliminar el producto.",
    });
  }
};


  return {
    agregarProducto,
    eliminarProducto,
    mensajeAlerta,
    setMensajeAlerta,
    refrescarMesa,
  };
};

export default usePedidosMesa;
