// services/configService.js
import Config from '../models/Config.js';

const CACHE_KEY = 'verifactu.enabled';
let cache = new Map();

/** Garantiza que exista el doc global */
async function ensureConfig() {
  const cfg = await Config.findByIdAndUpdate(
    'global',
    {}, // no cambiamos nada
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return cfg;
}

export async function getVerifactuEnabled() {
  if (cache.has(CACHE_KEY)) return cache.get(CACHE_KEY);

  const cfg = await ensureConfig();
  const enabled = !!cfg.verifactuEnabled;
  cache.set(CACHE_KEY, enabled);
  return enabled;
}

export async function setVerifactuEnabled(val) {
  const enabled = !!val;
  const cfg = await Config.findByIdAndUpdate(
    'global',
    {
      $set: {
        verifactuEnabled: enabled,
        fechaActivacionVerifactu: enabled ? new Date() : null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const out = !!cfg.verifactuEnabled;
  cache.set(CACHE_KEY, out);
  return out;
}
