import React, { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Trans } from "@lingui/react/macro";
import "./CarritoOrganizableModal.css";

const CarritoOrganizableModal = ({
  items,
  setItems,
  servirTodoJunto,
  setServirTodoJunto,
  eliminarProducto,
}) => {
  const SECCIONES = ["entrante", "medio", "final"];

  // 🧠 Detección segura del tipo
  const esBebida = (item) => {
    const tipo = item.tipo || item.productId?.tipo || "";
    return tipo.toLowerCase().includes("bebida");
  };

  // 🧩 Agrupación automática por sección (fallback a "medio")
  const { platosAgrupados, bebidas } = useMemo(() => {
    const agrupados = {
      entrante: [],
      medio: [],
      final: [],
    };

    (items || []).forEach((item) => {
      if (esBebida(item)) return; // separamos bebidas aparte

      // 🔸 si no tiene sección, le asignamos "medio"
      const seccion = item.seccion || item.productId?.seccion || "medio";
      agrupados[seccion]?.push(item);
    });

    const bebidas = (items || []).filter((i) => esBebida(i));
    return { platosAgrupados: agrupados, bebidas };
  }, [items]);

  // 🧱 Manejo del drag & drop
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;

    // Si no cambió nada, no hacemos nada
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const updated = Array.from(items);

    // Encuentra el item movido
    const movedItem = updated.find(
      (i) =>
        (i.seccion || i.productId?.seccion || "medio") === source.droppableId &&
        !esBebida(i) &&
        source.index ===
          updated
            .filter((x) => !esBebida(x))
            .filter((x) => (x.seccion || x.productId?.seccion || "medio") === source.droppableId)
            .indexOf(i)
    );

    if (!movedItem) return;

    // Eliminar del array original
    const movedIndexGlobal = updated.findIndex((i) => i._id === movedItem._id);
    updated.splice(movedIndexGlobal, 1);

    // Actualizar la sección
    movedItem.seccion = destination.droppableId;

    // Calcular índice de destino global
    const destItems = updated.filter(
      (i) =>
        !esBebida(i) &&
        (i.seccion || i.productId?.seccion || "medio") === destination.droppableId
    );
    const destItem = destItems[destination.index];
    const destIndexGlobal = destItem
      ? updated.findIndex((i) => i._id === destItem._id)
      : updated.length;

    // Insertar en nueva posición
    updated.splice(destIndexGlobal, 0, movedItem);

    setItems(updated);
  };

  return (
    <div className="carrito-organizable-modal">
      {/* ✅ Checkbox servir todo junto */}
      <label className="checkbox-servir-junto">
        <input
          type="checkbox"
          checked={servirTodoJunto}
          onChange={(e) => setServirTodoJunto(e.target.checked)}
        />
        <Trans>Servir todo junto</Trans>
      </label>

      {/* 🧩 Secciones de platos */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="carrito-organizable-container">
          {SECCIONES.map((seccion) => {
            const productos = platosAgrupados[seccion] || [];

            return (
              <Droppable key={seccion} droppableId={seccion}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`carrito-section ${
                      snapshot.isDraggingOver ? "drag-over" : ""
                    }`}
                  >
                    <h5 className="carrito-section-title">
                      {seccion.charAt(0).toUpperCase() + seccion.slice(1)}
                    </h5>

                    {productos.map((item, index) => (
                      <Draggable
                        key={item._id}
                        draggableId={item._id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`item-carrito-draggable ${
                              snapshot.isDragging ? "dragging" : ""
                            }`}
                          >
                            <div className="item-info">
                              <span>{item.productId.nombre}</span>
                              <small>x{item.cantidad}</small>
                            </div>
                            <button
                              className="btn-eliminar-item"
                              onClick={() => eliminarProducto(item._id)}
                            >
                              ❌
                            </button>
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

      {/* 🥤 Sección de bebidas */}
      {bebidas.length > 0 && (
        <div className="carrito-section bebidas-section">
          <h5 className="carrito-section-title">Bebidas</h5>
          {bebidas.map((item) => (
            <div key={item._id} className="item-carrito-draggable no-drag">
              <div className="item-info">
                <span>{item.productId.nombre}</span>
                <small>x{item.cantidad}</small>
              </div>
              <button
                className="btn-eliminar-item"
                onClick={() => eliminarProducto(item._id)}
              >
                ❌
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CarritoOrganizableModal;
