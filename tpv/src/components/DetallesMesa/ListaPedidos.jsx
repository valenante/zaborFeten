import React from "react";

const ListaPedidos = ({
  pedidos,
  productosDetalles,
  eliminarProducto,
  setAccionModal,
  setMostrarModalConfirmacion,
  solicitarProducto, // 👈 nuevo prop
}) => {
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

                const estacion = producto.estacion || "frito"; // por defecto
                const estado = producto.workflow?.estado || "pendiente";
                const solicitadoA = producto.workflow?.solicitadoA;

                return (
                  <li
                    key={productoId}
                    className={`producto--mesadetalles ${
                      producto.estadoPreparacion === "listo"
                        ? "producto-listo"
                        : ""
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
                          solicitarProducto(pedido._id, producto._id, estacion)
                        }
                        disabled={estado === "solicitado"}
                        title={
                          estado === "solicitado"
                            ? "Ya solicitado"
                            : `Enviar a ${estacion}`
                        }
                      >
                        Solicitar
                      </button>

                      <button
                        className="boton-eliminar--mesadetalles"
                        onClick={() =>
                          setAccionModal({
                            titulo: "Eliminar producto",
                            mensaje: `¿Seguro que quieres eliminar ${detalle?.nombre || "este producto"} de la mesa?`,
                            onConfirm: () => eliminarProducto(pedido._id, productoId),
                          }) || setMostrarModalConfirmacion(true)
                        }
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
