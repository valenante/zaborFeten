import React, { useState } from "react";
import ModalConfirmacion from "../Modal/ModalConfirmacion.jsx";

const ListaBebidas = ({ pedidosBebidas, eliminarProducto }) => {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [accionModal, setAccionModal] = useState({});

  return (
    <>
      <ul className="lista-pedidos--mesadetalles">
        {pedidosBebidas.length > 0 ? (
          pedidosBebidas.map((pedido) => (
            <li key={pedido._id} className="pedido--mesadetalles">
              <ul className="lista-productos--mesadetalles">
                {pedido.productos?.length > 0 ? (
                  pedido.productos.map((producto) => {
                    const bebida = producto.producto;
                    const nombre =
                      typeof bebida === "string" ? "" : bebida?.nombre;

                    // 🔥 ESTE ES EL ID CORRECTO DEL ITEM DEL PEDIDO
                    const productoItemId = producto._id;

                    return (
                      <li
                        key={productoItemId}
                        className={`producto--mesadetalles ${
                          producto.estadoPreparacion === "listo"
                            ? "producto-listo"
                            : ""
                        }`}
                      >
                        {nombre
                          ? `${producto.cantidad} ${nombre}`
                          : "Cargando bebida..."}

                        <button
                          className="boton-eliminar--mesadetalles"
                          onClick={() => {
                            setAccionModal({
                              titulo: "Eliminar bebida",
                              mensaje: `¿Seguro que quieres eliminar ${
                                nombre || "esta bebida"
                              } de la mesa?`,
                              // 👇 Aquí enviamos EL ID CORRECTO
                              onConfirm: () =>
                                eliminarProducto(pedido._id, productoItemId),
                            });
                            setMostrarModal(true);
                          }}
                        >
                          ❌
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

export default ListaBebidas;
