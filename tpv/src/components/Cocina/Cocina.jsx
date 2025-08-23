import React, { useState, useEffect } from 'react';
import { useContext } from "react";
import api from '../../utils/api';
import { SocketContext } from "../../utils/socket";
import PedidosFinalizados from './PedidosFinalizados';
import * as logger from '../../utils/logger';
import { useAuth } from "../../context/AuthContext";
import { useLecturaVoz } from '../../hooks/useLecturaVoz';
import { useReconocimientoVoz, extraerNumeroMesa } from '../../hooks/useReconocimientoVoz';
import { parseCocinaCommand } from '../../Voice/intentsCocina';


import './Cocina.css';

// Helpers de formateo local (para consultas por voz)
const _limpiar = (s) => (s ?? "").toString().trim();
const _juntar = (arr, prop = "nombre") =>
  (arr || []).map(x => (prop ? _limpiar(x?.[prop]) : _limpiar(x))).filter(Boolean).join(", ");
const _artCant = (n) => (Number(n) === 1 ? "un" : String(n));
const _labelTipoPrecio = (tp) => {
  const t = (tp || "").toLowerCase();
  if (!t || t === "preciobase" || t === "base" || t === "precio base") return "";
  const mapa = { tapa: "tapa", racion: "ración", media: "media", surtido: "surtido" };
  return mapa[t] || t;
};
const formatearProductoCliente = (pr) => {
  const cant = _artCant(pr.cantidad);
  const nombre = pr.producto?.nombre || "Producto";
  const tp = _labelTipoPrecio(pr.tipoPrecio);
  const conExtras = [_juntar(pr.adicionales), _juntar(pr.extras)].filter(Boolean).join(", ");
  const sinIngr = _juntar(pr.ingredientesEliminados, null);
  const nota = _limpiar(pr.mensaje);
  const tipoPlatoTxt =
    pr.tipoPlato === "individual" ? "individual" :
      pr.tipoPlato === "compartir" ? "para compartir" : "";

  return [
    `${cant} ${nombre}`,
    tp,
    tipoPlatoTxt,
    conExtras ? `con ${conExtras}` : "",
    sinIngr ? `sin ${sinIngr}` : "",
    nota ? `nota: ${nota}` : "",
  ].filter(Boolean).join(", ");
};

// Busca el pedido pendiente por número de mesa
const findPedidoPendienteByMesa = (pedidos, mesaNum) =>
  pedidos.find(p => p.mesa?.numero === mesaNum && p.estado !== 'listo');

// Genera texto de resumen (top productos pendientes)
const resumenPendientesTexto = (pedidos) => {
  const conteo = {};
  pedidos.forEach(p => {
    p.productos
      .filter(pr => ['plato', 'tapaRacion'].includes(pr.tipo) && pr.estadoPreparacion !== 'listo')
      .forEach(pr => {
        const nombre = pr.producto?.nombre || 'Producto';
        const key = `${nombre} ${pr.tipoPrecio || ''}`.trim();
        conteo[key] = (conteo[key] || 0) + pr.cantidad;
      });
  });
  const items = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `${v === 1 ? 'un' : v} ${k}`);
  return items.length ? items.join('. ') : 'No hay productos pendientes.';
};

// Busca producto por índice 1‑based o por nombre aproximado
const findProductoPendienteEnPedido = (pedido, { idx, nombre }) => {
  const lista = pedido.productos
    .filter(pr => ['plato', 'tapaRacion'].includes(pr.tipo) && pr.estadoPreparacion !== 'listo');

  if (idx != null) {
    const i = idx - 1;
    return (i >= 0 && i < lista.length) ? lista[i] : null;
  }
  if (nombre) {
    const n = nombre.trim();
    // match contiene el nombre del producto
    return lista.find(pr => (pr.producto?.nombre || '').toLowerCase().includes(n));
  }
  return null;
};

