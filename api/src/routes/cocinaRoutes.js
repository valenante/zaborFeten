import { Router } from 'express';
const router = Router();
import {
listarItemsCocina,
solicitarItem,
empezarItem,
marcarItemListo,
productosListosResumen
} from '../controllers/cocinaController.js';

import { requireEstacion } from '../middlewares/cocinaPermisos.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';


router.get('/items', listarItemsCocina);

/**
 * @swagger
 * tags:
 *   name: Cocina
 *   description: Flujo de preparación por estaciones
 */

// Solicitar ítem a otra estación (solo central o sala)
 /**
  * @swagger
  * /cocina/pedidos/{pedidoId}/items/{itemId}/solicitar:
  *   post:
  *     summary: Solicitar a una estación que prepare un ítem
  *     tags: [Cocina]
  *     parameters:
  *       - in: path
  *         name: pedidoId
  *         required: true
  *       - in: path
  *         name: itemId
  *         required: true
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             properties:
  *               solicitadoA:
  *                 type: string
  *                 enum: [frio, frito, plancha]
  *               solicitadoPor:
  *                 type: string
  *                 enum: [frito, sala]
  *     responses:
  *       200: { description: OK }
  */
router.post(
  '/:pedidoId/items/:itemId/solicitar',
  authMiddleware,
  solicitarItem
);

// Empezar preparación (solo la estación asignada)
 /**
  * @swagger
  * /cocina/pedidos/{pedidoId}/items/{itemId}/empezar:
  *   post:
  *     summary: Marcar un ítem como en preparación
  *     tags: [Cocina]
  */
router.post(
  '/:pedidoId/items/:itemId/empezar',
  requireEstacion(['frio','frito','plancha']),
  empezarItem
);

// Marcar listo (solo la estación asignada)
 /**
  * @swagger
  * /cocina/pedidos/{pedidoId}/items/{itemId}/listo:
  *   post:
  *     summary: Marcar un ítem como listo
  *     tags: [Cocina]
  */
router.post(
  '/:pedidoId/items/:itemId/estado',
  authMiddleware,
  requireEstacion(['frio','frito','plancha']),
  marcarItemListo
);

router.get('/productos-listos', productosListosResumen);

export default router;