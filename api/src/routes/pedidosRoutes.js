/**
 * @swagger
 * tags:
 *   name: Pedidos
 *   description: Gestión de pedidos de comida
 */

import { Router } from 'express';
const router = Router();
import {
  agregarProductoAlPedido,
  verificarPedidosMesa,
  obtenerPedidos,
  obtenerPedidosId,
  obtenerPedidosPendientes,
  obtenerPedidosFinalizados,
  crearPedido,
  actualizarPedido,
  actualizarProducto,
  eliminarPedido,
  obtenerPedidoPorMesaId,
  cerrarEstacion,
} from '../controllers/pedidosController.js';
import verificarLider from '../middlewares/verificarLider.js';

/**
 * @swagger
 * /pedidos:
 *   get:
 *     summary: Obtener todos los pedidos
 *     tags: [Pedidos]
 *     responses:
 *       200:
 *         description: Lista de pedidos
 */
router.get('/', obtenerPedidos);

/**
 * @swagger
 * /pedidos/{id}:
 *   get:
 *     summary: Obtener un pedido por ID
 *     tags: [Pedidos]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido obtenido correctamente
 */
router.get('/:id', obtenerPedidosId);

/**
 * @swagger
 * /pedidos/pendientes/pendientes:
 *   get:
 *     summary: Obtener pedidos pendientes
 *     tags: [Pedidos]
 *     responses:
 *       200:
 *         description: Lista de pedidos pendientes
 */
router.get('/pendientes/pendientes', obtenerPedidosPendientes);

/**
 * @swagger
 * /pedidos/finalizados/finalizados:
 *   get:
 *     summary: Obtener pedidos finalizados
 *     tags: [Pedidos]
 *     responses:
 *       200:
 *         description: Lista de pedidos finalizados
 */
router.get('/finalizados/finalizados', obtenerPedidosFinalizados);

/**
 * @swagger
 * /pedidos/pedidos/estado/{numeroMesa}:
 *   get:
 *     summary: Obtener pedidos finalizados por número de mesa
 *     tags: [Pedidos]
 *     parameters:
 *       - name: numeroMesa
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pedidos finalizados por mesa
 */
router.get('/pedidos/estado/:numeroMesa', verificarPedidosMesa);

/**
 * @swagger
 * /pedidos/mesa/{mesaId}:
 *   get:
 *     summary: Obtener pedido por ID de mesa
 *     tags: [Pedidos]
 *     parameters:
 *       - name: mesaId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido encontrado para la mesa
 */
router.get('/mesa/:mesaId', obtenerPedidoPorMesaId);

/**
 * @swagger
 * /pedidos:
 *   post:
 *     summary: Crear un nuevo pedido
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mesaId:
 *                 type: string
 *               productos:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Pedido creado correctamente
 */
router.post('/',verificarLider ,crearPedido );

/**
 * @swagger
 * /pedidos/{mesaId}/agregar-producto:
 *   post:
 *     summary: Agregar producto a un pedido
 *     tags: [Pedidos]
 *     parameters:
 *       - name: mesaId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               producto:
 *                 type: object
 *     responses:
 *       200:
 *         description: Producto agregado correctamente
 */
router.post('/:mesaId/agregar-producto', agregarProductoAlPedido);

/**
 * @swagger
 * /pedidos/{id}:
 *   put:
 *     summary: Actualizar un pedido por ID
 *     tags: [Pedidos]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Pedido actualizado correctamente
 */
router.put('/:id', actualizarPedido);

/**
 * @swagger
 * /pedidos/{pedidoId}/producto/{productoId}:
 *   put:
 *     summary: Actualizar estado de un producto en un pedido
 *     tags: [Pedidos]
 *     parameters:
 *       - name: pedidoId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: productoId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto actualizado correctamente
 */
router.put('/:pedidoId/producto/:productoId', actualizarProducto);

/**
 * @swagger
 * /pedidos/{pedidoId}/{id}:
 *   delete:
 *     summary: Eliminar un producto de un pedido
 *     tags: [Pedidos]
 *     parameters:
 *       - name: pedidoId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto eliminado correctamente
 */
router.delete('/:pedidoId/:id', eliminarPedido);

router.put('/:pedidoId/cerrar-estacion', cerrarEstacion);

export default router;
