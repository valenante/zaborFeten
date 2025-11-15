import React, { useState, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./CarritoOrganizable.css";
import ProductoDetalle from "../RightBar/ProductoDetalle";

const SECCIONES = ["entrante", "medio", "final", "bebidas"];

const CarritoOrganizable = ({
  carrito,
  setCarrito,
  mensajesSeccion,
  setMensajesSeccion,
}) => {
  const [productoEditando, setProductoEditando] = useState(null);
  const [edicion, setEdicion] = useState({});
  const [vista, setVista] = useState("platos"); // "platos" | "bebidas"

  const carritoNormalizado = useMemo(
    () =>
      carrito.map((item) => ({
        ...item,
        seccion:
          item.seccion && item.seccion.trim() !== ""
            ? item.seccion
            : item.productId?.seccion || "medio",
      })),
    [carrito]
  );

  // 🔍 Depuración Drag & Drop
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) {
      console.warn("❌ No hay destino");
      return;
    }

    // Si no cambia la posición ni la sección
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    setCarrito((prev) => {
      const updated = Array.from(prev);
      const fromIndex = updated.findIndex((i) => i.uid === result.draggableId);
      if (fromIndex === -1) {
        console.error("⚠️ No se encontró el item en el carrito:", result.draggableId);
        return prev;
      }

      const [movedItem] = updated.splice(fromIndex, 1);

      // Actualizamos su sección
      movedItem.seccion = destination.droppableId.toLowerCase().trim();

      // Calculamos el índice global de inserción
      let insertAt = 0;
      let countInSection = 0;

      for (let i = 0; i < updated.length; i++) {
        const section =
          updated[i].seccion ||
          updated[i].productId?.seccion ||
          (updated[i].tipo === "bebida" ? "bebidas" : "medio");

        if (section === destination.droppableId) {
          if (countInSection === destination.index) {
            insertAt = i;
            break;
          }
          countInSection++;
        }
        insertAt = i + 1;
      }

      updated.splice(insertAt, 0, movedItem);

      return updated;
    });
  };

  const eliminarProducto = (uid) => {
    setCarrito((prev) => prev.filter((item) => item.uid !== uid));
  };

  const handleMensajeChange = (seccion, valor) => {
    setMensajesSeccion((prev) => ({ ...prev, [seccion]: valor }));
  };

  const abrirEdicion = (item) => {
    setProductoEditando(item.uid);
    setEdicion({ ...item });
  };

  return (
    <>

      <div className="carrito-toggle">
        <button
          className={vista === "platos" ? "activo" : ""}
          onClick={() => setVista("platos")}
        >
          Platos
        </button>

        <button
          className={vista === "bebidas" ? "activo" : ""}
          onClick={() => setVista("bebidas")}
        >
          Bebidas
        </button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="carrito-organizable-container">
          {SECCIONES.filter(sec =>
            vista === "platos" ? sec !== "bebidas" : sec === "bebidas"
          ).map((seccion) => {
            // ✅ Nueva versión más clara y estable
            const productosSeccion = carritoNormalizado.filter((item) => {
              const tipo = (item.tipo || "").toLowerCase().trim();
              const seccionItem = (item.seccion || item.productId?.seccion || "medio")
                .toLowerCase()
                .trim();

              // ✅ Todo lo que NO sea bebida se considera plato
              const esBebida = tipo === "bebida";

              if (seccion === "bebidas") {
                return esBebida;
              }

              // 🧩 Todo lo que no sea bebida, va a las secciones de cocina (entrante, medio, final)
              return !esBebida && (seccionItem === seccion || (!seccionItem && seccion === "medio"));
            });


            return (
              <Droppable key={seccion} droppableId={seccion}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`carrito-section ${snapshot.isDraggingOver ? "drag-over" : ""
                      }`}
                  >
                    <h5 className="carrito-section-title">
                      {seccion === "bebidas"
                        ? "Bebidas"
                        : seccion.charAt(0).toUpperCase() + seccion.slice(1)}
                    </h5>

                    {seccion !== "bebidas" && (
                      <textarea
                        className="mensaje-seccion"
                        placeholder="Mensaje para cocina (opcional)..."
                        value={mensajesSeccion[seccion] || ""}
                        onChange={(e) =>
                          handleMensajeChange(seccion, e.target.value)
                        }
                      />
                    )}

                    {productosSeccion.map((item, index) => (
                      <Draggable key={item.uid} draggableId={item.uid} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`carrito-item ${snapshot.isDragging ? "dragging" : ""
                              }`}
                            onClick={() => abrirEdicion(item)}
                          >
                            <div className="carrito-item-nombre">
                              {item.nombre} x{item.cantidad}
                              {item.mensaje && <small> — {item.mensaje}</small>}
                            </div>
                            <div className="carrito-item-eliminar">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  eliminarProducto(item.uid);
                                }}
                                className="carrito-eliminar-button"
                              >
                                ❌
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}

          {productoEditando && (
            <ProductoDetalle
              producto={edicion}
              cerrarModal={() => setProductoEditando(null)}
              seleccionPrecioInicial={edicion.precioSeleccionado}
              modoEdicion={true}
              onConfirm={(productoActualizado) => {
                const nuevoCarrito = carrito.map((p) =>
                  p.uid === productoEditando ? { ...p, ...productoActualizado } : p
                );
                setCarrito(nuevoCarrito);
                setProductoEditando(null);
              }}
            />
          )}
        </div>
      </DragDropContext></>
  );
};

export default CarritoOrganizable;
