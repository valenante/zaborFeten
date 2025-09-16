import { Router } from 'express';
import { setVerifactuEnabled, getVerifactuEnabled } from '../services/config.service.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { buildRegistroEventoNode, EVENT_TYPES } from '../services/eventLog.js';

const router = Router();

// Solo admin/supervisor
const requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (!['admin'].includes(role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
};

router.get('/verifactu', authMiddleware, requireAdmin, async (req, res) => {
  res.json({ enabled: await getVerifactuEnabled() });
});

router.post('/verifactu/toggle', authMiddleware, requireAdmin, async (req, res) => {
  const { enabled } = req.body;
  const val = await setVerifactuEnabled(enabled);

  // Generar evento correspondiente
  const tipoEvento = val
    ? EVENT_TYPES.FIN_NO_VERIFACTU
    : EVENT_TYPES.INICIO_NO_VERIFACTU;

  await buildRegistroEventoNode({
    ot: { nif: 'X6063327K', nombreRazon: 'ANTENUCCI AGUILAR VALENTINO NAHUEL' },
    tipoEvento,
    datos: { motivo: 'Cambio de estado VeriFactu desde panel admin' },
  });

  req.io?.emit?.('config:refresh', { key: 'verifactu.enabled', value: val, ts: Date.now() });
  res.json({ enabled: val });
});

export default router;
