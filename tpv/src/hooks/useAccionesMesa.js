import { useCallback } from "react";
import * as logger from '../utils/logger';
import api from "../utils/api";

const useAccionesMesa = (mesa, setMensajeAlerta, navigate, datosFactura) => {
  const enviarAFacturaPrinter = useCallback(async (datosImpresion) => {
    try {
      await api.post(`/imprimir/${mesa._id}/imprimir-factura`, datosImpresion);
    } catch (error) {
      logger.error("Error al imprimir la factura:", error);
    }
  }, [mesa]);


  const cerrarMesa = useCallback(
    async (metodoPago, tipoFactura = "simplificada", cliente = {}, camarero = "") => {
      try {
        const response = await api.put(`/mesas/${mesa._id}/cerrar`, {
          metodoPago,
          clienteNombre: cliente.nombre || "",
          clienteNIF: cliente.nif || "",
          camarero
        });

        const { datosImpresion } = response.data;

        if (datosImpresion) {
          await enviarAFacturaPrinter(datosImpresion);
        }

        navigate("/");
      } catch (error) {
        logger.error(error);
        setMensajeAlerta({
          tipo: "error",
          mensaje: "Hubo un error al cerrar la mesa.",
        });
      }
    },
    [mesa, navigate, enviarAFacturaPrinter, setMensajeAlerta]
  );

  const emitirFactura = async (metodoPago, datosCliente, camarero = "") => {
    await cerrarMesa(metodoPago, "nominativa", datosCliente, camarero);
  };

  const imprimirCuenta = useCallback(async () => {
    try {
      await api.post(`/cuenta/${mesa._id}/imprimir-cuenta`);
      setMensajeAlerta({
        tipo: "exito",
        mensaje: "Cuenta enviada a impresión.",
      });
    } catch (error) {
      setMensajeAlerta({
        tipo: "error",
        mensaje: error.response?.data?.error || "Hubo un problema.",
      });
    }
  }, [mesa, setMensajeAlerta]);

  return {
    cerrarMesa,
    emitirFactura,
    imprimirCuenta,
  };
};

export default useAccionesMesa;
