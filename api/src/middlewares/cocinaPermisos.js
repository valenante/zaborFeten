// middlewares/cocinaPermisos.js
export const requireEstacion = (estacionesPermitidas = []) => (req, res, next) => {
  const role = req.user?.role;
  let estacion = req.user?.estacion;

  if (!role) return res.status(401).json({ error: 'No autenticado' });

  // Admin/supervisor pasan
  if (['admin','supervisor'].includes(role)) return next();

  // Inferir desde roles tipo "cocina-frio" si no vino
  if (!estacion && typeof role === 'string' && role.startsWith('cocina-')) {
    estacion = role.split('-')[1];
    req.user.estacion = estacion;
  }

  // Central (frito) puede pasar si está en la lista
  if (role === 'cocina-frito' && estacionesPermitidas.includes('frito')) return next();

  if (!estacion || !estacionesPermitidas.includes(estacion)) {
    return res.status(403).json({ error: 'Sin permisos (estación)' });
  }
  next();
};
