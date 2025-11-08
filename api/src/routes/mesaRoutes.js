/**
 * @swagger
 * tags:
 *   name: Mesas
 *   description: Gestión de mesas (activas, cerradas, historial, tokens, etc.)
 */

import { Router } from 'express';
const router = Router();
import {
  cerrarMesa,
  obtenerMesasAbiertas,
  obtenerMesasCerradas,
  getHistorialMesas,
  recuperarMesa,
  crearMesa,
  eliminarMesa,
  obtenerMesas,
  obtenerMesaPorId,
  obtenerMesaPorNumero,
  verificarTokenLider,
  verificarTokenLiderPorNumero,
  crearTokenLider,
  registrarComensal,
  abrirMesaCamarero,
  transferirProducto,
  actualizarComensales,
} from '../controllers/mesaController.js';

/**
 * @swagger
 * /mesas:
 *   get:
 *     summary: Obtener todas las mesas activas
 *     tags: [Mesas]
 */
router.get('/', obtenerMesas);

/**
 * @swagger
 * /mesas/{id}:
 *   get:
 *     summary: Obtener una mesa activa por ID
 *     tags: [Mesas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la mesa
 */
router.get('/:id', obtenerMesaPorId);

/**
 * @swagger
 * /mesas/crear-mesa/crear-mesa:
 *   post:
 *     summary: Crear una nueva mesa
 *     tags: [Mesas]
 */
router.post('/crear-mesa/crear-mesa', crearMesa);

/**
 * @swagger
 * /mesas/recuperar-mesa/{mesaId}:
 *   post:
 *     summary: Recuperar una mesa cerrada
 *     tags: [Mesas]
 *     parameters:
 *       - in: path
 *         name: mesaId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la mesa
 */
router.post('/recuperar-mesa/:mesaId', recuperarMesa);

/**
 * @swagger
 * /mesas/comensal:
 *   post:
 *     summary: Registrar comensal
 *     tags: [Mesas]
 */
router.post('/comensal', registrarComensal);

/**
 * @swagger
 * /mesas/{id}/cerrar:
 *   put:
 *     summary: Cerrar una mesa
 *     tags: [Mesas]
 */
router.put('/:id/cerrar', cerrarMesa);

/**
 * @swagger
 * /mesas/historial:
 *   get:
 *     summary: Obtener historial de mesas cerradas
 *     tags: [Mesas]
 */
router.get('/historial', getHistorialMesas);

/**
 * @swagger
 * /mesas/{numeroMesa}:
 *   get:
 *     summary: Obtener una mesa activa por número
 *     tags: [Mesas]
 */
router.get('/:numeroMesa', obtenerMesaPorNumero);

/**
 * @swagger
 * /mesas/token-lider/token-lider/check/{mesaId}:
 *   get:
 *     summary: Verificar token de líder por mesa ID
 *     tags: [Mesas]
 */
router.get('/token-lider/token-lider/check/:mesaId', verificarTokenLider);

/**
 * @swagger
 * /mesas/token-lider/token-lider/check:
 *   get:
 *     summary: Verificar token de líder por número de mesa (query param)
 *     tags: [Mesas]
 */
router.get('/token-lider/token-lider/check', verificarTokenLiderPorNumero);

/**
 * @swagger
 * /mesas/token-lider/token-lider:
 *   post:
 *     summary: Crear token de líder
 *     tags: [Mesas]
 */
router.post('/token-lider/token-lider', crearTokenLider);

/**
 * @swagger
 * /mesas/mesas-cerradas/mesas-cerradas:
 *   get:
 *     summary: Obtener mesas cerradas
 *     tags: [Mesas]
 */
router.get('/mesas-cerradas/mesas-cerradas', obtenerMesasCerradas);

/**
 * @swagger
 * /mesas/mesas-abiertas/mesas-abiertas:
 *   get:
 *     summary: Obtener mesas abiertas
 *     tags: [Mesas]
 */
router.get('/mesas-abiertas/mesas-abiertas', obtenerMesasAbiertas);

/**
 * @swagger
 * /mesas/mesas/{id}/abrir:
 *   put:
 *     summary: Abrir una mesa como camarero
 *     tags: [Mesas]
 */
router.put('/mesas/:id/abrir', abrirMesaCamarero);

/**
 * @swagger
 * /mesas/eliminar-mesa:
 *   delete:
 *     summary: Eliminar una mesa
 *     tags: [Mesas]
 */
router.delete('/eliminar-mesa', eliminarMesa);

/**
 * @swagger
 * /mesas/mesas/transferir-producto:
 *   post:
 *     summary: Transferir un producto de una mesa a otra
 *     tags: [Mesas]
 */
router.post('/mesas/transferir-producto', transferirProducto);

router.put('/:id/comensales', actualizarComensales);

export default router;
