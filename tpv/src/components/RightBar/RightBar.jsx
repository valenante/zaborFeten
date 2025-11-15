import ProductoDetalle from "./ProductoDetalle.jsx";
import { useRightBarContext } from "../../context/RightBarContext";
import AlertaMensaje from "../AlertaMensaje/AlertaMensaje";
import ModalProductosCategoria from "../ModalProductosCategoria/ModalProductosCategoria";
import CarritoOrganizable from "../CarritoOrganizable/CarritoOrganizable";
import "./RightBar.css";

const RightBar = () => {

  const {
    tipo, setTipo,
    categoriaSeleccionada, setCategoriaSeleccionada,
    productoSeleccionado, showModal,
    abrirModal, cerrarModal,
    agregarAlCarrito,

    carrito, setCarrito,
    carritoBebidas, setCarritoBebidas,

    enviarPedido,
    mensajeAlerta, setMensajeAlerta,
    isLoading,

    mostrarResumen, setMostrarResumen,

    categories, handleClickCategoria,
    mostrarModalCategoria, setMostrarModalCategoria,
    productosCategoriaActual,
    productosYaPedidos,

    mensajesSeccion, setMensajesSeccion,
  } = useRightBarContext();

  return (
    <div className="right-bar--rightbar">

      {/* Selección Plato/Bebida */}
      <div className="filtros-tipo--rightbar">
        <button
          onClick={() => setTipo("plato")}
          className={`boton-tipo--rightbar ${tipo === "plato" ? "activo--rightbar" : ""}`}
        >
          Platos
        </button>
        <button
          onClick={() => setTipo("bebida")}
          className={`boton-tipo--rightbar ${tipo === "bebida" ? "activo--rightbar" : ""}`}
        >
          Bebidas
        </button>
      </div>

      {/* Categorías */}
      <div className="categorias--rightbar">
        <ul className="lista-categorias--rightbar">
          {categories.map((categoria) => (
            <li
              key={categoria}
              className={`categoria--rightbar ${categoria === categoriaSeleccionada ? "seleccionada--rightbar" : ""}`}
              onClick={() => handleClickCategoria(categoria)}
            >
              {categoria}
            </li>
          ))}
        </ul>
      </div>

      {/* botón para abrir resumen */}
      <button
        className="boton-toggle-resumen"
        onClick={() => setMostrarResumen(!mostrarResumen)}
      >
        📋
      </button>

      {/* Modal detalle producto */}
      {showModal && productoSeleccionado && (
        <ProductoDetalle
          producto={productoSeleccionado}
          cerrarModal={cerrarModal}
          seleccionPrecio={productoSeleccionado.precioSeleccionado}
          onConfirm={agregarAlCarrito}
        />
      )}

      {/* Modal productos categoría */}
      {mostrarModalCategoria && (
        <ModalProductosCategoria
          categoria={categoriaSeleccionada}
          productos={productosCategoriaActual}
          productosPedidoMesa={productosYaPedidos}
          onClose={() => setMostrarModalCategoria(false)}
          onProductoClick={(producto) => {
            setMostrarModalCategoria(false);
            abrirModal(producto);
          }}
        />
      )}

      {/* RESUMEN DEL CARRITO */}
      {mostrarResumen && (
        <div className="resumen-overlay">
          <div className="resumen-pedido-panel">

            {/* Cabecera */}
            <div className="resumen-header">
              <button className="cerrar-modal" onClick={() => setMostrarResumen(false)}>
                ↩
              </button>
            </div>

            {/* Contenido */}
            <div className="resumen-contenido">
              <CarritoOrganizable
                carrito={[
                  ...carrito.map(p => ({ ...p, tipo: p.tipo || "plato" })),
                  ...carritoBebidas.map(b => ({ ...b, tipo: "bebida", seccion: "bebidas" }))
                ]}
                setCarrito={(update) => {
                  const aplicarActualizacion = (prevPlatos, prevBebidas) => {
                    const combinado = Array.isArray(update)
                      ? update
                      : update([...prevPlatos, ...prevBebidas]);

                    const soloPlatos = combinado.filter(i => i.tipo !== "bebida");
                    const soloBebidas = combinado.filter(i => i.tipo === "bebida");

                    setCarrito(soloPlatos);
                    setCarritoBebidas(soloBebidas);
                  };

                  aplicarActualizacion(carrito, carritoBebidas);
                }}
                enviarPedido={enviarPedido}
                isLoading={isLoading}
                mensajesSeccion={mensajesSeccion}
                setMensajesSeccion={setMensajesSeccion}
              />
            </div>

            {/* Footer */}
            <div className="resumen-footer">
              <button
                onClick={async () => {
                  const exito = await enviarPedido();
                  if (exito) setMostrarResumen(false);
                }}
                disabled={isLoading}
                className="carrito-enviar-button"
              >
                {isLoading ? "Enviando..." : "Enviar Pedido"}
              </button>
            </div>

          </div>
        </div>
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

export default RightBar;
