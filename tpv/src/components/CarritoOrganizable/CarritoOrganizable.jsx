import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./CarritoOrganizable.css";
import ProductoDetalle from "../RightBar/ProductoDetalle";

const SECCIONES = ["entrante", "medio", "final"];

const CarritoOrganizable = ({ carrito, setCarrito, mensajesSeccion, setMensajesSeccion }) => {
  const [productoEditando, setProductoEditando] = useState(null);
  const [edicion, setEdicion] = useState({});

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    setCarrito((prev) => {
      const items = Array.from(prev);
      const sourceItems = items.filter((i) => i.seccion === source.droppableId);
      const destItems = items.filter((i) => i.seccion === destination.droppableId);
      const movedItem = sourceItems[source.index];

      const itemIndexGlobal = items.findIndex((i) => i.uid === movedItem.uid);
      items.splice(itemIndexGlobal, 1);

      if (source.droppableId !== destination.droppableId) {
        movedItem.seccion = destination.droppableId;
      }

      const destUids = destItems.map((d) => d.uid);
      if (destUids.length === 0) {
        items.push(movedItem);
      } else {
        const destItemUid = destItems[destination.index]?.uid;
        if (destItemUid) {
          const destGlobalIndex = items.findIndex((i) => i.uid === destItemUid);
          items.splice(destGlobalIndex, 0, movedItem);
        } else {
          items.push(movedItem);
        }
      }
      return items;
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
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="carrito-organizable-container">
        {SECCIONES.map((seccion) => {
          const productosSeccion = carrito.filter((item) => item.seccion === seccion);

          return (
            <Droppable key={seccion} droppableId={seccion}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`carrito-section ${snapshot.isDraggingOver ? "drag-over" : ""}`}
                >
                  <h5 className="carrito-section-title">
                    {seccion.charAt(0).toUpperCase() + seccion.slice(1)}
                  </h5>

                  <textarea
                    className="mensaje-seccion"
                    placeholder="Mensaje para cocina (opcional)..."
                    value={mensajesSeccion[seccion]}
                    onChange={(e) => handleMensajeChange(seccion, e.target.value)}
                  />

                  {productosSeccion.map((item, index) => (
                    <Draggable key={item.uid} draggableId={item.uid} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`carrito-item ${snapshot.isDragging ? "dragging" : ""}`}
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
              // actualiza el producto dentro del carrito
              setCarrito(prev =>
                prev.map(p => (p.uid === productoEditando ? { ...p, ...productoActualizado } : p))
              );
              setProductoEditando(null);
            }}
          />
        )}
      </div>
    </DragDropContext>
  );
};

export default CarritoOrganizable;
