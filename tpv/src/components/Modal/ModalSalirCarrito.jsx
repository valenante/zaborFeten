import "./ModalSalirCarrito.jsx";

export default function ModalSalirCarrito({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-contenido salir-modal">

        <h2>¿Seguro que quieres salir?</h2>
        <p>Perderás todos los productos del carrito.</p>

        <div className="salir-botones">
          <button className="cancelar" onClick={onCancel}>
            Cancelar
          </button>

          <button className="confirmar" onClick={onConfirm}>
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
