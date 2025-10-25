import React, { useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MetodoPago from "../components/DetallesMesa/MetodoPago";
import RightBar from "../components/RightBar/RightBar";
import { SocketContext } from "../utils/socket";
import useMesa from "../hooks/useMesa";
import usePedidos from "../hooks/usePedidos";
import useAccionesMesa from "../hooks/useAccionesMesa";
import { useAuth } from "../context/AuthContext";
import "../styles/DetallesMesa.css";
import AlertaMensaje from "../components/AlertaMensaje/AlertaMensaje";
import ModalTransferencia from "../components/Modal/ModalTransferencia";
import ModalConfirmacion from "../components/Modal/ModalConfirmacion";
import ListaPedidos from "../components/DetallesMesa/ListaPedidos";
import ListaBebidas from "../components/DetallesMesa/ListaBebidas";
import api from "../utils/api";
import { error, info, warn } from "../utils/logger";

const DetalleMesa = () => {
  const { id } = useParams(); // Obtener el `id` de la mesa desde la URL  
  const { user } = useAuth()
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);
  const { mesa, setMesa, productosDetalles, fetchMesa } = useMesa(id, socket);
  const {
    agregarProducto,
    eliminarProducto,
    mensajeAlerta,
    setMensajeAlerta,
  } = usePedidos(mesa, setMesa);
  const [datosFactura, setDatosFactura] = useState({ nombre: "", nif: "" });
  const {
    cerrarMesa,
    emitirFactura,
    imprimirCuenta,
  } = useAccionesMesa(mesa, setMensajeAlerta, navigate, /*datosFactura*/);
  const [showModal, setShowModal] = useState(false);
  const [mostrarFacturaModal, setMostrarFacturaModal] = useState(false);
  const [metodoPagoFactura, setMetodoPagoFactura] = useState(null);
  useState(false);
  const [mostrarModalTransferir, setMostrarModalTransferir] = useState(false);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [accionModal, setAccionModal] = useState(null);
  const [isProcessingFactura, setIsProcessingFactura] = useState(false);

  // ⛔ AÑADE ESTO AQUÍ ANTES DEL RETURN
  if (!mesa) {
    return (
      <p className="cargando--mesadetalles">Cargando detalles de la mesa...</p>
    );
  }
  const solicitarProducto = async (pedidoId, itemId, estacion) => {
    try {
      await api.post(`/cocina/${pedidoId}/items/${itemId}/solicitar`, {
        solicitadoA: estacion,
        solicitadoPor: 'caja',
      });
      setMensajeAlerta({
        tipo: "exito",
        mensaje: "Producto solicitado correctamente.",
      });
    } catch (err) {
      error("Error al solicitar producto:", err); // ✅ ahora sí llama a tu función logger.error
      setMensajeAlerta({
        tipo: "error",
        mensaje: "Error al solicitar producto.",
      });
    }
  };

  return (
    <div className="detalle-mesa--mesadetalles">
      <div className="rightbar--mesadetalles">
        <RightBar mesaId={mesa._id} agregarProducto={agregarProducto} />
      </div>
      <div className="contenido-mesa--mesadetalles">

        {mostrarFacturaModal && (
          <div className="modal-factura">
            <div className="modal-contenido">
              <h2>Datos de la Factura</h2>
              <input
                type="text"
                placeholder="Nombre o Razón Social"
                value={datosFactura.nombre}
                onChange={(e) =>
                  setDatosFactura({ ...datosFactura, nombre: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="NIF o CIF"
                value={datosFactura.nif}
                onChange={(e) =>
                  setDatosFactura({ ...datosFactura, nif: e.target.value })
                }
              />
              {/* === BOTÓN BLOQUEADO PROFESIONALMENTE === */}
              <button
                disabled={isProcessingFactura} // 🔒 evita doble clic
                onClick={async () => {
                  if (isProcessingFactura) return; // seguridad extra
                  setIsProcessingFactura(true); // activa bloqueo
                  try {
                    const idempotencyKey =
                      typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;

                    await emitirFactura(
                      metodoPagoFactura,
                      {
                        nombre: datosFactura.nombre,
                        nif: datosFactura.nif,
                        idempotencyKey, // 🔐 pásalo al backend
                      },
                      user?.name
                    );

                    // 🔚 al terminar correctamente, cierra modal
                    setMostrarFacturaModal(false);
                  } catch (err) {
                    console.error("❌ Error al emitir factura:", err);
                    // 🔁 si falla, permite reintentar
                    setIsProcessingFactura(false);
                  }
                }}
                style={{
                  opacity: isProcessingFactura ? 0.6 : 1,
                  cursor: isProcessingFactura ? "not-allowed" : "pointer",
                }}
              >
                {isProcessingFactura ? "Procesando..." : "Emitir Factura"}
              </button>
              <button onClick={() => setMostrarFacturaModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        <h1 className="titulo-mesa--mesadetalles">Mesa {mesa.numero}</h1>
        <p className="total-mesa--mesadetalles">Total: {mesa.total} €</p>
        <ListaPedidos
          pedidos={mesa.pedidos || []}
          productosDetalles={productosDetalles}
          eliminarProducto={eliminarProducto}
          setAccionModal={setAccionModal}
          setMostrarModalConfirmacion={setMostrarModalConfirmacion}
          solicitarProducto={solicitarProducto}
        />

        <ListaBebidas
          pedidosBebidas={mesa.pedidosBebidas || []}
          eliminarProducto={eliminarProducto}
          setAccionModal={setAccionModal}
          setMostrarModalConfirmacion={setMostrarModalConfirmacion}
        />

        {mesa.estado === "abierta" && (
          <>
            <button
              onClick={() => setShowModal("cierre")}
              className="boton-cerrar--mesadetalles"
              disabled={(mesa.pedidos?.length === 0) && (mesa.pedidosBebidas?.length === 0)}
            >
              Cerrar Mesa
            </button>

            <div className="contenedor-botones--mesadetalles">
              <button
                onClick={imprimirCuenta}
                className="boton-imprimir--mesadetalles"
                disabled={(mesa.pedidos?.length === 0) && (mesa.pedidosBebidas?.length === 0)}
              >
                Cuenta
              </button>
              <button
                onClick={() => setShowModal("factura")}
                className="boton-factura--mesadetalles"
                disabled={(mesa.pedidos?.length === 0) && (mesa.pedidosBebidas?.length === 0)}
              >
                Factura
              </button>
              <button
                onClick={() => setMostrarModalTransferir(true)}
                className="boton-factura--mesadetalles"
                disabled={(mesa.pedidos?.length === 0) && (mesa.pedidosBebidas?.length === 0)}
              >
                Transferir Artículos
              </button>
            </div>
          </>
        )}

        {(showModal === "cierre" || showModal === "factura") && (
          <MetodoPago
            total={mesa.total}
            onClose={() => setShowModal(false)}
            onConfirm={(metodoPago) => {
              if (showModal === "factura") {
                setMetodoPagoFactura(metodoPago);
                setShowModal(false);
                setMostrarFacturaModal(true); // Abre el modal de datos fiscales
              } else {
                cerrarMesa(metodoPago, "simplificada", {}, user?.name || user?.email || "");
              }
            }}
          />
        )}
      </div>
      {
        mensajeAlerta && (
          <AlertaMensaje
            tipo={mensajeAlerta.tipo}
            mensaje={mensajeAlerta.mensaje}
            onClose={() => setMensajeAlerta(null)}
          />
        )
      }

      {
        mostrarModalTransferir && (
          <ModalTransferencia
            mesaOrigen={mesa}
            onClose={() => setMostrarModalTransferir(false)}
            onTransferSuccess={() => {
              setMostrarModalTransferir(false);
              fetchMesa(); // Refresca la mesa después de transferir
            }}
          />
        )
      }

      {mostrarModalConfirmacion && (
        <ModalConfirmacion
          titulo={accionModal?.titulo}
          mensaje={accionModal?.mensaje}
          onConfirm={() => {
            accionModal?.onConfirm();
            setMostrarModalConfirmacion(false);
          }}
          onClose={() => setMostrarModalConfirmacion(false)}
        />
      )}

    </div >
  );
};

export default DetalleMesa;
