import React, { useState, useEffect } from 'react';
import { useContext } from "react";
import api from '../../utils/api';
import { SocketContext } from "../../utils/socket";
import PedidosFinalizados from './PedidosFinalizados';
import ResumenSolicitado from './ResumenSolicitado';
import * as logger from '../../utils/logger';
import { useAuth } from "../../context/AuthContext";
import { useLecturaVoz } from '../../hooks/useLecturaVoz';
import { useReconocimientoVoz, extraerNumeroMesa } from '../../hooks/useReconocimientoVoz';
import { parseCocinaCommand } from '../../Voice/intentsCocina';
import './Cocina.css';
import DetallesProducto from './DetallesProducto';
import stringSimilarity from "string-similarity";

const ESTACIONES = ['frito', 'frio', 'plancha'];


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

const labelTipoPrecio = (tp = '') => {
  const t = tp.toLowerCase();
  if (!t || t === 'preciobase' || t === 'base' || t === 'precio base') return '';
  const mapa = { tapa: 'tapa', racion: 'ración', media: 'media ración', surtido: 'surtido' };
  return mapa[t] || '';
};

// Genera texto de resumen (top productos pendientes)
const resumenPendientesTexto = (pedidos) => {
  const conteo = {};
  pedidos.forEach(p => {
    p.productos
      .filter(pr => ['plato', 'tapaRacion'].includes(pr.tipo) && pr.estadoPreparacion !== 'listo')
      .forEach(pr => {
        const nombre = pr.producto?.nombre || 'Producto';
        const tipoPrecio = labelTipoPrecio(pr.tipoPrecio);
        const key = `${nombre}${tipoPrecio ? ` ${tipoPrecio}` : ''}`.trim();
        conteo[key] = (conteo[key] || 0) + pr.cantidad;
      });
  });

  const items = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `${v === 1 ? 'un' : v} ${k}`);

  return items.length ? items.join('. ') : 'No hay productos pendientes.';
};


// Busca producto por índice 1‑based o por nombre aproximado// Busca producto por índice, nombre o alias con coincidencia parcial
const findProductoPendienteEnPedido = (pedido, { idx, nombre }) => {
  const ordenSecciones = { entrante: 1, medio: 2, final: 3 };

  const lista = pedido.productos
    .filter(pr => ['plato', 'tapaRacion'].includes(pr.tipo) && pr.estadoPreparacion !== 'listo')
    .sort((a, b) => (ordenSecciones[a.seccion] || 99) - (ordenSecciones[b.seccion] || 99));

  // 1️⃣ Si se menciona por índice (plato 2, etc.)
  if (idx != null) {
    const i = idx - 1;
    return (i >= 0 && i < lista.length) ? lista[i] : null;
  }

  // 2️⃣ Si se menciona por nombre o alias
  if (nombre) {
    const n = nombre.trim().toLowerCase();
    const opciones = lista.map(pr => ({
      pr,
      nombres: [
        pr.producto?.nombre?.toLowerCase() || "",
        ...(pr.producto?.aliases || []).map(a => a.toLowerCase())
      ]
    }));

    let mejorMatch = null;
    let mejorPuntaje = 0.5; // umbral mínimo

    for (const { pr, nombres } of opciones) {
      for (const alias of nombres) {
        const score = stringSimilarity.compareTwoStrings(n, alias);
        if (score > mejorPuntaje) {
          mejorMatch = pr;
          mejorPuntaje = score;
        }
      }
    }

    return mejorMatch;
  }
};

