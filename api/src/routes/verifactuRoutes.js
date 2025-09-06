// routes/verifactuRoutes.js
import express, { Router } from 'express';
import { crearRegistroAlta, crearRegistroAnulacion, verificarFirma, enviarAEAT } from '../controllers/verifactuController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireVerifactuEnabled } from '../middlewares/verifactuGate.js';


const router = Router();

/**
 * @swagger
 * tags:
 *   name: VeriFactu Registros
 *   description: Generación de RegistroAlta / RegistroAnulacion (con encadenado)
 */

router.post('/registros/alta', crearRegistroAlta);
router.post('/registros/anulacion', crearRegistroAnulacion);

// Verificación: acepta JSON { xml } o text/xml (si configuras body parser para text)
router.post('/firma/verificar', verificarFirma);

// Nuevo: recibir directamente XML
router.post(
  '/firma/verificar-xml',
  express.text({ type: ['text/*','application/xml'], limit: '10mb' }),
  async (req, res) => {
    try {
      const xml = req.body;
      const { verifyXades } = await import('../services/xadesService.js');
      const result = await verifyXades(xml);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok:false, error: e.message });
    }
  }
);

router.post("/pre/enviar", authMiddleware, requireVerifactuEnabled, enviarAEAT);


export default router;
