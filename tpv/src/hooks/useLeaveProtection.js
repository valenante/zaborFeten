import { useContext, useEffect, useState } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";

export function useLeaveProtection(shouldBlock, onTryLeave) {
  const navigator = useContext(UNSAFE_NavigationContext)?.navigator;

  useEffect(() => {
    if (!shouldBlock) return;

    // 🔹 Evitar salir con botón atrás
    window.history.pushState({ bloqueado: true }, "");

    const handlePopState = (e) => {
      if (e.state?.bloqueado) {
        onTryLeave(); // <-- activa modal
        window.history.pushState({ bloqueado: true }, "");
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [shouldBlock, onTryLeave]);

  // 🔹 Bloquear navegación interna
  useEffect(() => {
    if (!shouldBlock || !navigator) return;

    const originalPush = navigator.push;

    navigator.push = (...args) => {
      onTryLeave(() => originalPush(...args)); // pasar callback
    };

    return () => {
      navigator.push = originalPush;
    };
  }, [shouldBlock, navigator, onTryLeave]);
}
