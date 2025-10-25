import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import api from "../../utils/api";
import * as logger from '../../utils/logger';
import "./ProductoDetalle.css";

const ProductoDetalle = ({
  producto,
  cerrarModal,
  onConfirm,
  seleccionPrecioInicial,
  modoEdicion
}) => {
  const [cantidad, setCantidad] = useState(1);
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState([
    ...producto.ingredientes,
  ]);
  const [opcionesSeleccionadas, setOpcionesSeleccionadas] = useState({});
  const [acompanante, setAcompanante] = useState("");
  const [mensajeProducto, setMensajeProducto] = useState("");
  const [acompanantesDisponibles, setAcompanantesDisponibles] = useState([]);
  const [tipoPrecio, setTipoPrecio] = useState(
    producto.tipoPrecio || "precioBase"
  );
  const [extrasDisponibles, setExtrasDisponibles] = useState([]);
  const [extrasSeleccionados, setExtrasSeleccionados] = useState([]);

  const [precioSeleccionado, setPrecioSeleccionado] = useState(() => {
    const inicial =
      typeof seleccionPrecioInicial === "number"
        ? seleccionPrecioInicial
        : producto.precios[producto.tipoPrecio || "precioBase"];
    return typeof inicial === "number" && !isNaN(inicial) ? inicial : 0;
  });

  const categoriasConAcompanante = [
    "vodka",
    "ron",
    "whisky",
    "ginebra",
    "gin",
    "licor",
    "licores",
    "brandy",
  ];

  useEffect(() => {
    let initialTipo = "precioBase";
    let initialPrecio = 0;

    if (producto.categoria.toLowerCase().includes("vino")) {
      if (producto.precios.copa !== null && producto.precios.copa >= 0) {
        initialTipo = "copa";
        initialPrecio = producto.precios.copa;
      } else if (
        producto.precios.botella !== null &&
        producto.precios.botella >= 0
      ) {
        initialTipo = "botella";
        initialPrecio = producto.precios.botella;
      }
    } else {
      const precios = producto.precios;
      const prioridades = ["tapa", "racion", "surtido", "precioBase"];
      for (let key of prioridades) {
        if (precios[key] !== null && precios[key] >= 0) {
          initialTipo = key;
          initialPrecio = precios[key];
          break;
        }
      }
    }

    setTipoPrecio(initialTipo);
    setPrecioSeleccionado(initialPrecio);
  }, [producto]);

  useEffect(() => {
    // Actualiza el precio seleccionado cada vez que cambia el tipoPrecio
    const precio = producto.precios[tipoPrecio];
    if (typeof precio === "number" && !isNaN(precio)) {
      setPrecioSeleccionado(precio);
    }
  }, [tipoPrecio, producto.precios]);

  useEffect(() => {
    const cargarAcompanantes = async () => {
      try {
        const res = await api.get("/productos");
        const categoriasValidas = [
          "refrescos",
          "aguas",
          "gaseosas",
          "zumos",
          "jugos",
        ];
        const filtrados = res.data.filter(
          (p) =>
            p.tipo === "bebida" &&
            categoriasValidas.includes(p.categoria.toLowerCase())
        );
        const nombres = [...new Set(filtrados.map((p) => p.nombre))];
        setAcompanantesDisponibles(nombres);
      } catch (error) {
        logger.error("Error al cargar acompañantes:", error);
      }
    };

    cargarAcompanantes();
  }, []);

  useEffect(() => {
    const cargarExtras = async () => {
      try {
        const res = await api.get("/extras");
        setExtrasDisponibles(res.data);
      } catch (error) {
        logger.error("Error al cargar extras:", error);
      }
    };

    cargarExtras();
  }, []);

  const manejarCantidad = (inc) =>
    setCantidad((prev) => Math.max(1, prev + inc));

  const confirmarProducto = () => {
    const adicionalesSeleccionados = producto.adicionales
      ?.filter((_, index) => opcionesSeleccionadas[`adicional_${index}`])
      .map((a) => ({ nombre: a.nombre, precio: a.precio })) || [];

    const totalAdicionales = adicionalesSeleccionados.reduce(
      (acc, a) => acc + a.precio,
      0
    );

    const totalExtras = extrasSeleccionados.reduce((acc, e) => acc + e.precio, 0);

    const productoPersonalizado = {
      ...producto,
      cantidad,
      precioSeleccionado: precioSeleccionado + totalAdicionales + totalExtras,
      tipoPrecio,
      acompanante,
      opciones: opcionesSeleccionadas,
      mensaje: mensajeProducto,
      adicionales: adicionalesSeleccionados, // Guardamos los adicionales seleccionados
      extras: extrasSeleccionados, // Guardamos los extras seleccionados
    };

    onConfirm(productoPersonalizado);
  };

  return ReactDOM.createPortal(
    <div className="modal-detalle--productoDetalle">
      <div className="modal-contenido--productoDetalle">
        <h2 className="titulo-modal--productoDetalle">
          {producto.nombre}
        </h2>
        <div>
          <button onClick={() => manejarCantidad(-1)}>-</button>
          <span>{cantidad}</span>
          <button onClick={() => manejarCantidad(1)}>+</button>
        </div>

        {producto.categoria.toLowerCase().includes("vino") ? (
          <select
            className="select-precio--productoDetalle"
            value={tipoPrecio}
            onChange={(e) => setTipoPrecio(e.target.value)}
          >
            {producto.precios.copa !== null && (
              <option value="copa">Copa - {producto.precios.copa} €</option>
            )}
            {producto.precios.botella !== null && (
              <option value="botella">Botella - {producto.precios.botella} €</option>
            )}
          </select>
        ) : (
          Object.entries(producto.precios).some(([_, val]) => typeof val === "number") && (
            <select
              className="select-precio--productoDetalle"
              value={tipoPrecio}
              onChange={(e) => setTipoPrecio(e.target.value)}
            >
              {Object.entries(producto.precios).map(([key, val]) => {
                if (typeof val === "number") {
                  return (
                    <option key={key} value={key}>
                      {key.charAt(0).toUpperCase() + key.slice(1)} - {val} €
                    </option>
                  );
                }
                return null;
              })}
            </select>
          )
        )}

        {producto.tipo === "bebida" &&
          categoriasConAcompanante.includes(producto.categoria.toLowerCase()) && (
            <select
              className="select-acompanante--productoDetalle"
              value={acompanante}
              onChange={(e) => setAcompanante(e.target.value)}
            >
              <option value="">Selecciona un acompañante</option>
              {acompanantesDisponibles.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
              <option value="Sin acompañante">Sin acompañante</option>
            </select>
          )}

        {producto.adicionales && producto.adicionales.length > 0 && (
          <>
            <ul>
              {producto.adicionales.map((adicional, index) => (
                <li key={index}>
                  <label>
                    <input
                      type="checkbox"
                      checked={opcionesSeleccionadas[`adicional_${index}`] || false}
                      onChange={(e) =>
                        setOpcionesSeleccionadas((prev) => ({
                          ...prev,
                          [`adicional_${index}`]: e.target.checked,
                        }))
                      }
                    />
                    {adicional.nombre} (+{adicional.precio} €)
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <select onChange={e => {
          const extraId = e.target.value;
          const extra = extrasDisponibles.find(e => e._id === extraId);
          if (extra && !extrasSeleccionados.some(e => e._id === extraId)) {
            setExtrasSeleccionados(prev => [...prev, extra]);
          }
        }}>
          <option value="">Selecciona un extra</option>
          {extrasDisponibles.map(extra => (
            <option key={extra._id} value={extra._id}>
              {extra.nombre} (+{extra.precio} €)
            </option>
          ))}
        </select>

        <ul className="lista-extras-seleccionados">
          {extrasSeleccionados.map((extra) => (
            <li key={extra._id}>
              {extra.nombre} (+{extra.precio} €)
              <button onClick={() =>
                setExtrasSeleccionados(prev => prev.filter(e => e._id !== extra._id))
              }>
                Quitar
              </button>
            </li>
          ))}
        </ul>

        <textarea
          placeholder="Mensaje para cocina/barra sobre este producto (opcional)"
          value={mensajeProducto}
          onChange={(e) => setMensajeProducto(e.target.value)}
          className="mensaje-producto-textarea"
        />

        <div className="modal-botones--productoDetalle">
          <button
            className="boton-cancelar--productoDetalle"
            onClick={cerrarModal}
          >
            Cancelar
          </button>
          <button
            className="boton-agregar--productoDetalle"
            onClick={confirmarProducto}
          >
            {modoEdicion ? "Guardar cambios" : "Agregar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProductoDetalle;
