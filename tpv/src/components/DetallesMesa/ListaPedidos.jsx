import React, { useState } from "react";
import ModalConfirmacion from "../Modal/ModalConfirmacion.jsx";
import * as logger from "../../utils/logger";

const ListaPedidos = ({
  pedidos,
  productosDetalles,
  eliminarProducto,
  solicitarProducto,
  setMesa,
}) => {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [accionModal, setAccionModal] = useState({});

  // ===========================================
  // AGRUPAR PRODUCTOS POR SECCIÓN
  // ===========================================
  const grupos = {
    entrante: [],
    medio: [],
    final: [],
  };

  pedidos.forEach((pedido) => {
    pedido.productos.forEach((producto) => {
      const seccion = producto.seccion || "medio";
      if (grupos[seccion]) {
        grupos[seccion].push({ pedidoId: pedido._id, producto });
      }
    });
  });

  const handleSolicitar = async (pedidoId, productoId, estacion) => {
    try {
      // 🧠 Actualización optimista
      setMesa((prevMesa) => ({
        ...prevMesa,
        pedidos: prevMesa.pedidos.map((p) =>
          p._id === pedidoId
            ? {
                ...p,
                productos: p.productos.map((prod) =>
                  prod._id === productoId
                    ? {
                        ...prod,
                        workflow: { ...(prod.workflow || {}), estado: "solicitado" },
                      }
                    : prod
                ),
              }
            : p
        ),
      }));

      await solicitarProducto(pedidoId, productoId, estacion);
    } catch (error) {
      logger.error("Error al solicitar producto:", error);

      // ❌ Revertir
      setMesa((prevMesa) => ({
        ...prevMesa,
        pedidos: prevMesa.pedidos.map((p) =>
          p._id === pedidoId
            ? {
                ...p,
                productos: p.productos.map((prod) =>
                  prod._id === productoId
                    ? {
                        ...prod,
                        workflow: { ...(prod.workflow || {}), estado: "pendiente" },
                      }
                    : prod
                ),
              }
            : p
        ),
      }));
    }
  };

  const renderSeccion = (nombre, items) => {
    if (items.length === 0) return null;

    return (
      <div className="seccion--mesadetalles">
        <h2 className="titulo-seccion--mesadetalles">{nombre.toUpperCase()}</h2>

        {items.map(({ pedidoId, producto }) => {
          const productoId =
            typeof producto.producto === "string"
              ? producto.producto
              : producto.producto?._id;

          const detalle = productosDetalles[productoId];
          const estacion = producto.estacion || "frito";
          const estado = producto.workflow?.estado || "pendiente";
          const estaListo = producto.estadoPreparacion === "listo";

          return (
            <div
              key={producto._id}
              className={`producto--mesadetalles ${estaListo ? "producto-listo" : ""}`}
            >
              <div className="producto-info--mesadetalles">
                {detalle ? `${producto.cantidad}x ${detalle.nombre}` : "Cargando..."}
                {estado === "solicitado" && (
                  <span className="badge-solicitado--mesadetalles">
                    Solicitado
                  </span>
                )}
              </div>

              <div className="botones-producto--mesadetalles">
                <button
                  className="boton-solicitar--mesadetalles"
                  onClick={() =>
                    handleSolicitar(pedidoId, producto._id, estacion)
                  }
                  disabled={estado === "solicitado" || estaListo}
                >
                  Solicitar
                </button>

                <button
                  className="boton-eliminar--mesadetalles"
                  onClick={() => {
                    setAccionModal({
                      titulo: "Eliminar producto",
                      mensaje: `¿Seguro que quieres eliminar ${
                        detalle?.nombre || "este producto"
                      } de la mesa?`,
                      onConfirm: () =>
                        eliminarProducto(pedidoId, producto._id),
                    });
                    setMostrarModal(true);
                  }}
                >
                  ❌
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {renderSeccion("Entrante", grupos.entrante)}
      {renderSeccion("Medio", grupos.medio)}
      {renderSeccion("Final", grupos.final)}

      {mostrarModal && (
        <ModalConfirmacion
          titulo={accionModal.titulo}
          mensaje={accionModal.mensaje}
          onConfirm={() => {
            accionModal.onConfirm();
            setMostrarModal(false);
          }}
          onClose={() => setMostrarModal(false)}
        />
      )}
    </>
  );
};

export default ListaPedidos;
