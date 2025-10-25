import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import PasswordModal from "../Password/PasswordModal";
import CerrarCajaModal from "../Caja/CerrarCajaModal";
import * as logger from '../../utils/logger';
import VentasHoyModal from "../Stock/VentasHoyModal";
import { useAuth } from "../../context/AuthContext";
import "./Subnavbar.css";

const SubNavbar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth(); // Obtiene la función logout del contexto
  const [mostrarModal, setMostrarModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false); // Estado para el menú hamburguesa
  const [cajaAbierta, setCajaAbierta] = useState(false); // Estado para verificar si la caja está abierta
  const [mostrarVentasHoy, setMostrarVentasHoy] = useState(false);

  const toggleMenu = () => {
    setMenuAbierto((prevState) => !prevState);
  };

  useEffect(() => {
    const verificarCaja = async () => {
      try {
        const { data } = await api.get("/caja/abierta");
        setCajaAbierta(data.abierta); // data.abierta true/false
      } catch (error) {
        logger.error("Error al verificar caja abierta:", error);
        setCajaAbierta(false);
      }
    };

    verificarCaja();
  }, []);

  return (
    <div className="subnavbar--subnavbar">
      <div className="subnavbar-header--subnavbar">
        <button
          className="hamburger-button--subnavbar"
          onClick={toggleMenu}
        >
          ☰
        </button>
      </div>

      <div
        className={`subnavbar-menu--subnavbar ${menuAbierto ? "open--subnavbar" : "closed--subnavbar"
          }`}
      >
        <button
          onClick={() => navigate("/mesas-cerradas")}
          className="subnavbar-button--subnavbar"
        >
          Mesas
        </button>
        <button
          onClick={() => { setMostrarVentasHoy(true); setMenuAbierto(false); }}
          className="subnavbar-button--subnavbar"
        >
          Stock
        </button>
        <button onClick={logout} className="subnavbar-button--subnavbar">
          Cerrar Sesión
        </button>
      </div>

      {mostrarVentasHoy && <VentasHoyModal onClose={() => setMostrarVentasHoy(false)} />}
      {showModal && <CerrarCajaModal onClose={() => setShowModal(false)} />}
      {mostrarModal && <PasswordModal onClose={() => setMostrarModal(false)} />}
    </div>
  );
};

export default SubNavbar;
