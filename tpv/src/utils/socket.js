import React, { createContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [cuentaSolicitada, setCuentaSolicitada] = useState(null);

  useEffect(() => {
    const socketInstance = io(process.env.REACT_APP_SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(socketInstance);

    // === Conexión y reconexión ===
    socketInstance.on("connect", () => {
      console.log("✅ [Socket] Conectado:", socketInstance.id);
    });

    socketInstance.on("disconnect", (reason) => {
      console.warn("⚠️ [Socket] Desconectado:", reason);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("❌ [Socket] Error de conexión:", err.message);
    });

    socketInstance.io.on("reconnect_attempt", (attempt) => {
      console.log(`🔁 [Socket] Intento de reconexión ${attempt}/5`);
    });

    socketInstance.onAny((event, data) => {
      console.log("📡 [Socket] Evento recibido:", event, data);
    });

    // === Evento global para solicitud de cuenta ===
    socketInstance.on("cuentaSolicitada", (data) => {
      console.log("💰 [Socket] Cuenta solicitada:", data);
      setCuentaSolicitada(data);
    });

    // Limpieza al desmontar
    return () => {
      console.log("🚪 [SocketProvider] Cerrando conexión...");
      socketInstance.disconnect();
    };
  }, []);

  /**
   * Permite que un componente se una a una sala específica.
   * Ejemplo: joinRoom(`cocina:${estacion}`)
   */
  const joinRoom = (room) => {
    if (!socket) return;
    console.log(`📥 [Socket] Uniéndose a la sala: ${room}`);
    socket.emit("joinRoom", room);
  };

  const leaveRoom = (room) => {
    if (!socket) return;
    console.log(`📤 [Socket] Saliendo de la sala: ${room}`);
    socket.emit("leaveRoom", room);
  };

  return (
    <SocketContext.Provider value={{ socket, joinRoom, leaveRoom, cuentaSolicitada, setCuentaSolicitada }}>
      {children}
    </SocketContext.Provider>
  );
};
