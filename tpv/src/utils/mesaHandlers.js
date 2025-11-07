import api from "../utils/api";
import * as logger from './logger';

export const fetchMesas = async (setMesas) => {
  try {
    const { data } = await api.get("/mesas");
    setMesas(data);
  } catch (error) {
    logger.error("Error al obtener las mesas:", error);
  }
};


export const abrirMesaConModal = async (
  mesa,
  setAccionModal,
  setMesaSeleccionada,
  setMostrarModalConfirmacion,
  fetchMesas,
  navigate
) => {
  try {
    // ✅ No volver a abrir modal aquí
    await api.put(`/mesas/mesas/${mesa._id}/abrir`, {
      comensales: Number(mesa.comensales),
    });

    await fetchMesas(); // refresca mesas
    setMostrarModalConfirmacion(false); // cierra modal actual
    navigate(`/mesas/${mesa._id}`); // redirige a la mesa abierta
  } catch (error) {
    logger.error("❌ Error al abrir la mesa:", error);
  }
};