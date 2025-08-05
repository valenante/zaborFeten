import jwt from 'jsonwebtoken';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado

export const authMiddleware = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res
      .status(401)
      .json({ error: 'No autorizado. Token no proporcionado.' });
  }

  if (!token) {
    return res
      .status(401)
      .json({ error: 'No autorizado. Token no encontrado.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Guardar los datos del usuario en la solicitud
    logger.info(`Token verificado para el usuario: ${verified.id}`);
    next();
  } catch (error) {
    logger.error('❌ Error al verificar el token:', error.message);
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};
