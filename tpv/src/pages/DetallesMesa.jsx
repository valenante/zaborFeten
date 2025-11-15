import React, { useState, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MetodoPago from "../components/DetallesMesa/MetodoPago";
import RightBar from "../components/RightBar/RightBar";
import { SocketContext } from "../utils/socket";
import useMesa from "../hooks/useMesa";
import usePedidos from "../hooks/usePedidos";
import { RightBarProvider, useRightBarContext } from "../context/RightBarContext";
import { useLeaveProtection } from "../hooks/useLeaveProtection";
import useAccionesMesa from "../hooks/useAccionesMesa";
import { useMesaActions } from "../hooks/useMesaActions";
import { useAuth } from "../context/AuthContext";
import "../styles/DetallesMesa.css";
import AlertaMensaje from "../components/AlertaMensaje/AlertaMensaje";
import ModalTransferencia from "../components/Modal/ModalTransferencia";
import ModalConfirmacion from "../components/Modal/ModalConfirmacion";
import ModalSalirCarrito from "../components/Modal/ModalSalirCarrito";
import ListaPedidos from "../components/DetallesMesa/ListaPedidos";
import ListaBebidas from "../components/DetallesMesa/ListaBebidas";
import api from "../utils/api";
import { error } from "../utils/logger";

// ======================================================
//  WRAPPER PRINCIPAL
// ======================================================

const DetalleMesa = () => {
  const { id } = useParams();
  const { socket } = useContext(SocketContext);
  const { mesa, setMesa, productosDetalles, fetchMesa } = useMesa(id, socket);


  if (!mesa) return <p className="cargando--mesadetalles">Cargando...</p>;

  return (
    <RightBarProvider mesaId={mesa._id}>
      <ContenidoMesa
        mesa={mesa}
        setMesa={setMesa}
        productosDetalles={productosDetalles}
        fetchMesa={fetchMesa}
      />
    </RightBarProvider>
  );
};

// ======================================================
//  CONTENIDO PRINCIPAL
// ======================================================

const ContenidoMesa = ({ mesa, setMesa, productosDetalles, fetchMesa }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { carrito, carritoBebidas, mostrarResumen } = useRightBarContext();

  // ---------------------
  // BLOQUEO SALIDA
  // ---------------------
  const hayCarrito =
    carrito.length > 0 || carritoBebidas.length > 0 || mostrarResumen;

  const [modalSalir, setModalSalir] = useState(false);
  const [accionARealizar, setAccionARealizar] = useState(null);

  const onTryLeave = useCallback((cb) => {
    setAccionARealizar(() => cb);
    setModalSalir(true);
  }, []);

  useLeaveProtection(hayCarrito, onTryLeave);

  // ---------------------
  // PEDIDOS
  // ---------------------
  const { agregarProducto, eliminarProducto, mensajeAlerta, setMensajeAlerta } =
    usePedidos(mesa, setMesa);

  const { cerrarMesa, emitirFactura, imprimirCuenta } =
    useAccionesMesa(mesa, setMensajeAlerta, navigate);

  // ---------------------
  // ACCIONES DE MESA
  // ---------------------
  const mesaActions = useMesaActions({
    mesa,
    setMesa,
    setMensajeAlerta,
    fetchMesa,
  });

  const {
    mostrarTransferir,
    setMostrarTransferir,
    mostrarModalAccion,
    setMostrarModalAccion,
    accionModal,
    setAccionModal,
    handleSelect,
  } = mesaActions;

  // ---------------------
  // OTROS ESTADOS
  // ---------------------
  const [vista, setVista] = useState("platos");
  const [showModal, setShowModal] = useState(false);
  const [mostrarFacturaModal, setMostrarFacturaModal] = useState(false);
  const [metodoPagoFactura, setMetodoPagoFactura] = useState(null);

  return (
    <div className="detalle-mesa--mesadetalles">
      {/* MODAL SALIR */}
      {modalSalir && (
        <ModalSalirCarrito
          onCancel={() => setModalSalir(false)}
          onConfirm={() => (accionARealizar ? accionARealizar() : window.history.back())}
        />
      )}

      {/* RIGHTBAR */}
      <div className="rightbar--mesadetalles">
        <RightBar mesaId={mesa._id} agregarProducto={agregarProducto} />
      </div>

      {/* CONTENIDO */}
      <div className="contenido-mesa--mesadetalles">
        <h1 className="titulo-mesa--mesadetalles">Mesa {mesa.numero}</h1>
        <p className="total-mesa--mesadetalles">Total: {mesa.total} €</p>

        <div className="toggle-vista--mesadetalles">
          <button
            className={vista === "platos" ? "boton-toggle activo" : "boton-toggle"}
            onClick={() => setVista("platos")}
          >
            Platos
          </button>
          <button
            className={vista === "bebidas" ? "boton-toggle activo" : "boton-toggle"}
            onClick={() => setVista("bebidas")}
          >
            Bebidas
          </button>
        </div>

        {vista === "platos" && (
          <ListaPedidos
            pedidos={mesa.pedidos}
            productosDetalles={productosDetalles}
            eliminarProducto={eliminarProducto}
            setAccionModal={setMostrarModalAccion}
            solicitarProducto={() => { }}
            setMesa={setMesa}
          />
        )}

        {vista === "bebidas" && (
          <ListaBebidas
            pedidosBebidas={mesa.pedidosBebidas}
            eliminarProducto={eliminarProducto}
            setAccionModal={setMostrarModalAccion}
            solicitarProducto={() => { }}
            productosDetalles={productosDetalles}
            setMesa={setMesa}
          />
        )}

        {/* ------------------------------ */}
        {/*       SELECT DE ACCIONES       */}
        {/* ------------------------------ */}

        {mesa.estado === "abierta" && (
          <>


            <div className="contenedor-botones--mesadetalles">
              
              <button onClick={() => imprimirCuenta()} className="boton-imprimir--mesadetalles">
                Cuenta
              </button>

              <button onClick={() => setShowModal("factura")} className="boton-factura--mesadetalles">
                Factura
              </button>

              <select
                className="selector-acciones-mesa"
                value=""
                onChange={(e) => handleSelect(e.target.value)}
              >
                <option value="">Acciones…</option>
                <option value="transferir">Transferir artículos</option>
                <option value="comensales">Modificar comensales</option>
              </select>

              <button
                className="boton-cerrar--mesadetalles"
                onClick={() => {
                  // Si la mesa no tiene pedidos → cerrar sin consumo
                  if ((mesa.pedidos?.length ?? 0) === 0 && (mesa.pedidosBebidas?.length ?? 0) === 0) {
                    setMostrarModalAccion(true);
                    setMostrarModalAccion(true);
                    setMostrarModalAccion(true);
                    setMostrarModalAccion(true);
                  }

                  if ((mesa.pedidos?.length ?? 0) === 0 && (mesa.pedidosBebidas?.length ?? 0) === 0) {
                    setMostrarModalAccion(true);
                    setMostrarModalAccion(true);

                    setMostrarModalAccion(true);
                  }

                  // → versión FINAL
                  if ((mesa.pedidos?.length ?? 0) === 0 && (mesa.pedidosBebidas?.length ?? 0) === 0) {
                    setMostrarModalAccion(true);
                    setAccionModal({
                      titulo: "Cerrar mesa sin consumo",
                      mensaje: "La mesa está vacía. ¿Deseas cerrarla igualmente?",
                      onConfirm: () => cerrarMesa({ tipo: "sinConsumo" }, "simplificada", {}, user?.name),
                    });
                    return;
                  }

                  // Si sí tiene pedidos → abre modal de selección de método de pago
                  setShowModal("cierre");
                }}
              >
                Cerrar Mesa
              </button>
            </div>

            {(showModal === "cierre") && (
              <MetodoPago
                total={mesa.total}
                onClose={() => setShowModal(false)}
                onConfirm={(metodoPago) => {
                  cerrarMesa(metodoPago, "simplificada", {}, user?.name);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* ------------------------------ */}
      {/* MODALES REALES */}
      {/* ------------------------------ */}

      {mostrarTransferir && (
        <ModalTransferencia
          mesaOrigen={mesa}
          onClose={() => setMostrarTransferir(false)}
          onTransferSuccess={() => {
            setMostrarTransferir(false);
            fetchMesa();
          }}
        />
      )}

      {mostrarModalAccion && (
        <ModalConfirmacion
          titulo={accionModal?.titulo}
          mensaje={accionModal?.mensaje}
          placeholder={accionModal?.placeholder}
          onConfirm={(valor) => {
            accionModal?.onConfirm(valor);
            setMostrarModalAccion(false);
          }}
          onClose={() => setMostrarModalAccion(false)}
        />
      )}


      {mensajeAlerta && (
        <AlertaMensaje tipo={mensajeAlerta.tipo} mensaje={mensajeAlerta.mensaje} onClose={() => setMensajeAlerta(null)} />
      )}
    </div>
  );
};

export default DetalleMesa;
