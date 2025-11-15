import React from "react";
import "./ResumenSolicitadoModal.css";

const ResumenSolicitadoModal = ({ producto, detalle, onClose }) => {
  if (!producto || !detalle) return null;

  return (
    <div className="overlay-resumen-solicitado">
      <div className="modal-resumen-solicitado">
        <h2>{producto}</h2>

        <ul>
          {detalle.map((m, i) => (
            <li key={i}>
              <strong>Mesa {m.mesa}</strong> → {m.cantidad} ud{m.cantidad > 1 ? "s" : ""}
            </li>
          ))}
        </ul>

        <button onClick={onClose} className="btn-cerrar-resumen">
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default ResumenSolicitadoModal;
