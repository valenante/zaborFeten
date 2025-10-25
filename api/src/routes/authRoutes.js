import { Router } from 'express';
import { check, validationResult } from 'express-validator';
const router = Router();
import {
  login,
  registro,
  renovarToken,
  logout,
  obtenerUsuario,
  obtenerUsuarios,
  editarUsuario,
  cambiarPasswordUsuario,
  eliminarUsuario
} from '../controllers/authController.js';
import rateLimit from 'express-rate-limit';

// Limitar por IP
export const loginRateLimiterByIP = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos desde esta IP. Intenta de nuevo en 10 minutos.',
    });
  },
});

// Limitar por nombre de usuario
const attemptsPorUsuario = new Map();

export const limitarPorNombreDeUsuario = (req, res, next) => {
  const { name } = req.body;

  // Si no hay name o no es string, no limitar
  if (typeof name !== 'string') return next();

  const clave = name.toLowerCase();
  const ahora = Date.now();
  const datos = attemptsPorUsuario.get(clave) || { intentos: 0, ultimoIntento: ahora };

  if (ahora - datos.ultimoIntento > 60 * 1000) {
    // Resetear si pasó más de un minuto
    attemptsPorUsuario.set(clave, { intentos: 1, ultimoIntento: ahora });
    return next();
  }

  if (datos.intentos >= 5) {
    return res.status(429).json({
      error: 'Demasiados intentos con este nombre de usuario. Espera un minuto.',
    });
  }

  attemptsPorUsuario.set(clave, {
    intentos: datos.intentos + 1,
    ultimoIntento: ahora,
  });

  next();
};

// Ruta de inicio de sesión
router.post(
  '/login',
  loginRateLimiterByIP,
  limitarPorNombreDeUsuario,
  check('name').isString().withMessage('El nombre debe ser texto').notEmpty(),
  check('password').isString().withMessage('La contraseña debe ser texto').notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  login
);

router.get('/me/me', obtenerUsuario);

// Ruta de registro de usuario
router.post(
  '/register',
  [
    check('name', 'El nombre es obligatorio').notEmpty(),
    check(
      'password',
      'La contraseña debe tener al menos 6 caracteres'
    ).isLength({ min: 6 }),
    check('role', 'El rol debe ser admin, camarero o cocinero')
      .optional()
      .isIn(['admin', 'camarero', 'cocinero']),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  registro
);

// Endpoint para renovar token
router.post('/refresh-token', renovarToken);

// Endpoint para cerrar sesión
router.post('/logout', logout);

// Endpoint para obtener todos los usuarios
router.get('/usuarios', obtenerUsuarios);

// Endpoint para editar un usuario
router.put('/usuarios/:id', editarUsuario);

// Endpoint para cambiar la contraseña de un usuario
router.put('/usuarios/:id/password', cambiarPasswordUsuario);

// Endpoint para eliminar un usuario
router.delete('/usuarios/:id', eliminarUsuario);

export default router;
