
const ListaBebidas = ({ pedidosBebidas, eliminarProducto, setAccionModal, setMostrarModalConfirmacion }) => {
  return (
    <ul className="lista-pedidos--mesadetalles">
      {pedidosBebidas.length > 0 ? (
        pedidosBebidas.map((pedido) => (
          <li key={pedido._id} className="pedido--mesadetalles">
            <ul className="lista-productos--mesadetalles">
              {pedido.productos?.length > 0 ? (
                pedido.productos.map((producto) => {
                  const bebida = producto.producto;
                  const nombre = typeof bebida === "string" ? "" : bebida?.nombre;
                  const productoId =
                    typeof bebida === "string" ? bebida : bebida?._id;

                  return (
                    <li
                      key={productoId}
                      className={`producto--mesadetalles ${producto.estadoPreparacion === "listo"
                          ? "producto-listo"
                          : ""
                        }`}
                    >
                      {nombre
                        ? `${producto.cantidad} ${nombre}`
                        : "Cargando bebida..."}
                      <button
                        className="boton-eliminar--mesadetalles"
                        onClick={() =>
                          setAccionModal({
                            titulo: "Eliminar bebida",
                            mensaje: `¿Seguro que quieres eliminar ${nombre || "esta bebida"} de la mesa?`,
                            onConfirm: () => eliminarProducto(pedido._id, productoId),
                          }) || setMostrarModalConfirmacion(true)
                        }
                      >
                        x
                      </button>
                    </li>
                  );
                })
              ) : (
                <p className="sin-productos--mesadetalles">
                  No hay bebidas en este pedido.
                </p>
              )}
            </ul>
          </li>
        ))
      ) : (
        <p className="sin-pedidos--mesadetalles">
          No hay pedidos de bebidas disponibles.
        </p>
      )}
    </ul>
  );
};

export default ListaBebidas;
