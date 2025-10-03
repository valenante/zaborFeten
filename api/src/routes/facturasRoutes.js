import express from 'express';
import {
  listarFacturasEncadenadas,
  exportarFacturasCSV,
  rectificarFactura,
  verificarFactura,
  anularFactura
} from '../controllers/facturasController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Facturas
 *   description: Gestión de facturas y facturación encadenada
 */

/**
 * @swagger
 * /facturas/facturas-encadenadas:
 *   get:
 *     summary: Listar facturas encadenadas
 *     tags: [Facturas]
 *     responses:
 *       200:
 *         description: Lista de facturas encadenadas obtenida exitosamente
 *       500:
 *         description: Error del servidor
 */
router.get('/facturas-encadenadas', listarFacturasEncadenadas);

/**
 * @swagger
 * /facturas/exportar-csv:
 *   get:
 *     summary: Exportar facturas encadenadas como CSV
 *     tags: [Facturas]
 *     responses:
 *       200:
 *         description: CSV generado exitosamente
 *       500:
 *         description: Error al generar CSV
 */
router.get('/exportar-csv', exportarFacturasCSV);

/**
 * @swagger
 * /facturas/rectificar/{id}:
 *   post:
 *     summary: Rectificar una factura
 *     tags: [Facturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID de la factura a rectificar
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Motivo de la rectificación (opcional)
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Factura rectificada correctamente
 *       404:
 *         description: Factura no encontrada
 *       500:
 *         description: Error en la rectificación
 */
router.post('/rectificar/:id', rectificarFactura);

/**
 * @swagger
 * /facturas/verificar/{hash}:
 *   get:
 *     summary: Verificar una factura por su hash
 *     tags: [Facturas]
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         description: Hash de la factura a verificar
 *         schema:
 *           type: string
 *           example: abc123
 *     responses:
 *       200:
 *         description: Datos de la factura verificada
 *       404:
 *         description: Factura no encontrada
 *       500:
 *         description: Error interno del servidor
 */

router.get('/verificar-factura/:hash', verificarFactura);

/**
 * @swagger
 * /facturas/anular/{id}:
 *   post:
 *     summary: Anular una factura
 *    tags: [Facturas]
 *     parameters:  
 *     - in: path
 *      name: id
 *    required: true
 *    description: ID de la factura a anular
 *    schema:
 *     type: string
 *    requestBody:
 *    description: Motivo de la anulación (opcional)
 *   required: false
 *  content:
 *    application/json:
 *     schema:
 *      type: object
 *     properties:
 *     motivo:
 *    type: string
 *    responses:
 *    200:
 *    description: Factura anulada correctamente
 *  404:
 *   description: Factura no encontrada
 *  500:
 *  description: Error en la anulación
 * /
*/
router.post('/anular/:id', anularFactura);

export default router;
