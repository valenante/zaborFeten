import React, { useEffect, useState, useRef } from "react";
import Draggable from "react-draggable";
import api from "../utils/api";
import EditarMesa from "../components/EditarMesa/EditarMesa";
import "../styles/MapaEditor.css";

export default function MapaEditor() {
  const [mesas, setMesas] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(true);
  const [zona, setZona] = useState("interior");
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const containerRef = useRef(null);
  let holdTimeout;

  useEffect(() => {
    cargarMesas();
  }, [zona]);

  const cargarMesas = async () => {
    try {
      const res = await api.get("/mesas");
      setMesas(res.data);
    } catch (err) {
      console.error("❌ Error al cargar mesas:", err);
    }
  };

  // 🧭 Detectar tamaño del contenedor en tiempo real
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      setContainerSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 🧮 Guardar posición proporcional
  const handleDragStop = async (e, data, mesa) => {
    if (!modoEdicion) return;
    const { width, height } = containerSize;
    const x = Math.max(0, Math.min(100, (data.x / width) * 100));
    const y = Math.max(0, Math.min(100, (data.y / height) * 100));

    try {
      await api.put(`/mesas/${mesa._id}/posicion`, { x, y });
      setMesas((prev) =>
        prev.map((m) =>
          m._id === mesa._id ? { ...m, posicion: { x, y } } : m
        )
      );
    } catch (err) {
      console.error("❌ Error al guardar posición:", err);
    }
  };

  // 🎯 Mantener pulsado para abrir edición
  const handleHoldStart = (mesa) => {
    holdTimeout = setTimeout(() => setMesaSeleccionada(mesa), 700);
  };
  const cancelHold = () => clearTimeout(holdTimeout);

  const guardarCambiosMesa = async (datos) => {
    try {
      await api.put(`/mesas/${mesaSeleccionada._id}`, datos);
      setMesaSeleccionada(null);
      cargarMesas();
    } catch (err) {
      console.error("❌ Error al guardar cambios:", err);
    }
  };

  const eliminarMesa = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta mesa?")) return;
    try {
      await api.delete(`/mesas/${id}`);
      setMesaSeleccionada(null);
      cargarMesas();
    } catch (err) {
      console.error("❌ Error al eliminar mesa:", err);
    }
  };

  const mesasVisibles = mesas.filter(
    (m) => m.zona === zona && m.zona !== "auxiliar"
  );
  const mesasAuxiliares = mesas.filter((m) => m.zona === "auxiliar");

  return (
    <div className="mapa-editor-container">
      {/* === Barra superior === */}
      <div className="toolbar-editor">
        <select value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="interior">Interior</option>
          <option value="exterior">Terraza</option>
        </select>
        <button onClick={() => setModoEdicion(!modoEdicion)}>
          {modoEdicion ? "Bloquear plano" : "Editar plano"}
        </button>
      </div>

      {/* === Mapa principal === */}
      <div className="mapa-editor-principal" ref={containerRef}>
        {mesasVisibles.map((mesa) => {
          const x = (mesa.posicion?.x / 100) * containerSize.width;
          const y = (mesa.posicion?.y / 100) * containerSize.height;
          return (
            <Draggable
              key={mesa._id}
              disabled={!modoEdicion}
              position={{ x, y }}
              onStart={() => handleHoldStart(mesa)}
              onDrag={cancelHold}
              onStop={(e, data) => handleDragStop(e, data, mesa)}
              onMouseUp={cancelHold}
              onTouchStart={() => handleHoldStart(mesa)}
              onTouchMove={cancelHold}
              onTouchEnd={cancelHold}
            >
              <div className="mesa-editor">{mesa.numero}</div>
            </Draggable>
          );
        })}
      </div>

      {/* === Barra lateral === */}
      <div className="sidebar-editor">
        <h3>Mesas Auxiliares</h3>
        <div className="sidebar-mesas-list">
          {mesasAuxiliares.map((mesa) => (
            <div
              key={mesa._id}
              className="mesa-sidebar"
              onClick={() => setMesaSeleccionada(mesa)}
            >
              {mesa.numero}
            </div>
          ))}
        </div>
      </div>

      {/* === Modal === */}
      {mesaSeleccionada && (
        <EditarMesa
          mesa={mesaSeleccionada}
          onClose={() => setMesaSeleccionada(null)}
          onSave={guardarCambiosMesa}
          onDelete={eliminarMesa}
        />
      )}
    </div>
  );
}
