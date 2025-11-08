/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: Gestión de productos del sistema
 */

import { Router } from 'express';
import { check } from 'express-validator';
import {
  obtenerProductos,
  obtenerCategoriasPorTipo,
  obtenerProductosPorCategoria,
  editarProducto,
  crearProducto,
  eliminarProducto,
  eliminarProductoPedido,
  obtenerProductoPorId,
  buscarProductoPorNombre,
} from '../controllers/productosController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { checkRole } from '../middlewares/checkRole.js';

const router = Router();

/**
 * @swagger
 * /productos:
 *   get:
 *     summary: Obtener todos los productos
 *     tags: [Productos]
 *     responses:
 *       200:
 *         description: Lista de productos
 */
router.get('/', obtenerProductos);

/**
 * @swagger
 * /productos/{id}:
 *   get:
 *     summary: Obtener un producto por ID
 *     tags: [Productos]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del producto (MongoDB)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto obtenido correctamente
 */
router.get('/:id', [check('id').isMongoId()], obtenerProductoPorId);

/**
 * @swagger
 * /productos/categories/{type}:
 *   get:
 *     summary: Obtener categorías de productos por tipo
 *     tags: [Productos]
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         description: Tipo de producto (plato o bebida)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de categorías
 */
router.get('/categories/:type', obtenerCategoriasPorTipo);

/**
 * @swagger
 * /productos/category/{category}:
 *   get:
 *     summary: Obtener productos por categoría
 *     tags: [Productos]
 *     parameters:
 *       - name: category
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Productos filtrados por categoría
 */
router.get('/category/:category', obtenerProductosPorCategoria);

/**
 * @swagger
 * /productos:
 *   post:
 *     summary: Crear un nuevo producto (admin)
 *     tags: [Productos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - categoria
 *               - precios
 *               - tipo
 *             properties:
 *               nombre:
 *                 type: string
 *               categoria:
 *                 type: string
 *               tipo:
 *                 type: string
 *                 enum: [plato, bebida]
 *               precios:
 *                 type: object
 *                 properties:
 *                   precioBase:
 *                     type: number
 *               stock:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Producto creado correctamente
 */
router.post(
  '/',
  authMiddleware,
  checkRole(['admin']),
  [
    check('nombre').notEmpty(),
    check('categoria').notEmpty(),
    check('precios.precioBase').isFloat({ min: 0 }),
    check('stock').optional().isInt({ min: 0 }),
    check('tipo').isIn(['plato', 'bebida']),
  ],
  crearProducto
);

/**
 * @swagger
 * /productos/buscar/buscar:
 *   get:
 *     summary: Buscar productos por nombre
 *     tags: [Productos]
 *     parameters:
 *       - name: nombre
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de productos que coinciden
 */
router.get('/buscar/buscar', buscarProductoPorNombre);

/**
 * @swagger
 * /productos/{id}:
 *   put:
 *     summary: Editar un producto (admin)
 *     tags: [Productos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del producto
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               precios:
 *                 type: object
 *                 properties:
 *                   precioBase:
 *                     type: number
 *               stock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Producto actualizado
 */
router.put(
  '/:id',
  authMiddleware,
  checkRole(['admin']),
  [
    check('id').isMongoId(),
    check('nombre').optional().notEmpty(),
    check('precios.precioBase').optional().isFloat({ min: 0 }),
    check('stock').optional().isInt({ min: 0 }),
  ],
  editarProducto
);

/**
 * @swagger
 * /productos/{id}:
 *   delete:
 *     summary: Eliminar un producto (admin)
 *     tags: [Productos]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del producto a eliminar
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto eliminado correctamente
 */
router.delete('/:id', eliminarProducto);

/**
 * @swagger
 * /productos/{pedidoId}/{id}:
 *   post:
 *     summary: Eliminar un producto de un pedido
 *     tags: [Productos]
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
 *         description: Producto eliminado del pedido correctamente
 */
router.post(
  '/:pedidoId/:id',
  authMiddleware,            // ✅ valida el token y rellena req.user
  eliminarProductoPedido
);

export default router;
