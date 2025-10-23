import React, { useState } from "react";
import "./ModalConfirmacion.css"; // Asegúrate de tener este archivo CSS

export default function ModalConfirmacion({
  titulo = "Confirmar acción",
  mensaje = "¿Está seguro?",
  placeholder = "",
  onConfirm,
  onClose
}) {
  const [valor, setValor] = useState("");

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
              // 🟢 Input numérico seguro solo para "Número de comensales"
              <input
                type="number"
                min="1"
                max="25"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={placeholder}
                value={valor}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value) && (value === "" || (Number(value) >= 1 && Number(value) <= 25))) {
                    setValor(value);
                  }
                }}
              />
            ) : (
              // ⚪ Input normal para cualquier otro caso
              <input
                type="text"
                placeholder={placeholder}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            )}
          </>
        )}
        <div className="modal-botones">
          <button onClick={onClose} className="boton-cancelar-modal-confirmacion">Cancelar</button>
          <button onClick={manejarConfirmacion} className="boton-aceptar-modal-confirmacion">Aceptar</button>
        </div>
      </div>
    </div>
  );
}
