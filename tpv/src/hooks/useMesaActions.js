import { useState } from "react";
import api from "../utils/api";

export function useMesaActions({
  mesa = null,            // 🔹 en Dashboard NO hay mesa, es null
  setMesa = null,         // 🔹 en Dashboard no se usa
  setMensajeAlerta = null, // 🔹 en Dashboard se usa setAlerta
  fetchMesa = null,
  navigate = null,
  user = null,

  // 🔹 Para Dashboard:
  setMesas = null,
  setAlerta = null,
}) {  
  const [mostrarModalAccion, setMostrarModalAccion] = useState(false);
  const [accionModal, setAccionModal] = useState(null);
  const [selectAccion, setSelectAccion] = useState("");
  const [mostrarTransferir, setMostrarTransferir] = useState(false);
  const [valorInput, setValorInput] = useState("");

  // ===========================
  // 🔁 TRANSFERIR ARTÍCULOS
  // ===========================
  const accionTransferir = () => {
    setMostrarTransferir(true);
  };

  // ===========================
  // 👤 MODIFICAR COMENSALES
  // ===========================
  const accionModificarComensales = (mesaParam) => {
    const targetMesa = mesaParam || mesa; // 🟣 si se usa desde Dashboard, mesa viene por parámetro

    if (!targetMesa) return;

    setAccionModal({
      titulo: `Modificar comensales - Mesa ${targetMesa.numero}`,
      mensaje: "Introduce el nuevo número de comensales:",
      placeholder: "Cantidad de comensales",

      onConfirm: async (valor) => {
        const comensales = parseInt(valor, 10);

        if (isNaN(comensales) || comensales < 1 || comensales > 25) {
          (setMensajeAlerta || setAlerta)?.({
            tipo: "error",
            mensaje: "Número inválido de comensales (1–25).",
          });
          return;
        }

        try {
          await api.put(`/mesas/${targetMesa._id}/comensales`, { comensales });

          // 🟣 Si estamos en DetalleMesa
          if (setMesa) {
            setMesa((prev) => ({ ...prev, comensales }));
          }

          // 🟣 Si estamos en Dashboard
          if (setMesas) {
            setMesas((prev) =>
              prev.map((m) =>
                m._id === targetMesa._id ? { ...m, comensales } : m
              )
            );
            fetchMesa?.();
          }

          (setMensajeAlerta || setAlerta)?.({
            tipo: "exito",
            mensaje: `Mesa ${targetMesa.numero}: ${comensales} comensales.`,
          });

        } catch (err) {
          (setMensajeAlerta || setAlerta)?.({
            tipo: "error",
            mensaje: "Error al actualizar comensales.",
          });
        }
      },
    });

    setMostrarModalAccion(true);
  };

  // ===========================
  // 🔽 SELECTOR DE ACCIONES
  // ===========================
  const handleSelect = (value, mesaParam = null) => {
    setSelectAccion(value);

    switch (value) {
      case "transferir":
        accionTransferir();
        break;

      case "comensales":
        accionModificarComensales(mesaParam);
        break;

      default:
        break;
    }
  };

  return {
    mostrarModalAccion,
    setMostrarModalAccion,
    accionModal,
    setAccionModal,
    selectAccion,
    handleSelect,
    mostrarTransferir,
    setMostrarTransferir,
    valorInput,
    setValorInput
  };
}
