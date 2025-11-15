import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import * as logger from '../../utils/logger';

import PasswordModal from "../Password/PasswordModal";
import CerrarCajaModal from "../Caja/CerrarCajaModal";
import VentasHoyModal from "../Stock/VentasHoyModal";
import ModalTotalMesas from "../Modal/ModalTotalMesas";

import "./Subnavbar.css";

const SubNavbar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mostrarVentasHoy, setMostrarVentasHoy] = useState(false);

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cajaAbierta, setCajaAbierta] = useState(false);

  // ➕ nuevo estado
  const [mostrarTotalMesas, setMostrarTotalMesas] = useState(false);
  const [totalMesas, setTotalMesas] = useState(0);

  const toggleMenu = () => setMenuAbierto((prev) => !prev);

  useEffect(() => {
    const verificarCaja = async () => {
      try {
        const { data } = await api.get("/caja/abierta");
        setCajaAbierta(data.abierta);
      } catch (error) {
        logger.error("Error al verificar caja abierta:", error);
        setCajaAbierta(false);
      }
    };

    verificarCaja();
  }, []);

  // 🧮 SUMAR TOTALES
  const obtenerTotalRealizado = async () => {
    try {
      const { data } = await api.get("/mesas");
      const abiertas = data.filter((m) => m.estado === "abierta");

      const total = abiertas.reduce(
        (sum, mesa) => sum + (mesa.total || 0),
        0
      );

      setTotalMesas(total);
      setMostrarTotalMesas(true);
      setMenuAbierto(false);
    } catch (err) {
      logger.error("Error obteniendo total de mesas abiertas:", err);
    }
  };

  return (
    <div className="subnavbar--subnavbar">
      <div className="subnavbar-header--subnavbar">
        <button className="hamburger-button--subnavbar" onClick={toggleMenu}>
          ☰
        </button>
      </div>

      <div className={`subnavbar-menu--subnavbar ${menuAbierto ? "open--subnavbar" : "closed--subnavbar"}`}>
        <button onClick={() => navigate("/mesas-cerradas")} className="subnavbar-button--subnavbar">
          Mesas
        </button>

        <button
          onClick={() => { setMostrarVentasHoy(true); setMenuAbierto(false); }}
          className="subnavbar-button--subnavbar"
        >
          Stock
        </button>

        {/* NUEVO BOTÓN: REALIZADO */}
        <button
          onClick={obtenerTotalRealizado}
          className="subnavbar-button--subnavbar realizado-button"
        >
          Realizado
        </button>

        <button onClick={logout} className="subnavbar-button--subnavbar">
          Cerrar Sesión
        </button>
      </div>

      {/* MODALES */}
      {mostrarVentasHoy && <VentasHoyModal onClose={() => setMostrarVentasHoy(false)} />}
      {showModal && <CerrarCajaModal onClose={() => setShowModal(false)} />}
      {mostrarModal && <PasswordModal onClose={() => setMostrarModal(false)} />}

      {/* MODAL TOTAL MESAS */}
      {mostrarTotalMesas && (
        <ModalTotalMesas
          total={totalMesas}
          onClose={() => setMostrarTotalMesas(false)}
        />
      )}
    </div>
  );
};

export default SubNavbar;
