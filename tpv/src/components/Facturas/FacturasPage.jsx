import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as logger from "../../utils/logger";
import AlertaMensaje from "../AlertaMensaje/AlertaMensaje";
import ModalConfirmacion from "../Modal/ModalConfirmacion";
import "./FacturasPage.css";

const FacturasPage = () => {
    const [facturas, setFacturas] = useState([]);
    const [filtroAnio, setFiltroAnio] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [mensajeAlerta, setMensajeAlerta] = useState(null);
    const [subtipo, setSubtipo] = useState(""); // S o I
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaFin, setFechaFin] = useState("");
    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
    const [facturaAAnular, setFacturaAAnular] = useState(null);

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

    const verXML = (xml, tipo = "firmado") => {
        if (!xml) {
            setMensajeAlerta({
                tipo: "error",
                mensaje: "No hay XML disponible para esta factura.",
            });
            return;
        }

        const contenidoLimpio = xml
            .replaceAll("\\n", "\n")
            .replaceAll("\\t", "\t")
            .replaceAll('\\"', '"');

        // --- Formatear XML con sangría ---
        const formatXML = (xmlString) => {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlString, "application/xml");
                const xs = new XMLSerializer();
                const serialized = xs.serializeToString(xmlDoc);
                const PADDING = "  ";
                let formatted = "";
                let pad = 0;
                serialized.replace(/(>)(<)(\/*)/g, "$1\n$2$3").split("\n").forEach((node) => {
                    if (node.match(/^<\/\w/)) pad -= 1;
                    formatted += PADDING.repeat(pad) + node + "\n";
                    if (node.match(/^<\w[^>]*[^/]>.*$/)) pad += 1;
                });
                return formatted.trim();
            } catch (err) {
                return xmlString;
            }
        };

        const xmlPretty = formatXML(contenidoLimpio);

        // --- Resaltado de sintaxis XML ---
        const highlightXML = (xmlStr) =>
            xmlStr
                .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="comment">$1</span>')
                .replace(/(&lt;[?].*?[?]&gt;)/g, '<span class="declaration">$1</span>')
                .replace(/(&lt;\/?[^\s>]+)(.*?)(\/?&gt;)/g, (match, tag, attrs, end) => {
                    const attrsColored = attrs.replace(
                        /(\w+)="(.*?)"/g,
                        '<span class="attr">$1</span>=<span class="value">"$2"</span>'
                    );
                    return `<span class="tag">${tag}</span>${attrsColored}<span class="tag">${end}</span>`;
                });

        const xmlHTML = highlightXML(
            xmlPretty
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
        );

        const nuevaVentana = window.open("", "_blank");
        nuevaVentana.document.write(`
    <html>
      <head>
        <title>${tipo === "respuesta" ? "Respuesta AEAT" : "XML Firmado"}</title>
        <style>
          body {
            font-family: 'Fira Code', Consolas, monospace;
            background-color: #1e1e1e;
            color: #dcdcdc;
            padding: 16px;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.4em;
            font-size: 13px;
          }
          .tag { color: #569CD6; }
          .attr { color: #9CDCFE; }
          .value { color: #CE9178; }
          .comment { color: #6A9955; font-style: italic; }
          .declaration { color: #C586C0; }
          h2 {
            font-weight: normal;
            color: #fff;
            border-bottom: 1px solid #444;
            padding-bottom: 6px;
            margin-bottom: 12px;
          }
          button {
            background: #0e639c;
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
          }
          button:hover { background: #1177bb; }
        </style>
      </head>
      <body>
        <h2>${tipo === "respuesta" ? "Respuesta AEAT" : "XML Firmado"}</h2>
        <button onclick="window.print()">Imprimir</button>
        <button onclick="window.close()">Cerrar</button>
        <pre>${xmlHTML}</pre>
      </body>
    </html>
  `);
        nuevaVentana.document.close();
    };

    // --- Helpers ---
    const normaliza = (s) => (s || "").toString().toLowerCase();
    const facturasFiltradas = facturas.filter((f) => {
        const fechaFactura = new Date(f.fechaExpedicion);

        const enRango =
            (!fechaInicio || fechaFactura >= new Date(fechaInicio)) &&
            (!fechaFin || fechaFactura <= new Date(fechaFin + "T23:59:59"));

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

        return enRango && anioOk && textoOk;
    });

    // --- Exportar CSV profesional ---
    const exportarCSV = () => {
        const csv = Papa.unparse(
            facturasFiltradas.map((f) => ({
                "Número factura": f.numeroFactura,
                "Fecha emisión": new Date(f.fechaExpedicion).toLocaleString("es-ES"),
                "Cliente": f.clienteNombre || "-",
                "NIF": f.clienteNIF || "-",
                "Importe total (€)": f.importeTotal?.toFixed(2),
                "Estado": f.estado || "-",
                "Hash": f.hash ?? f.hashFactura,
            }))
        );

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `facturas_${fechaInicio || "todo"}_${fechaFin || "todo"}.csv`;
        link.click();
    };

    const exportarPDF = () => {
        const doc = new jsPDF({ orientation: "landscape" });

        // Encabezado
        doc.setFontSize(14);
        doc.text("Facturas Encadenadas", 14, 15);
        doc.setFontSize(10);
        doc.text(`Exportado: ${new Date().toLocaleString("es-ES")}`, 14, 22);
        if (fechaInicio || fechaFin) {
            doc.text(
                `Rango: ${fechaInicio || "—"} a ${fechaFin || "—"}`,
                14,
                28
            );
        }

        // Tabla
        autoTable(doc, {
            startY: fechaInicio || fechaFin ? 34 : 28,
            head: [["Número", "Fecha", "Cliente", "NIF", "Importe (€)", "Estado", "Hash"]],
            body: facturasFiltradas.map((f) => [
                f.numeroFactura,
                new Date(f.fechaExpedicion).toLocaleString("es-ES"),
                f.clienteNombre || "-",
                f.clienteNIF || "-",
                f.importeTotal?.toFixed(2),
                f.estado || "-",
                f.hash ?? f.hashFactura,
            ]),
            styles: { fontSize: 8, cellWidth: "wrap" },
            headStyles: { fillColor: [41, 128, 185] }, // azul elegante
            margin: { left: 14, right: 14 },
            didDrawPage: (data) => {
                doc.setFontSize(8);
                doc.text(
                    `Página ${doc.internal.getNumberOfPages()}`,
                    data.settings.margin.left,
                    doc.internal.pageSize.height - 5
                );
            },
        });

        doc.save(`facturas_${fechaInicio || "todo"}_${fechaFin || "todo"}.pdf`);
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

                <label>Desde:&nbsp;</label>
                <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                />

                <label>Hasta:&nbsp;</label>
                <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
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
                        <th>Estado</th> {/* 👈 Nueva columna al inicio */}
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
                            <td>
                                <span
                                    className={`estado ${f.estado}`}
                                    style={{
                                        color: f.estado === "correcto" ? "green" :
                                            f.estado === "enviado" ? "orange" :
                                                f.estado === "incorrecto" ? "red" : "black",
                                        fontWeight: "bold",
                                    }}
                                >
                                    {f.estado || "—"}
                                </span>
                            </td>
                            <td>{f.numeroFactura}</td>
                            <td>{new Date(f.fechaExpedicion).toLocaleString("es-ES")}</td>
                            <td>{f.clienteNombre || "-"}</td>
                            <td>{f.clienteNIF || "-"}</td>
                            <td>{f.importeTotal} €</td>
                            <td style={{ wordBreak: "break-word" }}>{f.hash}</td>
                            <td>
                                <div className="acciones-factura">
                                    <button onClick={() => abrirModalRectificacion(f._id)}>Rectificar</button>

                                    {/* 👇 Oculta el botón si la factura ya está anulada */}
                                    {f.estado !== "anulada" && (
                                        <button onClick={() => {
                                            setFacturaAAnular(f._id);
                                            setMostrarConfirmacion(true);
                                        }}>
                                            Anular
                                        </button>
                                    )}

                                    <button onClick={() => verXML(f.xmlFirmado)}>Ver XML</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

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

            {mostrarConfirmacion && (
                <ModalConfirmacion
                    titulo="Confirmar anulación"
                    mensaje="¿Seguro que desea anular esta factura? Esta acción no se puede deshacer."
                    onConfirm={() => {
                        anularFactura(facturaAAnular);
                        setMostrarConfirmacion(false);
                    }}
                    onClose={() => setMostrarConfirmacion(false)}
                />
            )}
        </div>
    );
};

export default FacturasPage;
