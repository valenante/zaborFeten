import { Router } from 'express';
import { setVerifactuEnabled, getVerifactuEnabled } from '../services/config.service.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

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
  const { enabled } = req.body;          // boolean
  const val = await setVerifactuEnabled(enabled);
  // evento global: que todas las UIs se refresquen
  req.io?.emit?.('config:refresh', { key: 'verifactu.enabled', value: val, ts: Date.now() });
  res.json({ enabled: val });
});

export default router;
