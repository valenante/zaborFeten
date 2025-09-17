import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as logger from "../../utils/logger";
import AlertaMensaje from "../AlertaMensaje/AlertaMensaje";
import "./FacturasPage.css";

const FacturasPage = () => {
    const [facturas, setFacturas] = useState([]);
    const [filtroAnio, setFiltroAnio] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [mensajeAlerta, setMensajeAlerta] = useState(null);
    const [subtipo, setSubtipo] = useState(""); // S o I

    // Formulario de rectificación
    const [tipo, setTipo] = useState("");
    const [clienteNombre, setClienteNombre] = useState("");
    const [clienteNIF, setClienteNIF] = useState("");
    const [importeTotal, setImporteTotal] = useState("");
    const [motivo, setMotivo] = useState("");

    const cargarFacturas = async () => {
        try {
            const { data } = await api.get(`/facturas/facturas-encadenadas`);
            setFacturas(data.facturas);
        } catch (error) {
            logger.error("Error al cargar facturas:", error);
        }
    };

    useEffect(() => {
        cargarFacturas();
    }, []);

    // --- Acciones ---
    const abrirModalRectificacion = (facturaId) => {
        setFacturaSeleccionada(facturaId);
        setMostrarModal(true);
    };

    const confirmarRectificacion = async () => {
        try {
            const { data } = await api.post(`/facturas/rectificar/${facturaSeleccionada}`, {
                tipoFactura: tipo,
                tipoRectificativa: ["R1", "R2"].includes(tipo) ? subtipo : null,
                clienteNombre,
                clienteNIF,
                importeTotal: parseFloat(importeTotal),
                motivo,
            });

            setMensajeAlerta({
                tipo: "exito",
                mensaje: `Factura rectificativa emitida correctamente: Nº ${data.facturaRectificativa.numeroFactura}`,
            });
            cargarFacturas();
        } catch (error) {
            logger.error("Error al rectificar la factura:", error);
            setMensajeAlerta({
                tipo: "error",
                mensaje: error.response?.data?.error || "Hubo un problema al rectificar la factura.",
            });
        } finally {
            setMostrarModal(false);
        }
    };

    const anularFactura = async (facturaId) => {
        try {
            const { data } = await api.post(`/facturas/anular/${facturaId}`);
            setMensajeAlerta({
                tipo: "exito",
                mensaje: `Factura anulada correctamente: Nº ${data.numeroFactura}`,
            });
            cargarFacturas();
        } catch (error) {
            setMensajeAlerta({
                tipo: "error",
                mensaje: error.response?.data?.error || "Hubo un problema al anular la factura.",
            });
        }
    };

    const verXML = (xml) => {
        const nuevaVentana = window.open("", "_blank");
        nuevaVentana.document.write(
            `<pre style="white-space: pre-wrap; word-wrap: break-word;">${xml}</pre>`
        );
        nuevaVentana.document.close();
    };

    // --- Helpers ---
    const normaliza = (s) => (s || "").toString().toLowerCase();
    const facturasFiltradas = facturas.filter((f) => {
        const anioOk =
            !filtroAnio ||
            (f.fechaExpedicion &&
                new Date(f.fechaExpedicion).getFullYear().toString() === filtroAnio);

        const q = normaliza(busqueda);
        const textoOk =
            !q ||
            normaliza(f.numeroFactura).includes(q) ||
            normaliza(f.clienteNIF).includes(q) ||
            normaliza(f.hash ?? f.hashFactura).includes(q) ||
            normaliza(f.hashAnterior).includes(q);

        return anioOk && textoOk;
    });

    const exportarCSV = () => {
        const csv = Papa.unparse(
            facturasFiltradas.map((f) => ({
                numeroFactura: f.numeroFactura,
                fechaExpedicion: new Date(f.fechaExpedicion).toLocaleString(),
                clienteNombre: f.clienteNombre,
                clienteNIF: f.clienteNIF,
                importeTotal: f.importeTotal,
                hash: f.hash ?? f.hashFactura,
            }))
        );

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "facturas.csv";
        link.click();
    };

    const exportarPDF = () => {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.text("Facturas Encadenadas", 14, 20);

        facturasFiltradas.forEach((f, index) => {
            const startY = 30 + index * 60;
            doc.text(`Número: ${f.numeroFactura}`, 14, startY);
            doc.text(`Fecha: ${new Date(f.fechaExpedicion).toLocaleString("es-ES")}`, 14, startY + 6);
            doc.text(`Cliente: ${f.clienteNombre || "-"}`, 14, startY + 12);
            doc.text(`NIF: ${f.clienteNIF || "-"}`, 14, startY + 18);
            doc.text(`Importe: ${f.importeTotal} €`, 14, startY + 24);
            doc.text(`Hash: ${f.hash}`, 14, startY + 30);

            autoTable(doc, {
                startY: startY + 36,
                head: [["Producto", "Cantidad", "Precio"]],
                body: (Array.isArray(f.productos) ? f.productos : []).map((p) => [
                    p.nombre,
                    String(p.cantidad ?? ""),
                    (typeof p.precio === "number" ? p.precio.toFixed(2) : ""),
                ]),
                styles: { fontSize: 7 },
                margin: { left: 14, right: 14 },
            });
        });

        doc.save("facturas.pdf");
    };

    return (
        <div className="facturas-page">
            <h1>Visor de Facturas Encadenadas</h1>

            {/* Filtros */}
            <div className="filtros-facturas">
                <label>Año:&nbsp;</label>
                <input
                    type="number"
                    value={filtroAnio}
                    onChange={(e) => setFiltroAnio(e.target.value)}
                    placeholder="Ej: 2025"
                />

                <label>Buscar:&nbsp;</label>
                <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar número, NIF o hash..."
                />
            </div>

            {/* Acciones exportar */}
            <div className="acciones-facturas">
                <button onClick={exportarCSV}>Exportar CSV</button>
                <button onClick={exportarPDF}>Exportar PDF</button>
            </div>

            {/* Tabla */}
            <table className="facturas-table">
                <thead>
                    <tr>
                        <th>Número</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>NIF</th>
                        <th>Importe</th>
                        <th>Hash</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {facturasFiltradas.map((f) => (
                        <tr key={f._id}>
                            <td>{f.numeroFactura}</td>
                            <td>{new Date(f.fechaExpedicion).toLocaleString("es-ES")}</td>
                            <td>{f.clienteNombre || "-"}</td>
                            <td>{f.clienteNIF || "-"}</td>
                            <td>{f.importeTotal} €</td>
                            <td style={{ wordBreak: "break-word" }}>{f.hash}</td>
                            <td>
                                <div className="acciones-factura">
                                    <button onClick={() => abrirModalRectificacion(f._id)}>Rectificar</button>
                                    <button onClick={() => anularFactura(f._id)}>Anular</button>
                                    <button onClick={() => verXML(f.xmlFirmado)}>Ver XML</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Modal rectificación */}
            {/* Modal rectificación */}
            {mostrarModal && (
                <div className="modal-overlay">
                    <div className="modal-contenido">
                        <h2>Rectificar Factura</h2>

                        <label>Tipo:</label>
                        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                            <option value="">-- Selecciona --</option>
                            <option value="R1">R1 – Sustitución</option>
                            <option value="R2">R2 – Diferencias</option>
                            <option value="R3">R3 – Devolución de bienes/envases</option>
                            <option value="R4">R4 – Descuentos posteriores</option>
                            <option value="R5">R5 – Simplificada</option>
                        </select>

                        {/* 👇 Segundo select solo si es R1 o R2 */}
                        {["R1", "R2"].includes(tipo) && (
                            <>
                                <label>Subtipo:</label>
                                <select value={subtipo} onChange={(e) => setSubtipo(e.target.value)}>
                                    <option value="">-- Selecciona --</option>
                                    <option value="S">S – Sustitución</option>
                                    <option value="I">I – Diferencias</option>
                                </select>
                            </>
                        )}

                        <label>Nombre:</label>
                        <input
                            value={clienteNombre}
                            onChange={(e) => setClienteNombre(e.target.value)}
                        />

                        <label>NIF:</label>
                        <input
                            value={clienteNIF}
                            onChange={(e) => setClienteNIF(e.target.value)}
                        />

                        <label>Importe:</label>
                        <input
                            type="number"
                            step="0.01"
                            value={importeTotal}
                            onChange={(e) => setImporteTotal(e.target.value)}
                        />

                        <label>Motivo:</label>
                        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />

                        <div className="modal-botones">
                            <button onClick={() => setMostrarModal(false)}>Cancelar</button>
                            <button
                                onClick={confirmarRectificacion}
                                disabled={!tipo || (["R1", "R2"].includes(tipo) && !subtipo)}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerta */}
            {mensajeAlerta && (
                <AlertaMensaje
                    tipo={mensajeAlerta.tipo}
                    mensaje={mensajeAlerta.mensaje}
                    onClose={() => setMensajeAlerta(null)}
                />
            )}
        </div>
    );
};

export default FacturasPage;
