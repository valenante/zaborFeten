// middlewares/auth.js
import jwt from 'jsonwebtoken';
import logger from '../../utils/logger.js';

export const authMiddleware = (req, res, next) => {
  // lee cookie o header Bearer
  const bearer = req.headers.authorization;
  const token = req.cookies?.token || (bearer?.startsWith('Bearer ') ? bearer.slice(7) : null);

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Token no proporcionado.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // inferir estación desde role si no viene
    if (!verified.estacion && typeof verified.role === 'string' && verified.role.startsWith('cocina-')) {
      verified.estacion = verified.role.split('-')[1]; // 'frio'|'frito'|'plancha'
    }
    req.user = verified; // { id, name, role, estacion? }
    logger.info(`Token verificado para el usuario: ${verified.id}`);
    next();
  } catch (error) {
    logger.error('❌ Error al verificar el token:', error.message);
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};
