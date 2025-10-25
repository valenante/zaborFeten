import React from "react";
import * as logger from "../../utils/logger";

const ListaPedidos = ({
  pedidos,
  productosDetalles,
  eliminarProducto,
  setAccionModal,
  setMostrarModalConfirmacion,
  solicitarProducto,
  setMesa, // ✅ recibimos setMesa en lugar de setPedidos
}) => {
  const handleSolicitar = async (pedidoId, productoId, estacion) => {
    try {
      // 🧠 Actualización optimista sobre mesa.pedidos
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

      // 🚀 Enviar solicitud real al backend
      await solicitarProducto(pedidoId, productoId, estacion);
    } catch (error) {
      logger.error("Error al solicitar producto:", error);

      // 🔄 Si falla, revertimos el cambio local
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

  return (
    <ul className="lista-pedidos--mesadetalles">
      {pedidos.length > 0 ? (
        pedidos.map((pedido) => (
          <li key={pedido._id} className="pedido--mesadetalles">
            <ul className="lista-productos--mesadetalles">
              {pedido.productos.map((producto) => {
                const productoId =
                  typeof producto.producto === "string"
                    ? producto.producto
                    : producto.producto?._id;

                const detalle = productosDetalles[productoId];
                const estacion = producto.estacion || "frito";
                const estado = producto.workflow?.estado || "pendiente";
                const estaListo = producto.estadoPreparacion === "listo";

                return (
                  <li
                    key={productoId}
                    className={`producto--mesadetalles ${
                      estaListo ? "producto-listo" : ""
                    }`}
                  >
                    <div className="producto-info--mesadetalles">
                      {detalle
                        ? `${producto.cantidad} ${detalle.nombre}`
                        : "Cargando producto..."}
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
                          handleSolicitar(pedido._id, producto._id, estacion)
                        }
                        disabled={estado === "solicitado" || estaListo}
                        title={
                          estaListo
                            ? "El producto ya está listo"
                            : estado === "solicitado"
                            ? "Ya solicitado"
                            : `Enviar a ${estacion}`
                        }
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
                              eliminarProducto(pedido._id, productoId),
                          });
                          setMostrarModalConfirmacion(true);
                        }}
                      >
                        x
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))
      ) : (
        <p className="sin-pedidos--mesadetalles">No hay pedidos.</p>
      )}
    </ul>
  );
};

export default ListaPedidos;
