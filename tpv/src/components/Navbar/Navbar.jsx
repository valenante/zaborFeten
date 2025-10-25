import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from '../../utils/api';
import * as logger from '../../utils/logger';
import "./Navbar.css";
import logo from "../../images/LovePizzaLogo.png";
import CerrarCajaModal from "../Caja/CerrarCajaModal"; // 👈 IMPORTANTE
import PasswordModal from "../Password/PasswordModal"; // 👈 importa tu modal

const mostrarBarra = process.env.REACT_APP_BARRA === 'true';
const mostrarCocina = process.env.REACT_APP_COCINA === 'true';

const Navbar = () => {
  const [selectValue, setSelectValue] = useState("");
  const [config, setConfig] = useState({
    permitePedidosComida: true,
    permitePedidosBebida: true,
  });
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [mostrarCerrarCaja, setMostrarCerrarCaja] = useState(false); // 👈 estado modal
  const [mostrarPassword, setMostrarPassword] = useState(false); // 👈 nuevo estado


  const handleSelectChange = (e) => {
    const path = e.target.value;

    // 👇 Intercepta la opción especial para abrir el modal
    if (path === "cerrarCaja") {
      if (cajaAbierta) setMostrarCerrarCaja(true);
      setSelectValue("");
      return;
    }    
    
    if (path === "password") {
      setMostrarPassword(true); // 👈 abre modal de contraseña
      setSelectValue("");
      return;
    }

    if (path) {
      window.location.href = path;
      setSelectValue("");
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await api.get("/configuracion-global");
      setConfig(res.data);
    } catch (error) {
      logger.error("Error al obtener configuración:", error);
    }
  };

  const verificarCaja = async () => {
    try {
      const { data } = await api.get("/caja/abierta");
      setCajaAbierta(data.abierta);
    } catch (error) {
      logger.error("Error al verificar caja abierta:", error);
      setCajaAbierta(false);
    }
  };

  const toggleCampo = async (campo) => {
    try {
      const nuevoValor = !config[campo];
      const res = await api.put("/configuracion-global", { [campo]: nuevoValor });
      setConfig(res.data);
    } catch (error) {
      logger.error("Error al actualizar configuración:", error);
    }
  };

  useEffect(() => {
    fetchConfig();
    verificarCaja();
  }, []);

  return (
    <nav className="navbar--navbar">
      <ul className="navbar-list--navbar">
        <li className="navbar-item--navbar">
          <Link className="navbar-link--navbar" to="/">
            <img src={logo} alt="ZF" className="navbar-logo--navbar" />
          </Link>
        </li>

        {/* Select Admin (desktop) */}
        <li className="navbar-item--navbar only-desktop">
          <select
            className="navbar-select--navbar"
            onChange={handleSelectChange}
            value={selectValue}
          >
            <option value="" disabled>Admin</option>
            <option value="/tpv/admin">Firma Digital</option>
            <option value="/tpv/estadisticas">Estadísticas</option>
            <option value="/tpv/eliminaciones">Eliminaciones</option>
            <option value="password">Contraseña (Carta)</option> 
            <option value="/tpv/cajaDiaria">Caja Diaria</option>
            <option value="cerrarCaja" disabled={!cajaAbierta}>
              {cajaAbierta ? "Cerrar Caja" : "Cerrar Caja (cerrada)"}
            </option>
            <option value="/tpv/registro">Usuarios</option>
            <option value="/tpv/products">Productos</option>
            <option value="/tpv/reservas">Reservas</option>
            <option value="/tpv/facturas">Facturas</option>
          </select>
        </li>

        {mostrarBarra && (
          <li className="navbar-item--navbar only-desktop">
            <Link className="navbar-link--navbar" to="/barra">Barra</Link>
          </li>
        )}
        {mostrarCocina && (
          <li className="navbar-item--navbar only-desktop">
            <Link className="navbar-link--navbar" to="/cocina">Cocina</Link>
          </li>
        )}

        {/* Select Admin (móvil) con mismas opciones */}
        <li className="navbar-item--navbar only-mobile">
          <select
            className="navbar-select--navbar"
            onChange={handleSelectChange}
            value={selectValue}
          >
            <option value="" disabled>Ir a...</option>
            <option value="/tpv/">Inicio</option>
            <option value="/tpv/admin">Firma Digital</option>
            <option value="/tpv/estadisticas">Estadísticas</option>
            <option value="/tpv/eliminaciones">Eliminaciones</option>
            <option value="password">Contraseña (Carta)</option> 
            <option value="/tpv/cajaDiaria">Caja Diaria</option>
            <option value="cerrarCaja" disabled={!cajaAbierta}>
              {cajaAbierta ? "Cerrar Caja" : "Cerrar Caja (cerrada)"}
            </option>
            <option value="/tpv/registro">Usuarios</option>
            <option value="/tpv/products">Productos</option>
            <option value="/tpv/reservas">Reservas</option>
            <option value="/tpv/facturas">Facturas</option>
            {mostrarBarra && <option value="/tpv/barra">Barra</option>}
            {mostrarCocina && <option value="/tpv/cocina">Cocina</option>}
          </select>
        </li>

        {/* Toggles */}
        <li className="navbar-item--navbar only-desktop">
          <button
            className={`toggle-btn ${config.permitePedidosComida ? "enabled" : "disabled"}`}
            onClick={() => toggleCampo("permitePedidosComida")}
          >
            {config.permitePedidosComida ? "Comida ON" : "Comida OFF"}
          </button>
          <button
            className={`toggle-btn ${config.permitePedidosBebida ? "enabled" : "disabled"}`}
            onClick={() => toggleCampo("permitePedidosBebida")}
          >
            {config.permitePedidosBebida ? "Bebida ON" : "Bebida OFF"}
          </button>
        </li>
      </ul>

      {/* 👇 Render del modal al pulsar "Cerrar Caja" */}
      {mostrarCerrarCaja && (
        <CerrarCajaModal onClose={() => setMostrarCerrarCaja(false)} />
      )}

      {mostrarPassword && (
        <PasswordModal onClose={() => setMostrarPassword(false)} />
      )}
    </nav>
  );
};

export default Navbar;
