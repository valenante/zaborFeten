import { getVerifactuEnabled } from '../services/config.service.js';

export const requireVerifactuEnabled = async (req, res, next) => {
  const enabled = await getVerifactuEnabled();
  if (!enabled) {
    return res.status(409).json({ error: 'VeriFactu desactivado' });
  }
  return next();
};
