import React from "react";
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
    const onDragEnd = (result) => {
        if (!result.destination) return;

        const { source, destination } = result;

        // Si no cambió nada, salimos
        if (
            source.droppableId === destination.droppableId &&
            source.index === destination.index
        ) {
            return;
        }

        const updated = Array.from(items);

        // Filtramos solo los PLATOS (no bebidas)
        const sourceItems = updated.filter(
            (i) => (i.seccion || "medio") === source.droppableId && i.tipo !== "bebida"
        );
        const destItems = updated.filter(
            (i) => (i.seccion || "medio") === destination.droppableId && i.tipo !== "bebida"
        );

        // Obtenemos el item movido
        const movedItem = sourceItems[source.index];
        if (!movedItem) return; // evita arrastrar bebidas o nulos

        const movedIndexGlobal = updated.findIndex((i) => i._id === movedItem._id);

        // Eliminar del array global
        updated.splice(movedIndexGlobal, 1);

        // Actualizar la sección solo si es un plato
        movedItem.seccion = destination.droppableId;

        // Encontrar destino global
        const destItem = destItems[destination.index];
        const destIndexGlobal = destItem
            ? updated.findIndex((i) => i._id === destItem._id)
            : updated.length;

        updated.splice(destIndexGlobal, 0, movedItem);

        setItems(updated);
    };

    const SECCIONES = ["entrante", "medio", "final"];

    // 🔍 Detección robusta del tipo de producto
    const esBebida = (item) => {
        const tipo = item.tipo || item.productId?.tipo || "";
        return tipo.toLowerCase().includes("bebida");
    };

    // 🔹 Separar platos y bebidas
    const platos = items.filter((i) => !esBebida(i));
    const bebidas = items.filter((i) => esBebida(i));


    return (
        <div className="carrito-organizable-modal">
            {/* Checkbox para servir todo junto */}
            <label className="checkbox-servir-junto">
                <input
                    type="checkbox"
                    checked={servirTodoJunto}
                    onChange={(e) => setServirTodoJunto(e.target.checked)}
                />
                <Trans>Servir todo junto</Trans>
            </label>

            {/* 🔹 Secciones de platos (con drag & drop) */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="carrito-organizable-container">
                    {SECCIONES.map((seccion) => {
                        const productosSeccion = platos.filter(
                            (i) => (i.seccion || "medio") === seccion
                        );

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
                                            {seccion.charAt(0).toUpperCase() + seccion.slice(1)}
                                        </h5>

                                        {productosSeccion.map((item, index) => (
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
                                                        className={`item-carrito-draggable ${snapshot.isDragging ? "dragging" : ""
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

            {/* 🔸 Sección separada para bebidas (no arrastrable) */}
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
