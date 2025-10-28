import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductosContext } from "../../context/ProductosContext";
import { Trans } from "@lingui/react/macro";
import { useComensal } from "../../context/ComensalesContext";
import api from "../../utils/api";
import * as logger from '../../utils/logger';
import AlertaMensaje from "../AlertaMensaje/AlertaMensaje";
import CarritoOrganizableModal from "./CarritoOrganizableModal";
import "../../styles/CarritoModal.css";

const CarritoModal = ({ cerrarModal }) => {
  const { carrito, cargarCarrito, mesaId, obtenerMesaId } =
    useContext(ProductosContext);
  const [searchParams] = useSearchParams();
  const numeroMesa = searchParams.get("mesa");
  const { comensal } = useComensal();
  const { comensales } = comensal;
  const [mensajeAlerta, setMensajeAlerta] = useState(null);
  const [servirTodoJunto, setServirTodoJunto] = useState(false);
  const [itemsOrdenados, setItemsOrdenados] = useState(carrito.items || []);

  useEffect(() => {
    obtenerMesaId(numeroMesa);
  }, [obtenerMesaId, numeroMesa]);

  useEffect(() => {
    setItemsOrdenados(carrito.items || []);
  }, [carrito]);

  const esLider = async () => {
    try {
      const tokenLocal = localStorage.getItem("tokenLider");
      const response = await api.get(
        `/mesas/token-lider/token-lider/check/${mesaId}`
      );
      const tokenLider = response.data.tokenLider;
      return tokenLocal === tokenLider;
    } catch (error) {
      logger.error("Error al verificar el tokenLider:", error);
      return false;
    }
  };

  const eliminarProducto = async (itemId) => {
    if (!(await esLider())) {
      setMensajeAlerta({
        tipo: "error",
        mensaje: "Solo el líder puede eliminar productos del carrito.",
      });
      return;
    }

    try {
      const cartId = carrito._id;
      if (!cartId) {
        logger.error("No se encontró el identificador del carrito.");
        return;
      }

      const response = await api.delete(`/cart/${itemId}`, {
        headers: { "X-Cart-ID": cartId },
      });

      const { carritoEliminado } = response.data;

      if (carritoEliminado) {
        localStorage.removeItem("carritoMongoId");
      }
      cargarCarrito();
    } catch (error) {
      logger.error("Error al eliminar el producto:", error);
    }
  };

  const enviarPedidoAImpresora = async (
    mesaNumero,
    comensales,
    productos,
    total,
    tipo = "platos"
  ) => {
    try {
      if (tipo !== "bebidas") return;

      const rutaBackend = "/imprimir/imprimir-bebidas";
      await Promise.race([
        api.post(rutaBackend, {
          mesaNumero,
          comensales,
          productos,
          total,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Tiempo de espera agotado")), 3000)
        ),
      ]);
    } catch (error) {
      logger.error("❌ Error al imprimir pedido de bebidas:", error.message);
    }
  };

  const enviarPedido = async () => {
    try {
      const carritoId = localStorage.getItem(`carritoMongoId-${numeroMesa}`);
      const itemsParaEnviar =
        itemsOrdenados?.length > 0 ? itemsOrdenados : carrito.items;

      const productosPlatos = [];
      const productosBebidas = [];

      itemsParaEnviar.forEach((item, index) => {
        const productoData = {
          producto: item.productId._id,
          nombre: item.productId.nombre,
          tipo: item.productId.tipo,
          categoria: item.productId.categoria,
          ingredientesEliminados: item.ingredientes,
          cantidad: item.cantidad,
          precioSeleccionado: item.precioSeleccionado,
          tipoPrecio: item.tipoPrecio,
          total:
            (item.precioSeleccionado || item.productId.precios.precioBase) *
            item.cantidad,
          precios: item.productId.precios,
          nombreComensal: item.nombre,
          alergiasComensal: item.alergias,
          acompanante: item.acompanante,
          adicionales: item.adicionales,
          seccion: item.seccion || item.productId?.seccion || "medio",
          orden: index + 1,
        };

        if (item.productId.tipo === "bebida") {
          productoData.tipoPedido = item.tipoPedido;
          productosBebidas.push(productoData);
        } else {
          productoData.tipoPlato = item.tipoPlato;
          productosPlatos.push(productoData);
        }
      });

      // Pedido de platos
      if (productosPlatos.length > 0) {
        const pedidoPlatos = {
          mesa: mesaId,
          cartId: carritoId,
          productos: productosPlatos,
          total: productosPlatos.reduce((t, i) => t + i.total, 0),
          comensales,
          servirTodoJunto,
        };

        await api.post("/pedidos", pedidoPlatos, {
          params: { mesa: Number(numeroMesa) },
        });

        await enviarPedidoAImpresora(
          numeroMesa,
          comensales,
          productosPlatos.map((p) => ({
            nombre: p.nombre,
            cantidad: p.cantidad,
            opcionesPersonalizables: p.opcionesPersonalizables,
            alergiasComensal: p.alergiasComensal,
            tipoPrecio: p.tipoPrecio,
            seccion: p.seccion,
          })),
          pedidoPlatos.total,
          "platos"
        );
      }

      // Pedido de bebidas
      if (productosBebidas.length > 0) {
        const pedidoBebidas = {
          mesa: mesaId,
          cartId: carritoId,
          productos: productosBebidas,
          total: productosBebidas.reduce((t, i) => t + i.total, 0),
          comensales,
          servirTodoJunto,
        };

        await api.post("/pedidosBebidas", pedidoBebidas, {
          params: { mesa: Number(numeroMesa) },
        });

        await enviarPedidoAImpresora(
          numeroMesa,
          comensales,
          productosBebidas.map((p) => ({
            nombre: p.nombre,
            cantidad: p.cantidad,
            opcionesPersonalizables: p.opcionesPersonalizables,
            alergiasComensal: p.alergiasComensal,
            tipoPrecio: p.tipoPrecio,
            seccion: p.seccion,
          })),
          pedidoBebidas.total,
          "bebidas"
        );
      }

      try {
        await api.delete(`/cart`, { data: { mesa: numeroMesa } });
        logger.info(`🧹 Carrito de la mesa ${numeroMesa} vaciado correctamente`);
      } catch (error) {
        logger.warn(`⚠️ No se pudo vaciar el carrito de la mesa ${numeroMesa}:`, error.message);
      }
      localStorage.removeItem(`carritoMongoId-${numeroMesa}`);

      // 🧹 Limpiar estado visual antes de cerrar
      setItemsOrdenados([]);
      if (carrito) carrito.items = [];

      // ✅ Mostrar mensaje visual
      setMensajeAlerta({
        tipo: "exito",
        mensaje: "✅ Pedido enviado correctamente.",
      });

      cerrarModal();
    } catch (error) {
      logger.error("Error al enviar el pedido:", error);
    }
  };

  const calcularTotal = () => {
    return carrito.items
      ?.reduce((total, item) => {
        const precioBase =
          item.precioSeleccionado || item.productId.precios.precioBase;
        const totalAdicionales = (item.adicionales || []).reduce(
          (acc, adicional) => acc + (adicional.precio || 0),
          0
        );
        const precioFinalUnitario = precioBase + totalAdicionales;
        return total + precioFinalUnitario * item.cantidad;
      }, 0)
      .toFixed(2);
  };

  return (
    <div className="modal-overlay-carritoModal" role="dialog" aria-modal="true">
      <div className="modal-content-carritoModal">
        <button className="modal-close-carritoModal" onClick={cerrarModal}>
          ✖
        </button>

        {/* ✅ Solo un componente organizador */}
        <CarritoOrganizableModal
          items={itemsOrdenados}
          setItems={setItemsOrdenados}
          servirTodoJunto={servirTodoJunto}
          setServirTodoJunto={setServirTodoJunto}
          eliminarProducto={eliminarProducto} // 👈 NUEVO
        />

        <h3 className="total-carritoModal"><Trans>Total</Trans>: {calcularTotal()} €</h3>

        <button onClick={enviarPedido} className="btn-submit-carritoModal">
          <Trans>Enviar Pedido</Trans>
        </button>
      </div>

      {mensajeAlerta && (
        <AlertaMensaje
          tipo={mensajeAlerta.tipo}
          mensaje={mensajeAlerta.mensaje}
          onClose={() => setMensajeAlerta(null)}
        />
      )}
    </div>
  );
};

export default CarritoModal;
