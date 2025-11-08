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

const Dashboard = () => {
  const [mesas, setMesas] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [accionModal, setAccionModal] = useState(null);
  const [valorInput, setValorInput] = useState("");
  const [alerta, setAlerta] = useState(null);
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);

  // Detectar tamaño
  useEffect(() => {
    fetchMesas(setMesas);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Socket
  useEffect(() => {
    if (!socket) return;
    const actualizarMesas = () => fetchMesas(setMesas);
    socket.on("mesaAbierta", actualizarMesas);
    return () => socket.off("mesaAbierta", actualizarMesas);
  }, [socket]);

  // 👉 Función para manejar toque corto (abrir)
  const handleMesaClick = (mesa) => {
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

  // 👉 Función para manejar long press (editar comensales)
  const handleLongPress = (mesa) => {
    setValorInput(mesa.comensales || "");
    setAccionModal({
      titulo: `Modificar comensales (Mesa ${mesa.numero})`,
      mensaje: "Introduce la nueva cantidad de comensales.",
      placeholder: "Cantidad de comensales",
      onConfirm: async (valor) => {
        const comensales = parseInt(valor, 10);
        if (isNaN(comensales) || comensales < 1 || comensales > 25) {
          setAlerta({
            tipo: "error",
            mensaje:
              "Por favor, introduce un número válido de comensales (mínimo 1, máximo 25).",
          });
          return;
        }
        try {
          await api.put(`/mesas/${mesa._id}/comensales`, { comensales });
          setAlerta({
            tipo: "exito",
            mensaje: `Mesa ${mesa.numero} actualizada a ${comensales} comensales.`,
          });
          fetchMesas(setMesas);
        } catch (err) {
          setAlerta({
            tipo: "error",
            mensaje: "Error al actualizar comensales.",
          });
        } finally {
          setMostrarModalConfirmacion(false);
        }
      },
    });
    setMostrarModalConfirmacion(true);
  };

  // Control de long press manual (200ms a 600ms)
  let pressTimer;
  const handlePressStart = (mesa) => {
    pressTimer = setTimeout(() => handleLongPress(mesa), 600);
  };
  const handlePressEnd = () => clearTimeout(pressTimer);

  const esValido =
    String(valorInput).trim() !== "" &&
    !isNaN(valorInput) &&
    parseInt(valorInput, 10) > 0;

  return (
    <>
      <div className="subnavbar--dashboard">
        <SubNavbar />
      </div>

      <div className="container--dashboard">
        <div className="dashboard--dashboard">
          {mesas.map((mesa) => (
            <div
              key={mesa._id}
              className={`mesa--dashboard ${mesa.estado}--dashboard`}
              onClick={() => handleMesaClick(mesa)}
              onTouchStart={() => handlePressStart(mesa)}
              onTouchEnd={handlePressEnd}
              onMouseDown={() => handlePressStart(mesa)}
              onMouseUp={handlePressEnd}
            >
              <p className="mesa-number--dashboard">{mesa.numero}</p>
            </div>
          ))}
        </div>
      </div>

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
