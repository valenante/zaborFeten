import React, { useState } from "react";
import "./ModalConfirmacion.css";

export default function ModalConfirmacion({
  titulo = "Confirmar acción",
  mensaje = "¿Está seguro?",
  placeholder = "",
  opciones = [], // 🟢 nuevo: permite mostrar un selector
  value,         // valor externo opcional
  onChange,      // manejador externo opcional
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

        {/* === Campo dinámico === */}
        {opciones.length > 0 ? (
          // 🟣 Si se pasan opciones, mostrar selector (para zona, por ejemplo)
          <select
            value={valor}
            onChange={handleChange}
            className="modal-select"
          >
            <option value="">Selecciona una opción...</option>
            {opciones.map((op, i) => (
              <option key={i} value={op}>
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </option>
            ))}
          </select>
        ) : placeholder ? (
          // 🟠 Si no hay opciones, usar input tradicional
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
        ) : null}

        <div className="modal-botones">
          <button
            onClick={onClose}
            className="boton-cancelar-modal-confirmacion"
          >
            Cancelar
          </button>
          <button
            onClick={manejarConfirmacion}
            className="boton-aceptar-modal-confirmacion"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
