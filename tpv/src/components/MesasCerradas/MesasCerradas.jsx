import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import * as logger from '../../utils/logger';
import "./MesasCerradas.css";
import ModalConfirmacion from "../Modal/ModalConfirmacion";
import AlertaMensaje from "../AlertaMensaje/AlertaMensaje";

const MesasCerradas = () => {
  const [mesas, setMesas] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [accionModal, setAccionModal] = useState(null);
  const [mensajeAlerta, setMensajeAlerta] = useState(null);

  // Detalle
  const [detalle, setDetalle] = useState(null);        // { _id, numero, inicio, cierre, total, metodoPago, items:[] }
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  // ====== Cargar listado ======
  const fetchMesas = async () => {
    try {
      const response = await api.get("/mesas/mesas-cerradas/mesas-cerradas");
      setMesas(response.data || []);
    } catch (err) {
      logger.error("Error al obtener las mesas cerradas:", err);
      setError("Error al obtener las mesas cerradas.");
    }
  };

  useEffect(() => {
    fetchMesas();
  }, []);

  // ====== Cargar detalle por id de MesaCerrada ======
  const abrirDetalle = async (id) => {
    setCargandoDetalle(true);
    setMostrarDetalle(true);
    try {
      // Ajusta este path si tu ruta es distinta:
      //pasamos el id por req.query
      const { data } = await api.get(`/mesas/mesas-cerradas/mesas-cerradas?id=${id}`);
      setDetalle(data);
    } catch (err) {
      logger.error("Error al obtener detalle de mesa cerrada:", err);
      setMensajeAlerta({
        tipo: "error",
        mensaje: "No se pudo cargar el detalle de la mesa."
      });
      setMostrarDetalle(false);
    } finally {
      setCargandoDetalle(false);
    }
  };

  // ====== Crear mesa ======
  const crearMesa = () => {
    setAccionModal({
      titulo: "Crear Mesa",
      mensaje: "Introduce el número de la mesa que deseas crear (solo números):",
      placeholder: "Número de mesa",
      onConfirm: async (numeroMesaInput) => {
        if (!numeroMesaInput || isNaN(numeroMesaInput) || parseInt(numeroMesaInput, 10) <= 0) {
          setMensajeAlerta({ tipo: "error", mensaje: "Por favor, introduce un número válido." });
          return;
        }
        try {
          setIsLoading(true);
          await api.post("/mesas/crear-mesa/crear-mesa", { numero: parseInt(numeroMesaInput, 10) });
          setMensajeAlerta({ tipo: "exito", mensaje: "Mesa creada exitosamente." });
          await fetchMesas();
        } catch (error) {
          logger.error("Error al crear la mesa:", error);
          setMensajeAlerta({ tipo: "error", mensaje: error.response?.data?.error || "Error al crear la mesa." });
        } finally {
          setIsLoading(false);
        }
      },
    });
    setMostrarModalConfirmacion(true);
  };

  // ====== Eliminar mesa ======
  const eliminarMesa = () => {
    setAccionModal({
      titulo: "Eliminar Mesa",
      mensaje: "Introduce el número de la mesa que deseas eliminar (solo números):",
      placeholder: "Número de mesa",
      onConfirm: async (numeroMesaInput) => {
        if (!numeroMesaInput || isNaN(numeroMesaInput) || parseInt(numeroMesaInput, 10) <= 0) {
          setMensajeAlerta({ tipo: "error", mensaje: "Por favor, introduce un número válido." });
          return;
        }
        try {
          setIsLoading(true);
          await api.delete(`/mesas/eliminar-mesa?numero=${numeroMesaInput}`);
          setMensajeAlerta({ tipo: "exito", mensaje: "Mesa eliminada exitosamente." });
          await fetchMesas();
        } catch (error) {
          logger.error("Error al eliminar la mesa:", error);
          setMensajeAlerta({ tipo: "error", mensaje: error.response?.data?.error || "Error al eliminar la mesa." });
        } finally {
          setIsLoading(false);
        }
      },
    });
    setMostrarModalConfirmacion(true);
  };

  if (error) return <div>Error: {error}</div>;

  return (
    <div className="mesas-cerradas--mesas-cerradas">
      <div className="botones-container">
        <div className="botones-container-mesas-cerradas">
          <button onClick={crearMesa} disabled={isLoading} className="boton--cerrar-caja">
            {isLoading ? "Creando..." : "Crear Mesa"}
          </button>
          <button onClick={eliminarMesa} disabled={isLoading} className="boton-cancelar--cerrar-caja">
            {isLoading ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>

      {mesas.length === 0 ? (
        <p className="mensaje-vacio--mesas-cerradas">No hay mesas cerradas.</p>
      ) : (
        <div className="tabla-container--mesas-cerradas">
          <table className="tabla--mesas-cerradas">
            <thead>
              <tr>
                <th>Número</th>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Total</th>
                <th>Métodos de Pago</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {mesas.map((mesa) => (
                <tr key={mesa._id}>
                  <td>{mesa.numero}</td>
                  <td>{new Date(mesa.inicio).toLocaleTimeString()}</td>
                  <td>{new Date(mesa.cierre).toLocaleTimeString()}</td>
                  <td>{Number(mesa.total || 0).toFixed(2)} €</td>
                  <td>
                    <div><strong>Efectivo:</strong> {Number(mesa.metodoPago?.efectivo || 0).toFixed(2)} €</div>
                    <div><strong>Tarjeta:</strong> {Number(mesa.metodoPago?.tarjeta || 0).toFixed(2)} €</div>
                    <div><strong>Propina:</strong> {Number(mesa.metodoPago?.propina || 0).toFixed(2)} €</div>
                  </td>
                  <td>
                    <button
                      className="btn-detalle--mesas-cerradas"
                      onClick={() => abrirDetalle(mesa._id)}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalle */}
      {mostrarDetalle && (
        <div className="modal-overlay--mesas-cerradas" role="dialog" aria-modal="true">
          <div className="modal-contenido--mesas-cerradas">
            <button className="modal-cerrar--mesas-cerradas" onClick={() => setMostrarDetalle(false)}>✖</button>

            {cargandoDetalle ? (
              <p>Cargando detalle…</p>
            ) : detalle ? (
              <>
                <h2>Mesa {detalle.numero}</h2>
                <p><strong>Apertura:</strong> {new Date(detalle.inicio).toLocaleString()}</p>
                <p><strong>Cierre:</strong> {new Date(detalle.cierre).toLocaleString()}</p>

                <div className="detalle-pagos--mesas-cerradas">
                  <div><strong>Total:</strong> {Number(detalle.total || 0).toFixed(2)} €</div>
                  <div><strong>Efectivo:</strong> {Number(detalle.metodoPago?.efectivo || 0).toFixed(2)} €</div>
                  <div><strong>Tarjeta:</strong> {Number(detalle.metodoPago?.tarjeta || 0).toFixed(2)} €</div>
                  <div><strong>Propina:</strong> {Number(detalle.metodoPago?.propina || 0).toFixed(2)} €</div>
                </div>
                {(!detalle.items || detalle.items.length === 0) ? (
                  <p>Sin productos registrados.</p>
                ) : (
                  <table className="tabla-detalle--mesas-cerradas">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Cant.</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.items.map((it, idx) => (
                        <tr key={idx}>
                          <td>{it.nombre}</td>
                          <td>{it.cantidad}</td>
                          <td>{Number(it.precio || 0).toFixed(2)} €</td>
                          <td>{Number(it.subtotal || 0).toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <p>No se encontró detalle.</p>
            )}
          </div>
        </div>
      )}

      {mostrarModalConfirmacion && (
        <ModalConfirmacion
          titulo={accionModal?.titulo}
          mensaje={accionModal?.mensaje}
          placeholder={accionModal?.placeholder}
          onConfirm={(valor) => {
            accionModal?.onConfirm(valor);
            setMostrarModalConfirmacion(false);
          }}
          onClose={() => setMostrarModalConfirmacion(false)}
        />
      )}

      {mensajeAlerta && (
        <AlertaMensaje
          tipo={mensajeAlerta.tipo}
          mensaje={mensajeAlerta.mensaje}
          onClose={() => setMensajeAlerta(null)}
        />
      )}
    </div>
  );
};

export default MesasCerradas;
