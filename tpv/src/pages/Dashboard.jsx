import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import SubNavbar from "../components/Subnavbar/Subnavbar";
import ModalConfirmacion from "../components/Modal/ModalConfirmacion";
import AlertaMensaje from "../components/AlertaMensaje/AlertaMensaje";
import { SocketContext } from "../utils/socket";
import TPVVoice from "../components/TPVVoiceAssistant/TPVVoice";
import "../styles/Dashboard.css";
import { fetchMesas, abrirMesaConModal } from "../utils/mesaHandlers";

const Dashboard = () => {
  const [mesas, setMesas] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [accionModal, setAccionModal] = useState(null);
  const [valorInput, setValorInput] = useState("");
  const [alerta, setAlerta] = useState(null); // 👈 Estado para mostrar el mensaje de error

  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    fetchMesas(setMesas);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const actualizarMesas = () => fetchMesas(setMesas);
    socket.on("mesaAbierta", actualizarMesas);

    return () => socket.off("mesaAbierta", actualizarMesas);
  }, [socket]);

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
              mensaje: "Por favor, introduce un número válido de comensales (mínimo 1, máximo 25).",
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

  const esValido = valorInput.trim() !== "" && !isNaN(valorInput) && parseInt(valorInput, 10) > 0;

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

      {/* 🔔 Alerta flotante si hay error */}
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
