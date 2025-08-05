import React, { useState, useEffect } from 'react';
import { useContext } from "react";
import api from '../../utils/api';
import { SocketContext } from "../../utils/socket";
import PedidosFinalizados from './PedidosFinalizados';
import * as logger from '../../utils/logger';
import { useAuth } from "../../context/AuthContext";
import './Cocina.css';

const Cocina = () => {
  const [pedidos, setPedidos] = useState([]);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [productoSeleccionado] = useState(null);
  const { socket } = useContext(SocketContext);
  const [mesas, setMesas] = useState([]);
  const { logout } = useAuth();
  const [resumenProductos, setResumenProductos] = useState([]);
  const [mostrarResumen, setMostrarResumen] = useState(false);

  const cargarMesas = async () => {
    try {
      const response = await api.get('/mesas/mesas-abiertas/mesas-abiertas');
      setMesas(response.data);
    } catch (error) {
      logger.error('Error al cargar mesas:', error);
    }
  };

  const calcularTiempoTranscurrido = (fecha) => {
    const ahora = new Date();
    const fechaPedido = new Date(fecha);
    const diferencia = Math.floor((ahora - fechaPedido) / 60000);
    return `${diferencia}m`;
  };

  const calcularResumenProductos = (listaPedidos) => {
    const resumen = {};

    listaPedidos.forEach(pedido => {
      pedido.productos
        .filter(p => p.estadoPreparacion !== 'listo' && ['plato', 'tapaRacion'].includes(p.tipo))
        .forEach(p => {
          const nombre = p.producto?.nombre || 'Producto';
          const tipo = p.tipoPrecio || 'base';
          const key = `${nombre} (${tipo})`;

          resumen[key] = (resumen[key] || 0) + p.cantidad;
        });
    });

    const resumenArray = Object.entries(resumen).map(([nombre, cantidad]) => ({ nombre, cantidad }));
    setResumenProductos(resumenArray);
  };


  const cargarPedidos = async () => {
    try {
      const response = await api.get('/pedidos/pendientes/pendientes', {
        params: { tipo: ['plato', 'tapaRacion'] },
      });
      setPedidos(response.data);
      calcularResumenProductos(response.data);
    } catch (error) {
      logger.error('Error al cargar pedidos:', error);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const manejarNuevoPedido = () => {
      cargarPedidos();
    };

    socket.on("nuevoPedido", manejarNuevoPedido);

    return () => {
      socket.off("nuevoPedido", manejarNuevoPedido);
    };
  }, [socket]); // 👈 importante agregar socket como dependencia  

  const marcarProductoComoListo = async (pedidoId, productoId) => {
    try {
      await api.put(`/pedidos/${pedidoId}/producto/${productoId}`, { estadoPreparacion: 'listo' });
      cargarPedidos();
    } catch (error) {
      logger.error('Error al marcar producto como listo:', error);
    }
  };

  const marcarPedidoComoListo = async (pedidoId) => {
    try {
      await api.put(`/pedidos/${pedidoId}`, { estado: 'listo' });
      cargarPedidos();
    } catch (error) {
      logger.error('Error al marcar pedido como listo:', error);
    }
  };

  useEffect(() => {
    cargarPedidos();
    cargarMesas();
    const interval = setInterval(() => {
      cargarPedidos();
      cargarMesas();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getComensalesMesa = (numeroMesa) => {
    const mesa = mesas.find(m => m.numero === numeroMesa);
    return mesa?.comensales || 1;
  };

  const getComensalesPedido = (pedido) => {
    return pedido.comensales && pedido.comensales > 0
      ? pedido.comensales
      : getComensalesMesa(pedido.mesa.numero);
  };

  const agruparPorSeccion = (productos) => {
    const agrupados = {
      entrante: [],
      medio: [],
      final: [],
      sinSeccion: [], // Para casos donde no esté definido
    };

    productos.forEach((producto) => {
      const seccion = producto.seccion || 'sinSeccion';
      if (agrupados[seccion]) {
        agrupados[seccion].push(producto);
      } else {
        agrupados.sinSeccion.push(producto);
      }
    });

    return agrupados;
  };

  return (
    <>
      <div className="cocina--cocina">
        <div className="cocina-header">
          <button onClick={logout} className="boton-cerrar--cocina">
            Cerrar Sesión
          </button>
        </div>

        <h1 className="titulo--cocina">Pedidos Pendientes</h1>

        <button onClick={() => setMostrarFinalizados(true)} className="boton-finalizados--cocina">
          Ver Pedidos Finalizados
        </button>

        {mostrarFinalizados && <PedidosFinalizados onClose={() => setMostrarFinalizados(false)} />}

        {pedidos.length === 0 ? (
          <p className="mensaje-vacio--cocina">No hay pedidos pendientes</p>
        ) : (
          <div className="pedidos-container--cocina">
            {pedidos.map((pedido) => {
              const todosProductosListos = pedido.productos
                .filter((producto) => ['plato', 'tapaRacion'].includes(producto.tipo))
                .every((producto) => producto.estadoPreparacion === 'listo');

              const productosAgrupados = agruparPorSeccion(
                pedido.productos.filter((producto) => ['plato', 'tapaRacion'].includes(producto.tipo))
              );

              return (
                <div key={pedido._id} className="pedido-card--cocina">
                  <div className="pedido-header--cocina">
                    <h3>Mesa {pedido.mesa.numero}</h3>
                    <p>{getComensalesPedido(pedido)} comensales</p>
                  </div>
                  <p><strong>Hace:</strong> {calcularTiempoTranscurrido(pedido.fecha)}</p>

                  {(['entrante', 'medio', 'final'].some(seccion => productosAgrupados[seccion]?.length > 0))
                    ? ['entrante', 'medio', 'final'].map(seccion =>
                      productosAgrupados[seccion]?.length > 0 && (
                        <div key={seccion} className="seccion-pedido--cocina">
                          <h4 className="seccion-titulo--cocina">{seccion.toUpperCase()}</h4>
                          <ul className="productos-list--cocina">
                            {productosAgrupados[seccion].map((producto) => (
                              <li key={producto._id} className="producto-item--cocina">
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={producto.estadoPreparacion === 'listo'}
                                    onChange={() => marcarProductoComoListo(pedido._id, producto._id)}
                                  />
                                  <span style={{ color: producto.tipoPlato === 'individual' ? 'green' : 'purple' }}>
                                    {producto.cantidad}x {producto.tipoPrecio !== 'precioBase' && `${producto.tipoPrecio} `}
                                    {producto.producto?.nombre || 'Producto no disponible'}
                                  </span>
                                </label>
                                {producto.adicionales.length > 0 && <p>{producto.adicionales.map(ad => ad.nombre).join(', ')}</p>}
                                {producto.alergiasComensal && <p className="alergias-individual--cocina"><strong>A:</strong> {producto.alergiasComensal}</p>}
                                {producto.tipoCroqueta && <p className="tipo-croqueta">{producto.tipoCroqueta}</p>}
                                {producto.sabor?.length > 0 && (
                                  <ul>{producto.sabor.map((s, i) => <li key={i}>{s.cantidad}x {s.ingrediente}</li>)}</ul>
                                )}
                                {producto.ingredientesEliminados.length > 0 && (
                                  <p><strong>Sin:</strong> {producto.ingredientesEliminados.join(', ')}</p>
                                )}
                                {producto.especificaciones.length > 0 && (
                                  <p><strong>Especificaciones:</strong> {producto.especificaciones.join(', ')}</p>
                                )}
                                {producto.mensaje && <p className="mensaje-producto--cocina">{producto.mensaje}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    : (
                      <div className="seccion-pedido--cocina">
                        <h4 className="seccion-titulo--cocina">PRODUCTOS</h4>
                        <ul className="productos-list--cocina">
                          {pedido.productos.map((producto) => (
                            <li key={producto._id} className="producto-item--cocina">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={producto.estadoPreparacion === 'listo'}
                                  onChange={() => marcarProductoComoListo(pedido._id, producto._id)}
                                />
                                <span style={{ color: producto.tipoPlato === 'individual' ? 'green' : 'purple' }}>
                                  {producto.cantidad}x {producto.tipoPrecio !== 'precioBase' && `${producto.tipoPrecio} `}
                                  {producto.producto?.nombre || 'Producto no disponible'}
                                </span>
                              </label>
                              {producto.adicionales.length > 0 && <p>{producto.adicionales.map(ad => ad.nombre).join(', ')}</p>}
                              {producto.alergiasComensal && <p className="alergias-individual--cocina"><strong>A:</strong> {producto.alergiasComensal}</p>}
                              {producto.tipoCroqueta && <p className="tipo-croqueta">{producto.tipoCroqueta}</p>}
                              {producto.sabor?.length > 0 && (
                                <ul>{producto.sabor.map((s, i) => <li key={i}>{s.cantidad}x {s.ingrediente}</li>)}</ul>
                              )}
                              {producto.ingredientesEliminados.length > 0 && (
                                <p><strong>Sin:</strong> {producto.ingredientesEliminados.join(', ')}</p>
                              )}
                              {producto.especificaciones.length > 0 && (
                                <p><strong>Especificaciones:</strong> {producto.especificaciones.join(', ')}</p>
                              )}
                              {producto.mensaje && <p className="mensaje-producto--cocina">{producto.mensaje}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  <button
                    onClick={() => marcarPedidoComoListo(pedido._id)}
                    disabled={!todosProductosListos}
                    className="boton-terminar--cocina"
                  >
                    Terminar Pedido
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Botón flotante del resumen */}
      <button
        onClick={() => setMostrarResumen(true)}
        className="boton-resumen--cocina"
        title="Ver resumen de productos pendientes"
      >
        📋
      </button>

      {/* Panel lateral del resumen */}
      {mostrarResumen && (
        <div className="resumen-panel--cocina">
          <div className="resumen-header--cocina">
            <h3>Resumen de Productos Pendientes</h3>
            <button onClick={() => setMostrarResumen(false)}>✕</button>
          </div>
          <ul>
            {resumenProductos.map((item, i) => (
              <li key={i}><strong>{item.cantidad}x</strong> {item.nombre}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default Cocina;
