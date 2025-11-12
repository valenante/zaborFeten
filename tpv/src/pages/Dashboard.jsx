import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import SubNavbar from "../components/Subnavbar/Subnavbar";
import ModalConfirmacion from "../components/Modal/ModalConfirmacion";
import AlertaMensaje from "../components/AlertaMensaje/AlertaMensaje";
import { SocketContext } from "../utils/socket";
import TPVVoice from "../components/TPVVoiceAssistant/TPVVoice";
import "../styles/Dashboard.css";
import { fetchMesas, abrirMesaConModal } from "../utils/mesaHandlers";
import api from "../utils/api";
import Draggable from "react-draggable";

const Dashboard = () => {
  const [mesas, setMesas] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [accionModal, setAccionModal] = useState(null);
  const [valorInput, setValorInput] = useState("");
  const [alerta, setAlerta] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [zona, setZona] = useState("exterior"); // 🟣 nueva: selector de zona
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // === Cargar mesas ===
  useEffect(() => {
    fetchMesas(setMesas);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // === Sockets ===
  useEffect(() => {
    if (!socket) return;

    const actualizarMesas = () => fetchMesas(setMesas);
    socket.on("mesaAbierta", actualizarMesas);
    socket.on("cuentaImpresa", ({ mesaId }) => {
      setMesas((prev) =>
        prev.map((m) => (m._id === mesaId ? { ...m, cuentaImpresa: true } : m))
      );
    });

    return () => {
      socket.off("mesaAbierta", actualizarMesas);
      socket.off("cuentaImpresa");
    };
  }, [socket]);

  // === Guardar posición al soltar ===
  const handleDragStop = async (e, data, mesa) => {
    if (!modoEdicion) return;
    try {
      const container = e.target.closest(".mapa-restaurante");
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;

      // Calcular posición relativa (%)
      const xPorcentaje = (data.x / containerWidth) * 100;
      const yPorcentaje = (data.y / containerHeight) * 100;

      await api.put(`/mesas/${mesa._id}/posicion`, { x: xPorcentaje, y: yPorcentaje });

      setMesas((prev) =>
        prev.map((m) =>
          m._id === mesa._id
            ? { ...m, posicion: { x: xPorcentaje, y: yPorcentaje } }
            : m
        )
      );
    } catch (err) {
      console.error("❌ Error al guardar posición:", err);
      setAlerta({
        tipo: "error",
        mensaje: "No se pudo guardar la nueva posición de la mesa.",
      });
    }
  };

  // === Abrir o navegar según estado ===
  const manejarEntradaMesa = async () => {
    const numero = parseInt(valorInput, 10);
    if (isNaN(numero) || numero <= 0) {
      setAlerta({ tipo: "error", mensaje: "Introduce un número de mesa válido." });
      return;
    }

    try {
      const res = await api.get("/mesas");
      const mesa = res.data.find((m) => m.numero === numero);

      if (!mesa) {
        setAlerta({ tipo: "error", mensaje: `La mesa ${numero} no existe.` });
        return;
      }

      if (mesa.estado === "cerrada") {
        setAccionModal({
          titulo: `Abrir mesa ${mesa.numero}`,
          mensaje: "Introduce la cantidad de comensales antes de abrir la mesa.",
          placeholder: "Cantidad de comensales",
          onConfirm: (valor) => {
            const comensales = parseInt(valor, 10);
            if (isNaN(comensales) || comensales < 1 || comensales > 25) {
              setAlerta({
                tipo: "error",
                mensaje:
                  "Por favor, introduce un número válido de comensales (mínimo 1, máximo 25).",
              });
              return;
            }

            abrirMesaConModal(
              { ...mesa, comensales },
              setAccionModal,
              setMesaSeleccionada,
              setMostrarModalConfirmacion,
              () => fetchMesas(setMesas),
              navigate
            );
          },
        });
        setMostrarModalConfirmacion(true);
      } else {
        navigate(`/mesas/${mesa._id}`);
      }
    } catch (err) {
      setAlerta({ tipo: "error", mensaje: "Error al buscar la mesa." });
    }
  };

  // === Click normal en escritorio ===
  const handleMesaClick = (mesa) => {
    if (modoEdicion) return;

    if (mesa.estado === "cerrada") {
      setValorInput("");
      setAccionModal({
        titulo: `Abrir mesa ${mesa.numero}`,
        mensaje: "Introduce la cantidad de comensales antes de abrir la mesa.",
        placeholder: "Cantidad de comensales",
        onConfirm: (valor) => {
          const comensales = parseInt(valor, 10);
          if (isNaN(comensales) || comensales < 1 || comensales > 25) {
            setAlerta({
              tipo: "error",
              mensaje:
                "Por favor, introduce un número válido de comensales (mínimo 1, máximo 25).",
            });
            return;
          }

          abrirMesaConModal(
            { ...mesa, comensales },
            setAccionModal,
            setMesaSeleccionada,
            setMostrarModalConfirmacion,
            () => fetchMesas(setMesas),
            navigate
          );
        },
      });
      setMostrarModalConfirmacion(true);
    } else {
      navigate(`/mesas/${mesa._id}`);
    }
  };

  // === Filtrar mesas visibles por zona ===
  const mesasFiltradas = mesas.filter((m) => m.zona === zona);

  const esValido =
    String(valorInput).trim() !== "" &&
    !isNaN(valorInput) &&
    parseInt(valorInput, 10) > 0;

  useEffect(() => {
    const contenedor = document.querySelector(".mapa-restaurante");
    if (contenedor) {
      const resizeObserver = new ResizeObserver(() => {
        setContainerWidth(contenedor.offsetWidth);
        setContainerHeight(contenedor.offsetHeight);
      });
      resizeObserver.observe(contenedor);
      return () => resizeObserver.disconnect();
    }
  }, []);

  return (
    <>
      <div className="subnavbar--dashboard">
        <SubNavbar />
      </div>

      <div className="container--dashboard">
        {isMobile ? (
          // === VERSIÓN MÓVIL ===
          <div className="search-container--dashboard">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input-mesa--dashboard"
              placeholder="Ej: 5"
              value={valorInput}
              onChange={(e) => {
                const soloNumeros = e.target.value.replace(/\D/g, "");
                setValorInput(soloNumeros);
              }}
            />
            <button
              onClick={manejarEntradaMesa}
              disabled={!esValido}
              className="boton-ok--dashboard"
            >
              Entrar
            </button>
          </div>
        ) : (
          // === VERSIÓN ESCRITORIO: MODO MAPA ===
          <>
            <div className="mapa-restaurante">
              <div className="mapa-toolbar">
                <select
                  className="selector-zona"
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                >
                  <option value="interior">Interior</option>
                  <option value="exterior">Terraza</option>
                </select>
              </div>

              {mesasFiltradas.map((mesa) => (
                <Draggable
                  key={mesa._id}
                  disabled={!modoEdicion}
                  position={{
                    x: (mesa.posicion?.x / 100) * containerWidth,
                    y: (mesa.posicion?.y / 100) * containerHeight,
                  }}
                  onStop={(e, data) => handleDragStop(e, data, mesa)}
                >
                  <div
                    className={`mesa--dashboard ${mesa.estado}--dashboard ${mesa.cuentaImpresa ? "cuenta-impresa" : ""
                      }`}
                    style={{
                      position: "absolute",
                      cursor: modoEdicion ? "move" : "pointer",
                    }}
                    onClick={() => handleMesaClick(mesa)}
                  >
                    <p className="mesa-number--dashboard">{mesa.numero}</p>
                  </div>
                </Draggable>
              ))}
            </div>
            <div className="sidebar-editor">
              <h3>Mesas Auxiliares</h3>
              <div className="sidebar-mesas-list">
                {mesas
                  .filter((m) => m.zona === "auxiliar")
                  .map((mesa) => (
                    <div
                      key={mesa._id}
                      className="mesa-sidebar"
                      onClick={() => handleMesaClick(mesa)}
                      style={{ cursor: modoEdicion ? "default" : "pointer" }}
                    >
                      {mesa.numero}
                    </div>
                  ))}
              </div>
            </div></>
        )}
      </div>

      {/* === MODALES Y ALERTAS === */}
      {mostrarModalConfirmacion && (
        <ModalConfirmacion
          titulo={accionModal?.titulo}
          mensaje={accionModal?.mensaje}
          placeholder={accionModal?.placeholder}
          value={valorInput}
          onChange={(e) => setValorInput(e.target.value)}
          onConfirm={() => accionModal?.onConfirm(valorInput)}
          onClose={() => setMostrarModalConfirmacion(false)}
          disabledConfirm={!esValido}
        />
      )}

      {alerta && (
        <AlertaMensaje
          tipo={alerta.tipo}
          mensaje={alerta.mensaje}
          onClose={() => setAlerta(null)}
        />
      )}

      <TPVVoice />
    </>
  );
};

export default Dashboard;
