// src/middlewares/attachUser.js
import jwt from "jsonwebtoken";
import logger from "../../utils/logger.js";

export const attachUser = (req, res, next) => {
  try {
    // ⚙️ En desarrollo: ignorar validación JWT y usar usuario de sesión o simulado
    if (process.env.NODE_ENV !== "production") {
      if (req.session?.user) {
        req.user = req.session.user;
      } else {
        // Usuario simulado por defecto
        req.user = {
          id: "dev-user",
          name: "Desarrollador",
          role: "admin",
          estacion: "frito",
        };
      }
      logger.info("🔓 [DEV MODE] attachUser -> Usuario asignado:", req.user.name);
      return next();
    }

    // 1️⃣ En producción: intentar obtener usuario de sesión
    if (req.session?.user) {
      req.user = req.session.user;
      return next();
    }

    // 2️⃣ Si no hay sesión, intentar obtener de JWT
    const bearer = req.headers.authorization;
    const token =
      req.cookies?.token ||
      (bearer?.startsWith("Bearer ") ? bearer.slice(7) : null);

    if (!token) return next(); // sin token ni sesión → anónimo

    const verified = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Inferir estación si es cocina
    if (!verified.estacion && verified.role?.startsWith("cocina-")) {
      verified.estacion = verified.role.split("-")[1];
    }

    req.user = verified;
    logger.debug(`[attachUser] Usuario autenticado: ${verified.name || verified.id}`);
  } catch (err) {
    logger.warn("[attachUser] Token inválido o expirado:", err.message);
  }

  next();
};
