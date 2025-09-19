import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./CarritoOrganizable.css";

const SECCIONES = ["entrante", "medio", "final"];

const CarritoOrganizable = ({ carrito, setCarrito }) => {
  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;

    // Si no cambia de sitio, no hacemos nada
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    setCarrito((prev) => {
      const items = Array.from(prev);

      // Filtra solo los items de la sección origen
      const sourceItems = items.filter((i) => i.seccion === source.droppableId);
      const destItems = items.filter((i) => i.seccion === destination.droppableId);

      // Obtenemos el item a mover
      const movedItem = sourceItems[source.index];

      // Eliminar del array global en su posición real
      const itemIndexGlobal = items.findIndex((i) => i.uid === movedItem.uid);
      items.splice(itemIndexGlobal, 1);

      // Actualizar la sección si cambió
      if (source.droppableId !== destination.droppableId) {
        movedItem.seccion = destination.droppableId;
      }

      // Calcular dónde insertar dentro del array global
      // 1. Encontrar todos los items del destino en el array global
      const destUids = destItems.map((d) => d.uid);
      // 2. Si el destino está vacío → empujar al final del array
      if (destUids.length === 0) {
        items.push(movedItem);
      } else {
        // Buscar uid del item que ahora está en la posición destino
        const destItemUid = destItems[destination.index]?.uid;
        if (destItemUid) {
          const destGlobalIndex = items.findIndex((i) => i.uid === destItemUid);
          items.splice(destGlobalIndex, 0, movedItem);
        } else {
          // si no hay item en ese index (drag al final), añadir al final
          items.push(movedItem);
        }
      }

      return items;
    });
  };

  const eliminarProducto = (uid) => {
    setCarrito((prev) => prev.filter((item) => item.uid !== uid));
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="carrito-organizable-container">
        {SECCIONES.map((seccion) => {
          const productosSeccion = carrito.filter(
            (item) => item.seccion === seccion
          );

          return (
            <Droppable
              key={seccion}
              droppableId={seccion}
              isCombineEnabled={false}
              ignoreContainerClipping={false}
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`carrito-section ${snapshot.isDraggingOver ? "drag-over" : ""
                    }`}
                >
                  <h5 className="carrito-section-title">
                    {seccion.charAt(0).toUpperCase() + seccion.slice(1)}
                  </h5>

                  {productosSeccion.map((item, index) => (
                    <Draggable
                      key={item.uid}
                      draggableId={item.uid}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`carrito-item ${snapshot.isDragging ? "dragging" : ""
                            }`}
                        >
                          <div className="carrito-item-nombre">
                            {item.nombre} x{item.cantidad}
                          </div>
                          <div className="carrito-item-eliminar">
                            <button
                              onClick={() => eliminarProducto(item.uid)}
                              className="carrito-eliminar-button"
                              title="Eliminar"
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
      </div>
    </DragDropContext>
  );
};

export default CarritoOrganizable;
