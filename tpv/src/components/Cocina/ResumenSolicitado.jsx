import React, { useEffect, useState } from "react";
import "./ResumenSolicitado.css";
import ResumenSolicitadoModal from "./ResumenSolicitadoModal";

export default function ResumenSolicitado({ pedidos, onClose }) {
    const [resumen, setResumen] = useState([]);
    const [itemSeleccionado, setItemSeleccionado] = useState(null);

    useEffect(() => {
        const conteo = {};

        pedidos.forEach((pedido) => {
            pedido.productos
                .filter((p) => p.workflow?.estado === "solicitado")
                .forEach((p) => {
                    const nombre = p.producto?.nombre || "Producto";
                    const tipo = p.tipoPrecio;

                    const key =
                        tipo && tipo !== "precioBase"
                            ? `${nombre} (${tipo})`
                            : nombre;

                    if (!conteo[key]) {
                        conteo[key] = { nombre: key, cantidad: 0, mesas: [] };
                    }

                    conteo[key].cantidad += p.cantidad;
                    conteo[key].mesas.push({
                        mesa: pedido.mesa?.numero,
                        cantidad: p.cantidad,
                    });
                });
        });

        setResumen(Object.values(conteo));
    }, [pedidos]);

    return (
        <>
            <div className="resumen-panel--cocina">
                <div className="resumen-header--cocina">
                    <h3>Productos Solicitados</h3>
                    <button onClick={onClose}>✕</button>
                </div>

                <ul>
                    {resumen.length === 0 ? (
                        <li>No hay productos solicitados.</li>
                    ) : (
                        resumen.map((item, i) => (
                            <li
                                key={i}
                                className="solicitado-item clickable"
                                onClick={() => setItemSeleccionado(item)}
                            >
                                <strong>{item.cantidad}x</strong> {item.nombre}
                            </li>
                        ))
                    )}
                </ul>
            </div>

            {/* MODAL */}
            {itemSeleccionado && (
                <ResumenSolicitadoModal
                    producto={itemSeleccionado.nombre}
                    detalle={itemSeleccionado.mesas}
                    onClose={() => setItemSeleccionado(null)}
                />
            )}
        </>
    );
}