const Cocina = () => {
  const [pedidos, setPedidos] = useState([]);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [productoSeleccionado] = useState(null);
  const { socket, joinRoom, leaveRoom } = useContext(SocketContext);
  const [mesas, setMesas] = useState([]);
  const { logout } = useAuth();
  const [resumenProductos, setResumenProductos] = useState([]);
  const { habilitado, activar, encolarLectura, silenciar } = useLecturaVoz(1, 8000);
  const { activo, iniciarContinua, detenerContinua, onResultado, onFin, onError, soportado } = useReconocimientoVoz({ idioma: "es-ES" });
  const [estacion, setEstacion] = useState(() => localStorage.getItem('cocina_estacion') || 'frito');
  const [resumenProductosListos, setResumenProductosListos] = useState([]);
  const [modalActivo, setModalActivo] = useState(null);

  const cerrarSeccion = async (pedidoId) => {
    try {
      await api.put(`/pedidos/${pedidoId}/cerrar-estacion`, { estacion });

      // ✅ Reflejarlo instantáneamente en la UI local
      setPedidos((prev) =>
        prev.map((p) =>
          p._id === pedidoId
            ? {
              ...p,
              cerradoPorEstacion: {
                ...(p.cerradoPorEstacion || {}),
                [estacion]: true,
              },
            }
            : p
        )
      );

      // ✅ Emitir manualmente el refresh para las otras estaciones (opcional)
      socket?.emit("cocina:refresh");
    } catch (err) {
      console.error("Error cerrando estación:", err);
    }
  };

  const onChangeEstacion = (e) => {
    const val = e.target.value;
    setEstacion(val);
    localStorage.setItem('cocina_estacion', val);
  };

  useEffect(() => {
    if (!socket) return;
    socket.emit('joinRoom', `cocina:${estacion}`); // 👈 une esta pantalla a su canal
    return () => socket.emit('leaveRoom', `cocina:${estacion}`);
  }, [socket, estacion]);

  useEffect(() => {
    if (!socket) return;

    let timer = null;
    const handleRefresh = () => {
      // pequeño debounce por si llegan varios eventos seguidos
      clearTimeout(timer);
      timer = setTimeout(() => {
        cargarPedidos();           // 👈 rehace GET y los checkboxes se actualizan
      }, 120);
    };

    socket.on('cocina:refresh', handleRefresh);

    return () => {
      socket.off('cocina:refresh', handleRefresh);
      clearTimeout(timer);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const any = (e, ...a) => console.log('📡', e, ...a);
    socket.onAny(any);
    return () => socket.offAny(any);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const room = `cocina:${estacion}`;
    joinRoom(room);

    return () => leaveRoom(room);
  }, [socket, estacion, joinRoom, leaveRoom]);

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


  const marcarItemListo = async (pedidoId, itemId) => {
    try {
      const pedido = pedidos.find(p => p._id === pedidoId);
      const item = pedido?.productos.find(x => x._id === itemId);
      if (!item) return;

      const next = (item?.workflow?.estado === 'listo') ? 'pendiente' : 'listo';

      // 1️⃣ Cambiar el estado en backend
      await api.post(`/cocina/${pedidoId}/items/${itemId}/estado`, { estado: next });

      // 🔧 Actualiza el estado local inmediatamente sin esperar al socket
      setPedidos(prev =>
        prev.map(p =>
          p._id === pedidoId
            ? {
              ...p,
              productos: p.productos.map(it =>
                it._id === itemId
                  ? { ...it, workflow: { ...(it.workflow || {}), estado: next } }
                  : it
              ),
            }
            : p
        )
      );

    } catch (err) {
      logger.error('Error al cambiar estado item:', err);
    }
  };

  const calcularResumenProductos = (listaPedidos) => {
    const resumen = {};

    listaPedidos.forEach(pedido => {
      pedido.productos
        .filter(p =>
          p.estadoPreparacion !== 'listo' &&
          ['plato', 'tapaRacion'].includes(p.tipo)
        )
        .forEach(p => {
          // 🟣 Filtrar por estación, excepto si estamos en la central (frito)
          if (estacion !== 'frito' && p.estacion !== estacion) return;

          const nombre = p.producto?.nombre || 'Producto';
          const tipo = p.tipoPrecio;
          const key =
            tipo && tipo !== "precioBase"
              ? `${nombre} (${tipo})`
              : nombre;
          resumen[key] = (resumen[key] || 0) + p.cantidad;
        });
    });

    // Convertimos a array ordenado para renderizar
    const resumenArray = Object.entries(resumen)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    setResumenProductos(resumenArray);
  };

  const cargarResumenListos = async () => {
    try {
      const { data } = await api.get("/cocina/productos-listos");
      setResumenProductosListos(data);
    } catch (error) {
      logger.error("Error al cargar productos listos:", error);
    }
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

    const manejarNuevoPedido = (nuevoPedido) => {
      // Refrescamos pedidos y recalculamos resumen
      cargarPedidos();
      calcularResumenProductos([...pedidos, nuevoPedido?.pedido || {}]);
    };

    const patchItem = (pedidoId, item) => {
      setPedidos(prev => prev.map(p =>
        p._id !== pedidoId ? p : ({
          ...p,
          productos: p.productos.map(it =>
            it._id === item._id
              ? { ...it, workflow: { ...(it.workflow || {}), ...(item.workflow || {}) } }
              : it
          )
        })
      ));
    };

    const handleKitchenUpdate = (ev) => {
      console.groupCollapsed("📡 [Socket] kitchen:update");
      console.groupEnd();

      if (!ev || !ev.type) {
        console.warn("⚠️ Evento inválido recibido:", ev);
        return;
      }

      if (["itemEstadoCambiado", "itemSolicitado", "itemListo"].includes(ev.type)) {
        setPedidos((prevPedidos) => {
          const actualizados = prevPedidos.map((p) =>
            p._id === ev.pedidoId
              ? {
                ...p,
                productos: p.productos.map((prod) =>
                  prod._id === ev.item._id
                    ? {
                      ...prod,
                      workflow: { ...(prod.workflow || {}), ...(ev.item.workflow || {}) },
                      estadoPreparacion: ev.item.estadoPreparacion ?? prod.estadoPreparacion,
                    }
                    : prod
                ),
              }
              : p
          );
          return actualizados;
        });
      }
    };

    socket.on("nuevoPedido", manejarNuevoPedido);
    socket.on("kitchen:update", handleKitchenUpdate);

    socket.on("nuevaComanda", (payload) => {
      if (payload?.area !== 'cocina') return;
      encolarLectura({ ...payload, tipoLectura: 'comanda' });
    });

    return () => {
      socket.off("nuevoPedido", manejarNuevoPedido);
      socket.off("kitchen:update", handleKitchenUpdate); // ✅ quitamos el MISMO handler
      socket.off("nuevaComanda");
    };
  }, [socket, encolarLectura]);

  // 🎙️ Reconocimiento de voz — optimizado (no se queda abierto permanentemente)
  useEffect(() => {
    if (!soportado) return;

    // 🔹 Inicia el reconocimiento continuo solo una vez al montar
    iniciarContinua();

    // 🔹 Manejador principal de resultados
    onResultado(async ({ text, raw, hadHotword, inHotWindow }) => {
      if (!hadHotword && !inHotWindow) return;

      const texto = (text || "").trim();
      const intent = parseCocinaCommand(texto);

      if (intent.type === "NONE") {
        encolarLectura({
          area: "cocina",
          mesa: "",
          itemsTexto: [],
          notas: "No te he entendido.",
          lecturaKey: `na-${Date.now()}`,
        });
        return;
      }

      // 🧩 Intent: resumen general
      if (intent.type === "RESUMEN_PENDIENTES") {
        const t = resumenPendientesTexto(pedidos);
        encolarLectura({
          area: "cocina",
          mesa: "",
          itemsTexto: [t],
          notas: "",
          lecturaKey: `resumen-${Date.now()}`,
        });
        return;
      }

      // 🧩 Intent: consultar mesa
      if (intent.type === "CONSULTAR_MESA") {
        const mesaNumero = intent.mesa;
        const pedidosMesa = pedidos.filter((p) => p.mesa?.numero === mesaNumero);
        const productos = pedidosMesa.flatMap((p) =>
          p.productos.filter(
            (pr) =>
              ["plato", "tapaRacion"].includes(pr.tipo) &&
              pr.estadoPreparacion !== "listo"
          )
        );

        if (productos.length === 0) {
          encolarLectura({
            area: "cocina",
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `La mesa ${mesaNumero} no tiene productos pendientes.`,
            lecturaKey: `consulta-empty-${mesaNumero}-${Date.now()}`,
          });
          return;
        }

        const frases = productos.map(formatearProductoCliente);
        encolarLectura({
          area: "cocina",
          mesa: mesaNumero,
          itemsTexto: frases,
          notas: "",
          lecturaKey: `consulta-${mesaNumero}-${Date.now()}`,
        });
        return;
      }

      // 🧩 Intent: marcar pedido como listo
      if (intent.type === "MARCAR_PEDIDO_LISTO") {
        const mesaNumero = intent.mesa;
        const pedido = findPedidoPendienteByMesa(pedidos, mesaNumero);
        if (!pedido) {
          encolarLectura({
            area: "cocina",
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No encontré pedido pendiente en la mesa ${mesaNumero}.`,
            lecturaKey: `no-pedido-${mesaNumero}-${Date.now()}`,
          });
          return;
        }
        try {
          await marcarPedidoComoListo(pedido._id);
          encolarLectura({
            area: "cocina",
            mesa: mesaNumero,
            itemsTexto: [`Pedido de la mesa ${mesaNumero} marcado listo.`],
            notas: "",
            lecturaKey: `ok-pedido-${mesaNumero}-${Date.now()}`,
          });
        } catch (e) {
          encolarLectura({
            area: "cocina",
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No pude marcar listo el pedido de la mesa ${mesaNumero}.`,
            lecturaKey: `err-pedido-${mesaNumero}-${Date.now()}`,
          });
        }
        return;
      }

      // 🧩 Intent: marcar producto como listo
      if (intent.type === "MARCAR_PRODUCTO_LISTO") {
        const mesaNumero = intent.mesa;
        const pedido = findPedidoPendienteByMesa(pedidos, mesaNumero);
        if (!pedido) {
          encolarLectura({
            area: "cocina",
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No encontré ese plato pendiente en la mesa ${mesaNumero}.`,
            lecturaKey: `no-pedido-${mesaNumero}-${Date.now()}`,
          });
          return;
        }

        const pr = findProductoPendienteEnPedido(pedido, {
          idx: intent.idx,
          nombre: intent.nombre,
        });

        if (!pr) {
          encolarLectura({
            area: "cocina",
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No encontré ese plato pendiente en la mesa ${mesaNumero}.`,
            lecturaKey: `no-prod-${mesaNumero}-${Date.now()}`,
          });
          return;
        }

        try {
          await api.post(`/cocina/${pedido._id}/items/${pr._id}/estado`, {
            estado: "listo",
          });

          const frase = formatearProductoCliente(pr);
          encolarLectura({
            area: "cocina",
            mesa: mesaNumero,
            itemsTexto: [`Marcado listo: ${frase}`],
            notas: "",
            lecturaKey: `ok-prod-${mesaNumero}-${Date.now()}`,
          });
        } catch (e) {
          encolarLectura({
            area: "cocina",
            mesa: mesaNumero,
            itemsTexto: [],
            notas: `No pude marcar el plato como listo en la mesa ${mesaNumero}.`,
            lecturaKey: `err-prod-${mesaNumero}-${Date.now()}`,
          });
        }
        return;
      }
    });

    // 🔄 Solo reinicia si el usuario no lo detuvo manualmente
    onFin(() => {
      if (activo) iniciarContinua();
    });

    // ⚠️ Manejo de errores de reconocimiento
    onError((e) => {
      console.error("❌ Error en reconocimiento de voz:", e);
      encolarLectura({
        area: "cocina",
        mesa: "",
        itemsTexto: [],
        notas: "Ha ocurrido un error con el micrófono.",
        lecturaKey: `error-mic-${Date.now()}`,
      });
    });

    // 🧹 Limpieza: detener reconocimiento al desmontar
    return () => detenerContinua();

    // 👇 Importante: dependencias mínimas para evitar loops
  }, [soportado]);

  useEffect(() => {
    if (pedidos.length > 0) {
      calcularResumenProductos(pedidos);
    }
  }, [estacion, pedidos]);

  // === NUEVO: deriva si esta pantalla es la central (frito)
  const isCentral = (estacion || '').toLowerCase().startsWith('frito');

  const estadoItem = (p) => (p?.workflow?.estado ?? 'pendiente');          // default
  const solicitadoADe = (p) => (p?.workflow?.solicitadoA ?? p?.solicitadoA ?? null);

  const solicitar = async ({ pedidoId, itemId, destino }) => {
    try {
      await api.post(`/cocina/${pedidoId}/items/${itemId}/solicitar`, {
        solicitadoA: destino,
        solicitadoPor: 'frito',
      });
      // no forzamos recarga, llegará socket 'kitchen:update'
    } catch (error) {
      logger.error('Error al solicitar item:', error);
    }
  };

  // === NUEVO: ids resaltados tras solicitar
  const [highlight, setHighlight] = useState(new Set());
  const pushHighlight = (key) => {
    setHighlight(prev => {
      const n = new Set(prev);
      n.add(key);
      return n;
    });
    setTimeout(() => {
      setHighlight(prev => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    }, 3000); // 3s de flash
  };

  // 🎧 Control del eco TTS → pausa el micro mientras el sistema habla
  useEffect(() => {
    if (!soportado) return;

    let wasSpeaking = false;
    let reanudarTimer = null;

    const tick = () => {
      const speaking = typeof window !== "undefined" && window.speechSynthesis?.speaking;

      // 🔇 Pausar micrófono mientras se habla
      if (speaking && !wasSpeaking) {
        wasSpeaking = true;
        try { detenerContinua(); } catch { }
      }

      // 🔊 Reanudar solo si el micrófono sigue en modo activo
      if (!speaking && wasSpeaking) {
        wasSpeaking = false;
        clearTimeout(reanudarTimer);
        reanudarTimer = setTimeout(() => {
          if (activo) {
            try { iniciarContinua(); } catch { }
          }
        }, 300);
      }
    };

    const id = setInterval(tick, 200);
    return () => {
      clearInterval(id);
      clearTimeout(reanudarTimer);
    };
  }, [soportado, activo, iniciarContinua, detenerContinua]);

  // Devuelve solo los productos de la estación elegida.
  // La central (frito) ve todo sin filtrar.
  const productosDeEstacion = (productos) => {
    if (estacion === 'frito') return productos; // central ve todo
    return productos.filter(p => p.estacion === estacion);
  };

  const marcarPedidoComoListo = async (pedidoId) => {
    try {
      await api.put(`/pedidos/${pedidoId}`, { estado: 'listo' });
      // ✅ NO llames cargarPedidos(); llegará evento del back (añade uno si aún no lo tienes)
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
    }, 180000); // cada 180s
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

  const mostrarTipoPrecio = (tp) => {
    if (!tp || tp === "precioBase") return "";
    return tp + " ";
  };

  return (
    <>
      <div className="cocina--cocina">
        <div className="cocina-header">
          <button onClick={logout} className="boton-cerrar--cocina">
            Cerrar Sesión
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="cocina-selector">
              <select id="estacion" value={estacion} onChange={onChangeEstacion}>
                {ESTACIONES.map((e) => (
                  <option key={e} value={e}>
                    {e === 'frito' ? 'Fritos (Central)' : e === 'frio' ? 'Fríos' : 'Plancha'}
                  </option>
                ))}
              </select>
            </div>
          </div>
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

        <button onClick={() => setMostrarFinalizados(true)} className="boton-finalizados--cocina">
          Ver Pedidos Finalizados
        </button>

        {mostrarFinalizados && <PedidosFinalizados onClose={() => setMostrarFinalizados(false)} />}

        {pedidos.length === 0 ? (
          <p className="mensaje-vacio--cocina">No hay pedidos pendientes</p>
        ) : (
          <div className="pedidos-container--cocina">
            {pedidos.map((pedido) => {
              const visibles = productosDeEstacion(
                pedido.productos.filter((producto) => ['plato', 'tapaRacion'].includes(producto.tipo))
              );

              if (pedido.cerradoPorEstacion?.[estacion]) {
                return null;
              }

              if (visibles.length === 0) {
                return null; // 🚀 no hay productos para esta estación, no mostrar tarjeta vacía
              }

              const todosProductosListos = visibles.every(
                (producto) => (producto.workflow?.estado === 'listo')
              );

              const productosAgrupados = agruparPorSeccion(visibles);

              return (
                <div key={pedido._id} className="pedido-card--cocina">
                  <div className="pedido-header--cocina">
                    <h3>Mesa {pedido.mesa.numero}</h3>
                    <p>{getComensalesPedido(pedido)} comensales</p>
                  </div>

                  <p>
                    <strong>Hace:</strong> {calcularTiempoTranscurrido(pedido.fecha)}
                  </p>

                  {pedido.servirTodoJunto ? (
                    // ✅ Mostrar todo junto sin secciones
                    <div className="seccion-pedido--cocina">
                      <h4 className="seccion-titulo--cocina">A LA VEZ</h4>
                      <ul className="productos-list--cocina">
                        {visibles.map((producto) => (
                          <li
                            key={producto._id}
                            className={
                              "producto-item--cocina" +
                              (producto.workflow?.estado === "listo" ? " listo" : "")
                            }
                          >
                            <label>
                              <input
                                type="checkbox"
                                checked={producto.workflow?.estado === "listo"}
                                onChange={() => marcarItemListo(pedido._id, producto._id)}
                              />
                              <span
                                style={{
                                  color:
                                    producto.tipoPlato === "individual" ? "green" : "purple",
                                }}
                              >
                                {producto.cantidad}x{" "}
                                {mostrarTipoPrecio(producto.tipoPrecio)}
                                {producto.producto?.nombre ||
                                  producto.nombre ||
                                  "Producto no disponible"}
                              </span>
                            </label>

                            <DetallesProducto producto={producto} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    // ✅ Caso normal: mostrar por secciones
                    (["entrante", "medio", "final"].some(
                      (seccion) => productosAgrupados[seccion]?.length > 0
                    ) ? (
                      ["entrante", "medio", "final"].map(
                        (seccion) =>
                          productosAgrupados[seccion]?.length > 0 && (
                            <div key={seccion} className="seccion-pedido--cocina">
                              <h4 className="seccion-titulo--cocina">
                                {seccion.toUpperCase()}
                              </h4>

                              {pedido.mensajesSeccion?.[seccion] &&
                                pedido.mensajesSeccion[seccion].trim() !== "" && (
                                  <div className="nota-seccion--cocina">
                                    📝 {pedido.mensajesSeccion[seccion]}
                                  </div>
                                )}

                              <ul className="productos-list--cocina">
                                {productosAgrupados[seccion].map((producto) => {
                                  const estado = producto?.workflow?.estado ?? "pendiente";
                                  const solicitadoA =
                                    producto?.workflow?.solicitadoA ??
                                    producto?.solicitadoA ??
                                    null;
                                  const destino = producto?.estacion || "frio";
                                  const disabledSolicitar = !(
                                    (estacion || "")
                                      .toLowerCase()
                                      .startsWith("frito") && estado === "pendiente"
                                  );

                                  return (
                                    <li
                                      key={producto._id}
                                      className={
                                        "producto-item--cocina" +
                                        (producto.workflow?.estado === "listo"
                                          ? " listo"
                                          : "") +
                                        (highlight.has(`${pedido._id}:${producto._id}`)
                                          ? " flash-solicitado"
                                          : "")
                                      }
                                    >
                                      <label>
                                        <input
                                          type="checkbox"
                                          checked={producto.workflow?.estado === "listo"}
                                          onChange={() =>
                                            marcarItemListo(pedido._id, producto._id)
                                          }
                                        />
                                        <span
                                          style={{
                                            color:
                                              producto.tipoPlato === "individual"
                                                ? "green"
                                                : "purple",
                                          }}
                                        >
                                          {producto.cantidad}x{" "}
                                          {mostrarTipoPrecio(producto.tipoPrecio)}
                                          {producto.producto?.nombre ||
                                            producto.nombre ||
                                            "Producto no disponible"}
                                          {producto.workflow?.estado === "solicitado" && (
                                            <span className="badge-solicitado">
                                              SOLICITADO
                                            </span>
                                          )}
                                        </span>
                                      </label>

                                      <DetallesProducto producto={producto} />

                                      {isCentral && (
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 6,
                                            marginTop: 6,
                                          }}
                                        >
                                          <button
                                            className="btn--cocina btn--ghost"
                                            onClick={() =>
                                              solicitar({
                                                pedidoId: pedido._id,
                                                itemId: producto._id,
                                                destino,
                                              })
                                            }
                                            disabled={disabledSolicitar}
                                            title={
                                              disabledSolicitar
                                                ? `No disponible (${estado}${solicitadoA ? " · solicitado" : ""
                                                })`
                                                : "Solicitar"
                                            }
                                          >
                                            Solicitar
                                          </button>
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )
                      )
                    ) : (
                      <div className="seccion-pedido--cocina">
                        <h4 className="seccion-titulo--cocina">PRODUCTOS</h4>
                        <ul className="productos-list--cocina">
                          {visibles.map((producto) => (
                            <li
                              key={producto._id}
                              className={
                                "producto-item--cocina" +
                                (producto.workflow?.estado === "listo" ? " listo" : "")
                              }
                            >
                              <label>
                                <input
                                  type="checkbox"
                                  checked={producto.workflow?.estado === "listo"}
                                  onChange={() => marcarItemListo(pedido._id, producto._id)}
                                />
                                <span
                                  style={{
                                    color:
                                      producto.tipoPlato === "individual"
                                        ? "green"
                                        : "purple",
                                  }}
                                >
                                  {producto.cantidad}x{" "}
                                  {mostrarTipoPrecio(producto.tipoPrecio)}
                                  {producto.producto?.nombre ||
                                    producto.nombre ||
                                    "Producto"}
                                </span>
                              </label>

                              <DetallesProducto producto={producto} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}

                  {/* Botón de cerrar o terminar */}
                  {isCentral ? (
                    <button
                      onClick={() => marcarPedidoComoListo(pedido._id)}
                      disabled={!todosProductosListos}
                      className="boton-terminar--cocina"
                    >
                      Terminar Pedido
                    </button>
                  ) : (
                    <button
                      onClick={() => cerrarSeccion(pedido._id)}
                      disabled={!visibles.every((p) => p.workflow?.estado === "listo")}
                      className="boton-terminar--cocina"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Botón flotante del resumen */}
      <button
        onClick={() => setModalActivo("pendientes")}
        className="boton-resumen--cocina"
      >
        📋
      </button>

      <button
        onClick={() => {
          cargarResumenListos();
          setModalActivo("listos");
        }}
        className="boton-resumen--cocina boton-resumen-listos"
        style={{ right: '70px', backgroundColor: 'var(--color-secundario)' }}
      >
        ✅
      </button>

      <button
        onClick={() => setModalActivo("solicitados")}
        className="boton-resumen--cocina"
        style={{ right: "140px", backgroundColor: "#6A0DAD" }}
      >
        🍽️
      </button>


      {modalActivo === "pendientes" && (
        <div className="resumen-panel--cocina">
          <div className="resumen-header--cocina">
            <h3>
              {estacion === 'frito'
                ? 'Resumen de Productos Pendientes (TODOS)'
                : `Resumen de ${estacion.toUpperCase()}`}
            </h3>
            <button onClick={() => setModalActivo(null)}>✕</button>
          </div>

          <ul>
            {resumenProductos.length > 0 ? (
              resumenProductos.map((item, i) => (
                <li key={i}>
                  <strong>{item.cantidad}x</strong> {item.nombre}
                </li>
              ))
            ) : (
              <li>No hay productos pendientes.</li>
            )}
          </ul>
        </div>
      )}


      {modalActivo === "listos" && (
        <div className="resumen-panel--cocina">
          <div className="resumen-header--cocina">
            <h3>Resumen de Productos Listos</h3>
            <button onClick={() => setModalActivo(null)}>✕</button>
          </div>
          <ul>
            {resumenProductosListos.length > 0 ? (
              resumenProductosListos.map((item, i) => (
                <li key={i}><strong>{item.cantidad}x</strong> {item.nombre}</li>
              ))
            ) : (
              <li>No hay productos listos.</li>
            )}
          </ul>
        </div>
      )}


      {modalActivo === "solicitados" && (
        <ResumenSolicitado
          pedidos={pedidos}
          onClose={() => setModalActivo(null)}
        />
      )}


    </>
  );
};

export default Cocina;