const Cocina = () => {
  const [pedidos, setPedidos] = useState([]);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [productoSeleccionado] = useState(null);
  const { socket } = useContext(SocketContext);
  const [mesas, setMesas] = useState([]);
  const { logout } = useAuth();
  const [resumenProductos, setResumenProductos] = useState([]);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const { habilitado, activar, encolarLectura, silenciar } = useLecturaVoz(1, 8000);
  const { activo, iniciarContinua, detenerContinua, onResultado, onFin, onError, soportado } = useReconocimientoVoz({ idioma: "es-ES" });

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

    const manejarNuevoPedido = () => cargarPedidos();
    const manejarNuevaComanda = (payload) => {
      if (payload?.area !== 'cocina') return;
      encolarLectura({ ...payload, tipoLectura: 'comanda' });
    };

    socket.on("nuevoPedido", manejarNuevoPedido);
    socket.on("nuevaComanda", manejarNuevaComanda);
    return () => {
      socket.off("nuevoPedido", manejarNuevoPedido);
      socket.off("nuevaComanda", manejarNuevaComanda);
    };
  }, [socket, encolarLectura]);


  useEffect(() => {
    if (!soportado) return;

    iniciarContinua();

    onResultado(async ({ text, raw, hadHotword, inHotWindow }) => {
      // Solo procesa si hubo hotword o estás dentro de la ventana caliente
      if (!hadHotword && !inHotWindow) return;

      const texto = (text || "").trim();
      console.log("🎙️ Reconocido por cocina:", { texto, raw, hadHotword, inHotWindow });

      const intent = parseCocinaCommand(texto);
      console.info('[VOICE][COCINA]', intent);

      if (intent.type === 'NONE') {
        encolarLectura({
          area: 'cocina',
          mesa: '',
          itemsTexto: [],
          notas: 'No te he entendido.',
          lecturaKey: `na-${Date.now()}`
        });
        return;
      }

      if (intent.type === 'RESUMEN_PENDIENTES') {
        const t = resumenPendientesTexto(pedidos);
        encolarLectura({
          area: 'cocina',
          mesa: '',
          itemsTexto: [t],
          notas: '',
          lecturaKey: `resumen-${Date.now()}`
        });
        return;
      }

      const rePedidoListo = /(marca|marcar|termina|terminar|finaliza|finalizar|cierra|cerrar).*(list[oa])?/i;
      const reMencionaPlato = /\bplato\b/i;
      const mesaNum = extraerNumeroMesa(texto);

      // ✅ Ya no exigimos que empiece por “cocina …”
      if (rePedidoListo.test(texto) && mesaNum != null && !reMencionaPlato.test(texto)) {
        // → INTENT: MARCAR_PEDIDO_LISTO
        const pedido = pedidos.find(p => p.mesa?.numero === mesaNum && p.estado !== 'listo');
        if (!pedido) {
          encolarLectura({
            area: 'cocina',
            mesa: mesaNum,
            itemsTexto: [],
            notas: `No encontré pedido pendiente en la mesa ${mesaNum}.`,
            lecturaKey: `no-pedido-${mesaNum}-${Date.now()}`
          });
          return;
        }
        try {
          await marcarPedidoComoListo(pedido._id);
          encolarLectura({
            area: 'cocina',
            mesa: mesaNum,
            itemsTexto: [`Pedido de la mesa ${mesaNum} marcado listo.`],
            notas: '',
            lecturaKey: `ok-pedido-${mesaNum}-${Date.now()}`
          });
        } catch (e) {
          console.error(e);
          encolarLectura({
            area: 'cocina',
            mesa: mesaNum,
            itemsTexto: [],
            notas: `No pude marcar listo el pedido de la mesa ${mesaNum}.`,
            lecturaKey: `err-pedido-${mesaNum}-${Date.now()}`
          });
        }
        return; // 🔚 Importante: salimos, no seguimos al fallback
      }

      if (intent.type === 'CONSULTAR_MESA') {
        const mesaNumero = intent.mesa;
        const pedidosMesa = pedidos.filter(p => p.mesa?.numero === mesaNumero);
        const productos = pedidosMesa.flatMap(p =>
          p.productos.filter(pr => ['plato', 'tapaRacion'].includes(pr.tipo) && pr.estadoPreparacion !== 'listo')
        );
        if (productos.length === 0) {
          encolarLectura({
            area: 'cocina',
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `La mesa ${mesaNumero} no tiene productos pendientes.`,
            lecturaKey: `consulta-empty-${mesaNumero}-${Date.now()}`
          });
          return;
        }
        const frases = productos.map(formatearProductoCliente);
        encolarLectura({
          area: 'cocina',
          mesa: mesaNumero,
          itemsTexto: frases,
          notas: '',
          lecturaKey: `consulta-${mesaNumero}-${Date.now()}`
        });
        return;
      }

      if (intent.type === 'MARCAR_PEDIDO_LISTO') {
        const mesaNumero = intent.mesa;
        const pedido = findPedidoPendienteByMesa(pedidos, mesaNumero);

        if (!pedido) {
          encolarLectura({
            area: 'cocina',
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No encontré pedido pendiente en la mesa ${mesaNumero}.`,
            lecturaKey: `no-pedido-${mesaNumero}-${Date.now()}`
          });
          return;
        }

        try {
          await marcarPedidoComoListo(pedido._id);
          encolarLectura({
            area: 'cocina',
            mesa: mesaNumero,
            itemsTexto: [`Pedido de la mesa ${mesaNumero} marcado listo.`],
            notas: '',
            lecturaKey: `ok-pedido-${mesaNumero}-${Date.now()}`
          });
        } catch (e) {
          console.error(e);
          encolarLectura({
            area: 'cocina',
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No pude marcar listo el pedido de la mesa ${mesaNumero}.`,
            lecturaKey: `err-pedido-${mesaNumero}-${Date.now()}`
          });
        }
        return;
      }

      if (intent.type === 'MARCAR_PRODUCTO_LISTO') {
        const mesaNumero = intent.mesa;
        const pedido = findPedidoPendienteByMesa(pedidos, mesaNumero);
        if (!pedido) {
          encolarLectura({
            area: 'cocina',
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No encontré pedido pendiente en la mesa ${mesaNumero}.`,
            lecturaKey: `no-pedido-${mesaNumero}-${Date.now()}`
          });
          return;
        }
        const pr = findProductoPendienteEnPedido(pedido, { idx: intent.idx, nombre: intent.nombre });
        if (!pr) {
          encolarLectura({
            area: 'cocina',
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No encontré ese plato pendiente en la mesa ${mesaNumero}.`,
            lecturaKey: `no-prod-${mesaNumero}-${Date.now()}`
          });
          return;
        }
        try {
          await api.put(`/pedidos/${pedido._id}/producto/${pr._id}`, { estadoPreparacion: 'listo' });
          await cargarPedidos();
          const frase = formatearProductoCliente(pr);
          encolarLectura({
            area: 'cocina',
            mesa: mesaNumero,
            itemsTexto: [`Marcado listo: ${frase}`],
            notas: '',
            lecturaKey: `ok-prod-${mesaNumero}-${Date.now()}`
          });
        } catch (e) {
          encolarLectura({
            area: 'cocina',
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No pude marcar el plato como listo en la mesa ${mesaNumero}.`,
            lecturaKey: `err-prod-${mesaNumero}-${Date.now()}`
          });
        }
        return;
      }
    });

    onFin(() => {
      // opcional: actualizar UI, apagar un loader, etc.
    });

    onError((e) => {
      console.error("❌ Error en reconocimiento de voz:", e);
      encolarLectura({
        area: "cocina",
        mesa: "",
        items: [],
        notas: "Ha ocurrido un error con el micrófono.",
        lecturaKey: `error-mic-${Date.now()}`
      });
    });

    // Al desmontar, corta la escucha continua
    return () => detenerContinua();
  }, [soportado, iniciarContinua, detenerContinua, onResultado, onFin, onError, pedidos, encolarLectura]);

  // Evitar eco: si el TTS está hablando, pausamos el micro; al terminar, lo reanudamos
  useEffect(() => {
    if (!soportado) return;

    let wasSpeaking = false;
    let reanudarTimer = null;

    const tick = () => {
      const speaking = typeof window !== "undefined" && window.speechSynthesis?.speaking;
      // Al empezar a hablar → detener micro
      if (speaking && !wasSpeaking) {
        wasSpeaking = true;
        try { detenerContinua(); } catch { }
        // (opcional) también puedes limpiar ventana caliente si quieres:
        // limpiarVentanaCaliente(); // si implementaste algo así en tu hook
      }
      // Al dejar de hablar → reanudar micro con un pequeño delay para no cortarnos
      if (!speaking && wasSpeaking) {
        wasSpeaking = false;
        clearTimeout(reanudarTimer);
        reanudarTimer = setTimeout(() => {
          try { iniciarContinua(); } catch { }
        }, 250); // 250–400ms suele ir bien
      }
    };

    const id = setInterval(tick, 200); // polling suave
    return () => {
      clearInterval(id);
      clearTimeout(reanudarTimer);
    };
  }, [soportado, iniciarContinua, detenerContinua]);

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!habilitado ? (
              <button onClick={activar} className="boton-activar-voz--cocina">
                🔊 Activar lectura
              </button>
            ) : (
              <button onClick={silenciar} className="boton-silenciar-voz--cocina">
                🔇 Silenciar
              </button>
            )}

            {soportado && (
              <button
                onClick={() => (activo ? detenerContinua() : iniciarContinua())}
                className="boton-voz--cocina"
                title="Hotword: 'cocina …' o 'oye cocina …'"
              >
                {activo ? "🎙️ Escuchando…" : "🎙️ Reanudar micro"}
              </button>
            )}
          </div>
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
