import React, { useState } from "react";
import "./EditarMesa.css";

export default function ModalEditarMesa({ mesa, onClose, onSave, onDelete }) {
  const [numero, setNumero] = useState(mesa.numero);
  const [zona, setZona] = useState(mesa.zona);

  const handleSave = () => onSave({ numero, zona });

  return (
    <div className="modal-overlay">
      <div className="modal-contenido">
        <h2>Editar Mesa {mesa.numero}</h2>
        <label>Número:</label>
        <input value={numero} onChange={(e) => setNumero(e.target.value)} />
        <label>Zona:</label>
        <select value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="interior">Interior</option>
          <option value="exterior">Terraza</option>
          <option value="auxiliar">Auxiliar</option>
        </select>
        <div className="modal-botones">
          <button className="btn-guardar" onClick={handleSave}>Guardar</button>
          <button className="btn-eliminar" onClick={onDelete}>Eliminar</button>
          <button onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
