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
  const [valorModal, setValorModal] = useState(""); // 🔹 valor del input del modal activo
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

  let holdTimeout;

  const handleMouseDown = (mesa) => {
    if (modoEdicion) return;
    holdTimeout = setTimeout(() => {
      setValorModal(""); // 🔹 reiniciar input
      setAccionModal({
        titulo: `Editar comensales - Mesa ${mesa.numero}`,
        mensaje: "Introduce el nuevo número de comensales:",
        placeholder: "Cantidad de comensales",
        onConfirm: async (valor) => {
          const comensales = parseInt(valor, 10);
          if (isNaN(comensales) || comensales < 1 || comensales > 25) {
            setAlerta({
              tipo: "error",
              mensaje: "Número de comensales inválido (1–25).",
            });
            return;
          }

          try {
            await api.put(`/mesas/${mesa._id}/comensales`, { comensales });
            setAlerta({
              tipo: "exito",
              mensaje: `Mesa ${mesa.numero}: ${comensales} comensales.`,
            });

            setMesas((prev) =>
              prev.map((m) =>
                m._id === mesa._id ? { ...m, comensales } : m
              )
            );
          } catch (err) {
            setAlerta({
              tipo: "error",
              mensaje: "Error al actualizar comensales.",
            });
          }
        },
      });
      setMostrarModalConfirmacion(true);
    }, 700);
  };

  const handleMouseUp = () => clearTimeout(holdTimeout);

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
                <div
                  key={mesa._id}
                  className={`mesa--dashboard ${mesa.estado}--dashboard ${mesa.cuentaImpresa ? "cuenta-impresa" : ""
                    }`}
                  style={{
                    position: "absolute",
                    left: `${mesa.posicion?.x || 0}%`,
                    top: `${mesa.posicion?.y || 0}%`,
                    cursor: modoEdicion ? "default" : "pointer",
                    transform: "translate(-50%, -50%)",
                  }}
                  onClick={() => handleMesaClick(mesa)}
                  onMouseDown={() => handleMouseDown(mesa)}
                  onMouseUp={handleMouseUp}
                >
                  <p className="mesa-number--dashboard">{mesa.numero}</p>
                </div>
              ))}
            </div>

            {/* Sidebar de mesas auxiliares */}
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
                      onMouseDown={() => handleMouseDown(mesa)}
                      onMouseUp={handleMouseUp}
                    >
                      {mesa.numero}
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* === MODALES Y ALERTAS === */}
      {mostrarModalConfirmacion && (
        <ModalConfirmacion
          titulo={accionModal?.titulo}
          mensaje={accionModal?.mensaje}
          placeholder={accionModal?.placeholder}
          value={valorModal}
          onChange={(e) => setValorModal(e.target.value)}  // 🔹 ahora usamos valorModal
          onConfirm={() => accionModal?.onConfirm(valorModal)} // 🔹 y aquí también
          onClose={() => setMostrarModalConfirmacion(false)}
          disabledConfirm={
            valorModal.trim() === "" || isNaN(valorModal) || parseInt(valorModal, 10) < 1
          }
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
