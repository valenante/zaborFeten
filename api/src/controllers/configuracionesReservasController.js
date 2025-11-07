import ConfiguracionReserva from '../models/ConfiguracionReserva.js';
import FechaEspecial from '../models/FechaEspecial.js';
import * as logger from '../../utils/logger.js'; // asegúrate de tener tu logger

const franjasPredeterminadas = [
  { horaInicio: '13:00', horaFin: '15:00', maxReservas: 10 },
  { horaInicio: '20:00', horaFin: '21:30', maxReservas: 10 },
];

/**
 * Obtener configuración de reservas por fecha.
 * 🔹 Si hay una fecha especial, devuelve esa configuración.
 * 🔹 Si no, busca configuración normal por fecha.
 * 🔹 Si tampoco, devuelve las franjas predeterminadas.
 */
export const obtenerConfiguracionPorFecha = async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ mensaje: 'Falta la fecha en la consulta.' });

    // 🧠 1️⃣ Buscar si existe una fecha especial habilitada
    const fechaEspecial = await FechaEspecial.findOne({ fecha });
    if (fechaEspecial && fechaEspecial.habilitado) {
      return res.json({
        tipo: 'especial',
        franjas: fechaEspecial.franjas || [],
        mensaje: 'Configuración especial para esta fecha.',
      });
    }

    // 🧠 2️⃣ Buscar configuración específica por fecha
    const config = await ConfiguracionReserva.findOne({ fecha });
    if (config) {
      return res.json({
        tipo: 'normal',
        franjas: config.franjas,
        mensaje: 'Configuración normal para la fecha.',
      });
    }

    // 🧠 3️⃣ Si no hay ninguna, devolver predeterminadas
    return res.json({
      tipo: 'predeterminada',
      franjas: franjasPredeterminadas,
      mensaje: 'No hay configuración específica, usando franjas por defecto.',
    });
  } catch (error) {
    logger.error('❌ Error al obtener configuración:', error);
    res.status(500).json({ mensaje: 'Error al obtener configuración de reservas.' });
  }
};

/**
 * Guardar configuración de reservas para una fecha.
 */
export const guardarConfiguracion = async (req, res) => {
  try {
    const { fecha, franjas } = req.body;
    if (!fecha) return res.status(400).json({ mensaje: 'Falta la fecha.' });

    const config = await ConfiguracionReserva.findOneAndUpdate(
      { fecha },
      { franjas },
      { upsert: true, new: true }
    );

    res.json({ mensaje: 'Configuración guardada correctamente', config });
  } catch (error) {
    logger.error('❌ Error al guardar configuración:', error);
    res.status(500).json({ mensaje: 'Error al guardar la configuración.' });
  }
};
