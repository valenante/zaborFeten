import React, { useState } from "react";
import "./ModalConfirmacion.css";

export default function ModalConfirmacion({
  titulo = "Confirmar acción",
  mensaje = "¿Está seguro?",
  placeholder = "",
  value, // 👈 valor externo opcional
  onChange, // 👈 manejador externo opcional
  onConfirm,
  onClose
}) {
  const [valorInterno, setValorInterno] = useState("");

  const valor = value !== undefined ? value : valorInterno;
  const handleChange = onChange || ((e) => setValorInterno(e.target.value));

  const manejarConfirmacion = () => {
  onConfirm(valor.trim());
};


  return (
    <div className="modal-overlay">
      <div className="modal-contenido">
        <h2>{titulo}</h2>
        <p>{mensaje}</p>
        {placeholder && (
          <>
            {placeholder.toLowerCase().includes("comensales") ? (
              <input
                type="number"
                min="1"
                max="25"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={placeholder}
                value={valor}
                onChange={handleChange}
              />
            ) : (
              <input
                type="text"
                placeholder={placeholder}
                value={valor}
                onChange={handleChange}
              />
            )}
          </>
        )}
        <div className="modal-botones">
          <button onClick={onClose} className="boton-cancelar-modal-confirmacion">
            Cancelar
          </button>
          <button onClick={manejarConfirmacion} className="boton-aceptar-modal-confirmacion">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
