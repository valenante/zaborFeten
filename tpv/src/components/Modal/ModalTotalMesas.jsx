import React from "react";
import "./ModalTotalMesas.css";

export default function ModalTotalMesas({ total, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-contenido">
        <h2>Total realizado</h2>

        <p className="total-realizado">
          {total.toFixed(2)} €
        </p>

        <div className="modal-buttons">
          <button onClick={onClose} className="modal-button cerrar">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
