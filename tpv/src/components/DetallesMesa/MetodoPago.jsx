import React, { useState, useRef, useMemo } from "react";
import "./MetodoPago.css";
import "../Modal/ModalConfirmacion";

const MetodoPagoModal = ({ total, onClose, onConfirm }) => {
  const [efectivo, setEfectivo] = useState("");
  const [tarjeta, setTarjeta] = useState("");
  const [propina, setPropina] = useState("");
  const [error, setError] = useState("");
  const [mostrarConfirmacionFinal, setMostrarConfirmacionFinal] = useState(false);
  const [confirmacionMensaje, setConfirmacionMensaje] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 🛡️ Bloqueo anti-doble click a prueba de renders
  const hasConfirmedRef = useRef(false);

  // 🔐 Idempotencia: misma clave para este intento de cobro
  const idempotencyKey = useMemo(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }, []);

  const handleConfirm = () => {
    const efectivoValue = parseFloat(efectivo) || 0;
    const tarjetaValue = parseFloat(tarjeta) || 0;
    const propinaValue = parseFloat(propina) || 0;
    const totalPago = efectivoValue + tarjetaValue;

    if (totalPago < total) {
      setError(
        `El total ingresado (${totalPago.toFixed(2)} €) es menor que el total de la mesa (${total.toFixed(2)} €).`
      );
      return;
    }

    const cambio = totalPago - total;
    const mensaje = `El cliente ha pagado ${totalPago.toFixed(2)} €. ${
      cambio > 0 ? `Debe devolver ${cambio.toFixed(2)} €.` : `Sin cambio.`
    }${propinaValue > 0 ? ` Además, ha dejado una propina de ${propinaValue.toFixed(2)} €.` : ""} ¿Deseas confirmar este pago?`;

    setConfirmacionMensaje(mensaje);
    setMostrarConfirmacionFinal(true);
    setError("");
  };

  const handleConfirmFinal = async () => {
    if (hasConfirmedRef.current) return;   // 🚫 ya en curso o ya confirmado
    hasConfirmedRef.current = true;
    setIsProcessing(true);

    const payload = {
      efectivo: parseFloat(efectivo) || 0,
      tarjeta: parseFloat(tarjeta) || 0,
      propina: parseFloat(propina) || 0,
      cambio:
        (parseFloat(efectivo) || 0) +
        (parseFloat(tarjeta) || 0) -
        total,
      idempotencyKey, // 🔐 pásalo al backend
    };

    try {
      // onConfirm puede usar headers con "Idempotency-Key" si lo implementaste ahí
      await onConfirm(payload);
      // ÉXITO: cerramos confirmación y modal; NO reactivamos botones
      setMostrarConfirmacionFinal(false);
      onClose?.();
    } catch (err) {
      console.error("❌ Error al confirmar pago:", err);
      // Si falla, permitimos reintentar
      hasConfirmedRef.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal--cuenta">
      <div className="modal-content--cuenta">
        <h2 className="titulo--cuenta">Método de Pago</h2>
        <p className="total--cuenta">Total: {total.toFixed(2)} €</p>

        <label className="label--cuenta">
          Efectivo:
          <input
            type="number"
            min="0"
            value={efectivo}
            onChange={(e) => setEfectivo(e.target.value)}
            className="input--cuenta"
            disabled={isProcessing}
          />
        </label>

        <label className="label--cuenta">
          Tarjeta:
          <input
            type="number"
            min="0"
            value={tarjeta}
            onChange={(e) => setTarjeta(e.target.value)}
            className="input--cuenta"
            disabled={isProcessing}
          />
        </label>

        <label className="label--cuenta">
          Propina (opcional):
          <input
            type="number"
            min="0"
            value={propina}
            onChange={(e) => setPropina(e.target.value)}
            className="input--cuenta"
            disabled={isProcessing}
          />
        </label>

        {error && <p className="error--cuenta">{error}</p>}

        <div className="botones--cuenta">
          <button onClick={onClose} className="boton-cancelar--cuenta" disabled={isProcessing}>
            Cancelar
          </button>
          <button onClick={handleConfirm} className="boton-confirmar--cuenta" disabled={isProcessing}>
            Confirmar
          </button>
        </div>
      </div>

      {mostrarConfirmacionFinal && (
        <div className="modal--cuenta">
          <div className="modal-content--cuenta">
            <p>{confirmacionMensaje}</p>
            <div className="botones--cuenta">
              <button
                onClick={() => setMostrarConfirmacionFinal(false)}
                className="boton-cancelar--cuenta"
                disabled={isProcessing}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmFinal}
                className="boton-confirmar--cuenta"
                disabled={isProcessing}
              >
                {isProcessing ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetodoPagoModal;
