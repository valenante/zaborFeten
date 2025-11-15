import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useMesaActions } from "../hooks/useMesaActions";
import SubNavbar from "../components/Subnavbar/Subnavbar";
import ModalConfirmacion from "../components/Modal/ModalConfirmacion";
import AlertaMensaje from "../components/AlertaMensaje/AlertaMensaje";
import { SocketContext } from "../utils/socket";
import TPVVoice from "../components/TPVVoiceAssistant/TPVVoice";
import "../styles/Dashboard.css";
import { fetchMesas, abrirMesaConModal } from "../utils/mesaHandlers";
import api from "../utils/api";

let holdTimeout;

const Dashboard = () => {
  const [mesas, setMesas] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [accionModal, setAccionModal] = useState(null);
  const [valorInput, setValorInput] = useState("");
  const [alerta, setAlerta] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [zona, setZona] = useState("exterior");
  const [valorModal, setValorModal] = useState("");
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);

  // Hook centralizado SOLO para modificar comensales
  const mesaActions = useMesaActions({
    setMesas,
    setMensajeAlerta: setAlerta,
    fetchMesa: () => fetchMesas(setMesas),
    allowedActions: ["comensales"],
  });

  // === Cargar mesas al inicio ===
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
        prev.map((m) =>
          m._id === mesaId ? { ...m, cuentaImpresa: true } : m
        )
      );
    });

    return () => {
      socket.off("mesaAbierta", actualizarMesas);
      socket.off("cuentaImpresa");
    };
  }, [socket]);

  // === Entrada móvil ===
  const manejarEntradaMesa = async () => {
    const numero = parseInt(valorInput, 10);

    if (isNaN(numero) || numero <= 0) {
      setAlerta({ tipo: "error", mensaje: "Introduce un número válido." });
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
          mensaje: "Introduce los comensales:",
          placeholder: "Cantidad de comensales",
          onConfirm: (valor) => {
            const comensales = parseInt(valor, 10);
            if (isNaN(comensales) || comensales < 1 || comensales > 25) {
              setAlerta({
                tipo: "error",
                mensaje: "Número inválido (1–25).",
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
      setAlerta({ tipo: "error", mensaje: "Error al buscar mesa." });
    }
  };

  // === Click en escritorio ===
  const handleMesaClick = (mesa) => {
    if (modoEdicion) return;

    if (mesa.estado === "cerrada") {
      setAccionModal({
        titulo: `Abrir mesa ${mesa.numero}`,
        mensaje: "Introduce los comensales:",
        placeholder: "Cantidad de comensales",
        onConfirm: (valor) => {
          const comensales = parseInt(valor, 10);
          if (isNaN(comensales) || comensales < 1 || comensales > 25) {
            setAlerta({
              tipo: "error",
              mensaje: "Número inválido (1–25).",
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

  // === Long press → modificar comensales ===
  const handleMouseDown = (mesa) => {
    if (modoEdicion) return;

    holdTimeout = setTimeout(() => {
      mesaActions.handleSelect("comensales", mesa); // 🔥 abre modal centralizado
    }, 700);
  };

  const handleMouseUp = () => clearTimeout(holdTimeout);

  // === Filtrar mesas por zona ===
  const mesasFiltradas = mesas.filter((m) => m.zona === zona);

  const esValido =
    valorInput.trim() !== "" &&
    !isNaN(valorInput) &&
    parseInt(valorInput, 10) > 0;

  return (
    <>
      <div className="subnavbar--dashboard">
        <SubNavbar />
      </div>

      <div className="container--dashboard">
        {isMobile ? (
          <div className="search-container--dashboard">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input-mesa--dashboard"
              placeholder="Ej: 5"
              value={valorInput}
              onChange={(e) =>
                setValorInput(e.target.value.replace(/\D/g, ""))
              }
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

                  {mesa.total > 0 && (
                    <p className="mesa-total--dashboard">
                      {mesa.total.toFixed(2)} €
                    </p>
                  )}
                </div>
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
                      onMouseDown={() => handleMouseDown(mesa)}
                      onMouseUp={handleMouseUp}
                    >
                      <p className="mesa-number--dashboard">{mesa.numero}</p>

                      {mesa.total > 0 && (
                        <p className="mesa-total--dashboard">
                          {mesa.total.toFixed(2)} €
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* === MODAL ABRIR MESA === */}
      {mostrarModalConfirmacion && (
        <ModalConfirmacion
          titulo={accionModal?.titulo}
          mensaje={accionModal?.mensaje}
          placeholder={accionModal?.placeholder}
          onConfirm={(valor) => {
            accionModal?.onConfirm(valor);
            setMostrarModalConfirmacion(false);
          }}
          onClose={() => setMostrarModalConfirmacion(false)}
        />
      )}

      {/* === MODAL EDITAR COMENSALES (LONG PRESS) === */}
      {mesaActions.mostrarModalAccion && (
        <ModalConfirmacion
          titulo={mesaActions.accionModal?.titulo}
          mensaje={mesaActions.accionModal?.mensaje}
          placeholder={mesaActions.accionModal?.placeholder}
          onConfirm={(valor) => {
            mesaActions.accionModal?.onConfirm(valor);
            mesaActions.setMostrarModalAccion(false);
          }}
          onClose={() => mesaActions.setMostrarModalAccion(false)}
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
