// routes/facturacionRoutes.js
import { Router } from 'express';
import SifConfig from '../models/SifConfig.js';
import ObligadoTributario from '../models/ObligadoTributario.js';
import { buildDeclaracionResponsable } from '../services/drService.js';
import { authMiddleware } from '../middlewares/authMiddleware.js'; // ya lo tienes

const router = Router();

// Obtener config SIF
router.get('/sif', authMiddleware, async (req, res) => {
  const cfg = await SifConfig.findOne();
  res.json(cfg || null);
});

// Crear/actualizar config SIF (simple upsert)
router.put('/sif', authMiddleware, async (req, res) => {
  const data = req.body; // valida en serio en prod
  const cfg = await SifConfig.findOneAndUpdate({}, data, { upsert: true, new: true });
  res.json(cfg);
});

// Declaración Responsable (HTML)
router.get('/declaracion-responsable', authMiddleware, async (req, res) => {
  const sif = await SifConfig.findOne();
  if (!sif) return res.status(404).json({ error: 'SIF no configurado' });

  const ots = await ObligadoTributario.find({ activo: true });
  const html = buildDeclaracionResponsable({
    sif,
    productor: sif.productor,
    otActivos: ots,
    versionSif: sif.version,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
