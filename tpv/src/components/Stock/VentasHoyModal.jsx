// src/components/Stock/VentasHoyModal.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../utils/api";
import "./VentasHoyModal.css";

const VentasHoyModal = ({ onClose }) => {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({ items: [], totales: { cantidad: 0, ingresos: 0 } });
  const [tab, setTab] = useState("plato"); // 'plato' | 'bebida'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get("/reportes/ventas-hoy");
        setData(data);
      } catch (e) {
        setError("No se pudo cargar el reporte de hoy.");
      } finally {
        setCargando(false);
      }
    };
    fetchData();
  }, []);

  const platos = useMemo(() => data.items.filter((it) => it.tipo === "plato"), [data.items]);
  const bebidas = useMemo(() => data.items.filter((it) => it.tipo !== "plato"), [data.items]);
  const visible = tab === "plato" ? platos : bebidas;

  const renderTabla = (items) => (
    <div className="ventas-modal__tabla">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Vendidas</th>
            <th>Stock actual</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((it) => (
              <tr key={it.productoId}>
                <td>{it.nombre}</td>
                <td>{it.categoria}</td>
                <td>{it.cantidad}</td>
                <td>{it.stockActual}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" style={{ textAlign: "center" }}>
                {tab === "plato" ? "Sin ventas de platos hoy" : "Sin ventas de bebidas hoy"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="ventas-modal__overlay" onClick={onClose}>
      <div className="ventas-modal__content" onClick={(e) => e.stopPropagation()}>
        <div className="ventas-modal__header">
          <button className="ventas-modal__close" onClick={onClose}>✕</button>
        </div>
        {cargando ? (
          <p className="mensaje-carga--cerrar-caja">Cargando…</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <>
            {/* Botones de pestañas */}
            <div className="ventas-modal__tabs">
              <button
                className={`ventas-tab ${tab === "plato" ? "active" : ""}`}
                onClick={() => setTab("plato")}
              >
                Platos
              </button>
              <button
                className={`ventas-tab ${tab === "bebida" ? "active" : ""}`}
                onClick={() => setTab("bebida")}
              >
                Bebidas
              </button>
            </div>

            {/* Tabla visible según pestaña */}
            {renderTabla(visible)}
          </>
        )}
      </div>
    </div>
  );
};

export default VentasHoyModal;
