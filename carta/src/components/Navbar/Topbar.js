import React from "react";
import logo from "../../assets/images/logoZF.avif"; // Logo de la aplicación
import "../../styles/TopBar.css"; // Estilos de TopBar

const TopBar = () => {
  return (
    <div className="top-bar">
      <div className="container d-flex justify-content-center align-items-center">
        <img src={logo} alt="Logo" className="top-bar-logo" />
      </div>
    </div>
  );
};

export default TopBar;
