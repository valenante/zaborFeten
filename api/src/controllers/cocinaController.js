import Pedido from '../models/Pedido.js'; // Ajusta la ruta según tu proyecto
// GET /api/v1/cocina/items?estacion=frio&estado=pendiente,solicitado,en_preparacion
export const listarItemsCocina = async (req, res) => {
  const estacion = req.query.estacion || 'frito';
  const estados = (req.query.estado || 'pendiente,solicitado,en_preparacion').split(',');

  const pedidos = await Pedido.find(
    {
      'productos.estacion': estacion,
      'productos.workflow.estado': { $in: estados }
    },
    { productos: 1, mesa: 1, sesionId: 1 }
  );

  const items = [];
  for (const p of pedidos) {
    for (const it of p.productos) {
      if (it.estacion === estacion && estados.includes(it.workflow.estado)) {
        items.push({
          pedidoId: p._id,
          itemId: it._id,
          mesa: p.mesa,
          nombre: it.nombre,
          cantidad: it.cantidad,
          estado: it.workflow.estado,
          solicitadoPor: it.workflow.solicitadoPor,
          solicitadoA: it.workflow.solicitadoA,
          tPendiente: it.workflow.tPendiente,
          tSolicitado: it.workflow.tSolicitado,
          tInicio: it.workflow.tInicio,
          tListo: it.workflow.tListo
        });
      }
    }
  }
  res.json({ items });
};

// POST /api/v1/cocina/:pedidoId/items/:itemId/solicitar
// POST /api/v1/cocina/:pedidoId/items/:itemId/solicitar
export const solicitarItem = async (req, res) => {
  try {
    const { pedidoId, itemId } = req.params;
    const { solicitadoA, solicitadoPor } = req.body; // 'frio' | 'plancha'
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const item = pedido.productos.id(itemId);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    // Inicializa workflow y marca como solicitado
    item.workflow = item.workflow || {};
    item.workflow.estado = 'solicitado';
    item.workflow.solicitadoA = solicitadoA;
    item.workflow.solicitadoPor = solicitadoPor;
    item.workflow.tSolicitado = Date.now();

    pedido.markModified('productos');
    await pedido.save();

    // 🔥 Evento global para refrescar todas las cocinas
    req.io.emit('cocina:refresh', {
      source: 'item:solicitar',
      pedidoId,
      itemId: item._id.toString(),
      solicitadoA,
      ts: Date.now(),
    });

    console.log('[emit] cocina:refresh', { source: 'item:solicitar', pedidoId, itemId });

    return res.json({ ok: true, item });
  } catch (err) {
    console.error('[solicitarItem] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /api/v1/cocina/:pedidoId/items/:itemId/empezar
export const empezarItem = async (req, res) => {
  const { pedidoId, itemId } = req.params;
  const { estacion, role } = req.user || {};

  const pedido = await Pedido.findById(pedidoId);
  const item = pedido?.productos.id(itemId);
  if (!item) return res.status(404).json({ error: 'Item no encontrado' });

  // permite central/admin/supervisor
  const isCentral = role === 'admin' || role === 'supervisor' || estacion === 'frito';
  if (item.estacion !== estacion && !isCentral) {
    return res.status(403).json({ error: 'No autorizado para esta estación' });
  }
  if (!['pendiente', 'solicitado'].includes(item.workflow.estado)) {
    return res.status(400).json({ error: 'Transición inválida' });
  }

  item.workflow.estado = 'en_preparacion';
  item.workflow.tInicio = Date.now();
  await pedido.save();

  req.io.to(`cocina:${item.estacion}`).emit('kitchen:update', {
    type: 'itemEnPreparacion',
    pedidoId,
    item: item.toObject()
  });
  // notifica también a la central si quieres
  req.io.to('cocina:frito').emit('kitchen:update', {
    type: 'itemEnPreparacion',
    pedidoId,
    item: item.toObject()
  });

  res.json({ ok: true, item });
};
// POST /api/v1/cocina/:pedidoId/items/:itemId/listo
export const marcarItemListo = async (req, res) => {
  try {
    const { pedidoId, itemId } = req.params;
    const { role, estacion } = req.user || {};

    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const item = pedido.productos.id(itemId);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    // Permisos: central/admin pueden todo
    const isCentral = role === 'admin' || role === 'supervisor' || estacion === 'frito';
    if (item.estacion && item.estacion !== estacion && !isCentral) {
      return res.status(403).json({ error: 'No autorizado para esta estación' });
    }

    // Asegura workflow
    item.workflow = item.workflow || { estado: 'pendiente', tPendiente: Date.now() };

    const ahora = Date.now();
    const next = (req.body?.estado === 'pendiente' || req.body?.estado === 'listo')
      ? req.body.estado
      : 'listo'; // por defecto marcar a listo

    // ⬇️ SINCRONIZA AMBOS CAMPOS SIEMPRE
    if (next === 'listo') {
      item.workflow.estado = 'listo';
      item.workflow.tInicio = item.workflow.tInicio || ahora;
      item.workflow.tListo = ahora;
      item.estadoPreparacion = 'listo';
    } else {
      item.workflow.estado = 'pendiente';
      item.estadoPreparacion = 'pendiente';
    }

    console.log('Item actualizado:', item);

    pedido.markModified('productos');
    await pedido.save();

    // 🔥 evento global para que el front recargue
    req.io.emit('cocina:refresh', {
      source: 'item:estado',
      pedidoId,
      itemId: item._id.toString(),
      estado: item.workflow.estado,
      estadoPreparacion: item.estadoPreparacion,
      ts: Date.now(),
    });

    return res.json({ ok: true, item });
  } catch (err) {
    console.error('[marcarItemListo] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

