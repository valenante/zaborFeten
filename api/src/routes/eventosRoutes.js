// routes/eventosRoutes.js
import { Router } from 'express';
import { registrarEvento, resumen6h, exportarEventosXML } from '../controllers/eventosController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: VeriFactu Eventos
 *   description: Registro de eventos (art. 9) y exportación XML (Bloque 5)
 */

router.post('/eventos/log', registrarEvento);
router.post('/eventos/resumen-6h', resumen6h);
router.get('/eventos/export', exportarEventosXML);

export default router;
