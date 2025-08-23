import React, { useEffect, useMemo, useState, useContext } from "react";
import api from "../../utils/api";
import * as logger from "../../utils/logger";
import { SocketContext } from "../../utils/socket";
import "./CocinaEstacion.css";

const ESTACIONES = ["frito", "frio", "plancha"];
const ROOM = (e) => `cocina:${e}`;

const groupBy = (arr, keyFn) =>
  arr.reduce((acc, it) => {
    const k = keyFn(it);
    (acc[k] ||= []).push(it);
    return acc;
  }, {});

export default function CocinaEstacion() {
  const { socket } = useContext(SocketContext);

  // Estación seleccionada (persistida)
  const [estacion, setEstacion] = useState(() => localStorage.getItem("cocina_estacion") || "frito");

  // Ítems visibles en la pantalla (flatten de pedidos)
  const [items, setItems] = useState([]); // [{pedidoId, itemId, mesa, nombre, cantidad, estacion, estado, ...}]

  // Para evitar duplicados al llegar sockets
  const keyOf = (it) => `${it.pedidoId}:${it.item?._id || it.itemId}`;

  const isCentral = estacion === "frito";

  // Cargar lista inicial
  const cargar = async (e = estacion) => {
    try {
      const { data } = await api.get("/cocina/items", {
        params: { estacion: e, estado: "pendiente,solicitado,en_preparacion" },
      });
      setItems(data.items || []);
    } catch (err) {
      logger.error("Error al cargar items de cocina:", err);
    }
  };

  // Suscripción a room de la estación
  useEffect(() => {
    if (!socket) return;

    const newRoom = ROOM(estacion);
    const prevRoom = ROOM(localStorage.getItem("cocina_prev_estacion") || "");

    // salir del room previo y entrar al nuevo (si tu server lo maneja)
    if (prevRoom && prevRoom !== newRoom) {
      socket.emit("room:leave", { room: prevRoom });
    }
    socket.emit("room:join", { room: newRoom });

    // guardar “previa” para salidas futuras
    localStorage.setItem("cocina_prev_estacion", estacion);

    // listeners
    const onNewItems = (payload) => {
      // payload: { estacion, items: [{pedidoId, item, mesa}] }
      if (!payload?.items?.length) return;

      // Normalizamos a la forma de estado local
      const incoming = payload.items.map((x) => ({
        pedidoId: x.pedidoId,
        itemId: x?.item?._id,
        mesa: x.mesa,
        nombre: x?.item?.nombre,
        cantidad: x?.item?.cantidad,
        estacion: x?.item?.estacion,
        estado: x?.item?.workflow?.estado,
        solicitadoPor: x?.item?.workflow?.solicitadoPor,
        solicitadoA: x?.item?.workflow?.solicitadoA,
        tPendiente: x?.item?.workflow?.tPendiente,
        tSolicitado: x?.item?.workflow?.tSolicitado,
        tInicio: x?.item?.workflow?.tInicio,
        tListo: x?.item?.workflow?.tListo,
      }));

      setItems((prev) => {
        const map = new Map(prev.map((p) => [keyOf(p), p]));
        incoming.forEach((it) => map.set(keyOf(it), { ...map.get(keyOf(it)), ...it }));
        return Array.from(map.values());
      });
    };

    const onUpdate = (payload) => {
      // payload: { type, pedidoId, item }
      const it = payload?.item;
      if (!it?._id) return;
      const flat = {
        pedidoId: payload.pedidoId,
        itemId: it._id,
        mesa: payload.mesa || null,
        nombre: it.nombre,
        cantidad: it.cantidad,
        estacion: it.estacion,
        estado: it?.workflow?.estado,
        solicitadoPor: it?.workflow?.solicitadoPor,
        solicitadoA: it?.workflow?.solicitadoA,
        tPendiente: it?.workflow?.tPendiente,
        tSolicitado: it?.workflow?.tSolicitado,
        tInicio: it?.workflow?.tInicio,
        tListo: it?.workflow?.tListo,
      };

      setItems((prev) => {
        const map = new Map(prev.map((p) => [keyOf(p), p]));
        const k = keyOf(flat);
        map.set(k, { ...map.get(k), ...flat });
        return Array.from(map.values());
      });
    };

    socket.on("kitchen:newItems", onNewItems);
    socket.on("kitchen:update", onUpdate);

    // carga inicial
    cargar(estacion);

    return () => {
      socket.off("kitchen:newItems", onNewItems);
      socket.off("kitchen:update", onUpdate);
      socket.emit("room:leave", { room: newRoom });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, estacion]);

  // Cambiar estación (y persistir)
  const onChangeEstacion = (e) => {
    const val = e.target.value;
    setEstacion(val);
    localStorage.setItem("cocina_estacion", val);
    cargar(val);
  };

  // Acciones de flujo
  const empezar = async ({ pedidoId, itemId }) => {
    try {
      await api.post(`/cocina/pedidos/${pedidoId}/items/${itemId}/empezar`);
      // No hace falta recargar: el socket update debería llegar
    } catch (err) {
      logger.error("Error al empezar item:", err);
    }
  };

  const listo = async ({ pedidoId, itemId }) => {
    try {
      await api.post(`/cocina/pedidos/${pedidoId}/items/${itemId}/listo`);
    } catch (err) {
      logger.error("Error al marcar listo:", err);
    }
  };

  const solicitarA = async ({ pedidoId, itemId, destino }) => {
    try {
      await api.post(`/cocina/pedidos/${pedidoId}/items/${itemId}/solicitar`, {
        solicitadoA: destino,
        solicitadoPor: "frito",
      });
    } catch (err) {
      logger.error("Error al solicitar item:", err);
    }
  };

  // Agrupar por mesa para UI
  const itemsPorMesa = useMemo(() => {
    return groupBy(items, (it) => it?.mesa?.numero ?? "—");
  }, [items]);

  const puedeEmpezar = (estado) => ["pendiente", "solicitado"].includes(estado);
  const puedeListo = (estado) => ["en_preparacion", "solicitado"].includes(estado);

  return (
    <div className="cocina--cocina">
      {/* Header */}
      <div className="cocina-header">
        <div className="cocina-selector">
          <label htmlFor="estacion" style={{ marginRight: 8 }}>Pantalla:</label>
          <select id="estacion" value={estacion} onChange={onChangeEstacion}>
            {ESTACIONES.map((e) => (
              <option key={e} value={e}>
                {e === "frito" ? "Fritos (Central)" : e === "frio" ? "Fríos" : "Plancha"}
              </option>
            ))}
          </select>
        </div>
        <div style={{ fontWeight: 600 }}>
          Viendo: {estacion === "frito" ? "Fritos (Central)" : estacion === "frio" ? "Fríos" : "Plancha"}
        </div>
      </div>

      {/* Contenido */}
      <h1 className="titulo--cocina">Ítems pendientes</h1>

      {items.length === 0 ? (
        <p className="mensaje-vacio--cocina">No hay ítems pendientes.</p>
      ) : (
        <div className="pedidos-container--cocina">
          {Object.entries(itemsPorMesa).map(([mesaNumero, lista]) => (
            <div key={mesaNumero} className="pedido-card--cocina">
              <div className="pedido-header--cocina">
                <h3>Mesa {mesaNumero}</h3>
                <p>{lista.length} ítem(s)</p>
              </div>

              <div className="seccion-pedido--cocina">
                <h4 className="seccion-titulo--cocina">PRODUCTOS</h4>
                <ul className="productos-list--cocina">
                  {lista
                    .sort((a, b) => (a.tPendiente || 0) - (b.tPendiente || 0))
                    .map((it) => (
                      <li key={`${it.pedidoId}-${it.itemId}`} className="producto-item--cocina">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {it.cantidad}x {it.nombre || "Producto"}
                            </div>
                            <div className="badge--cocina">
                              {it.estado === "pendiente" && "Pendiente"}
                              {it.estado === "solicitado" && `Solicitado → ${it.solicitadoA}`}
                              {it.estado === "en_preparacion" && "En preparación"}
                              {it.estado === "listo" && "Listo"}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 6 }}>
                            {/* Central (frito): puede solicitar a otras estaciones */}
                            {isCentral && (
                              <div className="dropdown--cocina">
                                <button className="btn--cocina">📣 Solicitar</button>
                                <div className="dropdown-menu--cocina">
                                  {["frio", "plancha", "frito"].map((dest) => (
                                    <button
                                      key={dest}
                                      className="dropdown-item--cocina"
                                      onClick={() =>
                                        solicitarA({ pedidoId: it.pedidoId, itemId: it.itemId, destino: dest })
                                      }
                                    >
                                      {dest === "frio" ? "Fríos" : dest === "plancha" ? "Plancha" : "Fritos"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* timestamps opcionales */}
                        <div className="timeline--cocina">
                          {it.tPendiente && <span>⏳ {new Date(it.tPendiente).toLocaleTimeString()}</span>}
                          {it.tSolicitado && <span>📣 {new Date(it.tSolicitado).toLocaleTimeString()}</span>}
                          {it.tInicio && <span>🔥 {new Date(it.tInicio).toLocaleTimeString()}</span>}
                          {it.tListo && <span>✅ {new Date(it.tListo).toLocaleTimeString()}</span>}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
