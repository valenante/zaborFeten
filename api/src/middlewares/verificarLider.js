import Mesa from '../models/Mesa.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado

const verificarLider = async (req, res, next) => {
  const { mesa } = req.query; // O req.body si el ID está en el cuerpo
  const tokenHeader = req.headers['x-token-lider'];

  console.log('Verificando líder para la mesa:', mesa);
  console.log('Token recibido en el header:', tokenHeader);

  if (!mesa || !tokenHeader) {
    return res
      .status(400)
      .json({ error: 'Falta el número de mesa o el tokenLider' });
  }

  try {
    const mesaDoc = await Mesa.findOne({ numero: mesa });
    if (!mesaDoc || mesaDoc.tokenLider !== tokenHeader) {
      return res
        .status(403)
        .json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  } catch (error) {
    logger.error('Error al verificar el tokenLider:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export default verificarLider;
