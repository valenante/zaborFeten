import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from '../../utils/api';
import * as logger from '../../utils/logger';
import "./Navbar.css";
import logo from "../../images/LovePizzaLogo.png";

// Variables de entorno
const mostrarBarra = process.env.REACT_APP_BARRA === 'true';
const mostrarCocina = process.env.REACT_APP_COCINA === 'true';

const Navbar = () => {
  const [selectValue, setSelectValue] = useState("");
  const [config, setConfig] = useState({
    permitePedidosComida: true,
    permitePedidosBebida: true,
  });

  const handleSelectChange = (e) => {
    const path = e.target.value;
    if (path) {
      window.location.href = path;
      setSelectValue(""); // Reinicia el valor después de redirigir
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

  const toggleCampo = async (campo) => {
    try {
      const nuevoValor = !config[campo];
      const res = await api.put("/configuracion-global", {
        [campo]: nuevoValor,
      });
      setConfig(res.data);
    } catch (error) {
      logger.error("Error al actualizar configuración:", error);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <nav className="navbar--navbar">
      <ul className="navbar-list--navbar">
        <li className="navbar-item--navbar">
          <Link className="navbar-link--navbar" to="/">
            <img src={logo} alt="ZF" className="navbar-logo--navbar" />
          </Link>
        </li>

        <li className="navbar-item--navbar only-desktop">
          <Link className="navbar-link--navbar" to="/products">Productos</Link>
        </li>
        <li className="navbar-item--navbar only-desktop">
          <Link className="navbar-link--navbar" to="/reservas">Reservas</Link>
        </li>
        <li className="navbar-item--navbar only-desktop">
          <Link className="navbar-link--navbar" to="/facturas">Facturas</Link>
        </li>
        <li className="navbar-item--navbar only-desktop">
          <Link className="navbar-link--navbar" to="/admin">Admin</Link>
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

        <li className="navbar-item--navbar only-mobile">
          <select
            className="navbar-select--navbar"
            onChange={handleSelectChange}
            value={selectValue}
          >
            <option value="" disabled>Ir a...</option>
            <option value="/tpv/">Inicio</option>
            <option value="/tpv/products">Productos</option>
            <option value="/tpv/reservas">Reservas</option>
            <option value="/tpv/facturas">Facturas</option>
            <option value="/tpv/admin">Admin</option>
            {mostrarBarra && <option value="/tpv/barra">Barra</option>}
            {mostrarCocina && <option value="/tpv/cocina">Cocina</option>}
          </select>
        </li>

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
    </nav>
  );
};

export default Navbar;
