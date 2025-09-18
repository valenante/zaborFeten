import Pedido from '../models/Pedido.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado
import PedidoBebida from '../models/PedidoBebidas.js';
import Mesa from '../models/Mesa.js';
import Venta from '../models/Ventas.js';
import Cart from '../models/Cart.js';
import Producto from '../models/Producto.js';
import SesionMesa from '../models/SesionMesa.js';
import { roomEstacion } from '../helpers/socketRooms.js';
import { io } from '../../index.js';

// Crear un nuevo pedido
import axios from 'axios';

const IMPRESION_SERVER = process.env.IMPRESION_SERVER

// ==== Helpers para texto de locución ====
const limpiar = (s) => (s ?? "").toString().trim();
const artCant = (n) => (Number(n) === 1 ? "un" : String(n));

const labelTipoPrecio = (tp) => {
  const t = (tp || "").toLowerCase();
  if (!t || t === "preciobase" || t === "base" || t === "precio base") return ""; // no decir nada
  const mapa = { tapa: "tapa", racion: "ración", media: "media", surtido: "surtido" };
  return mapa[t] || t;
};

const juntar = (arr, prop = "nombre") =>
  (arr || [])
    .map((x) => (prop ? limpiar(x?.[prop]) : limpiar(x)))
    .filter(Boolean)
    .join(", ");

export const crearPedido = async (req, res) => {
  try {
    const {
      mesa,
      productos = [],   // [{ producto, cantidad, total, ... }]
      comensales,
      alergias,
      pan,
      cartId,
      precioSeleccionado,
      tipoPrecio,
    } = req.body;

    const mesaExistente = await Mesa.findById(mesa);
    if (!mesaExistente) {
      logger.error('Mesa no encontrada');
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    // 1) Traer catálogo
    const idsProductos = productos.map(p => p.producto);
    const productosDB = await Producto.find({ _id: { $in: idsProductos } });

    const now = Date.now();
    const productosCompletos = productos.map((p) => {
      const info = productosDB.find(x => x._id.toString() === String(p.producto));
      const estacion = info?.estacion || 'frito';
      return {
        ...p,
        nombre: info?.nombre || p.nombre,
        categoria: p.categoria || info?.categoria,
        tipo: p.tipo || info?.tipo || 'plato',
        tipoPrecio: p.tipoPrecio || info?.tipoPrecio || 'tapa',
        estacion, // 👈 **clave** para pantallas
        workflow: {
          estado: 'pendiente',
          solicitadoPor: null,
          solicitadoA: estacion, // 👈 arranca apuntando a su estación natural
          tPendiente: now,
          tSolicitado: null,
          tInicio: null,
          tListo: null,
        },
      };
    });

    // 2) total confiable
    const totalPedido = Number(productosCompletos.reduce((s, it) => s + (it.total || 0), 0).toFixed(2));

    // 3) Crea pedido
    const nuevoPedido = new Pedido({
      productos: productosCompletos,
      total: totalPedido,
      comensales,
      alergias,
      pan,
      tipoPrecio,
      mesa: mesaExistente._id,
      precioSeleccionado,
      sesionId: mesaExistente.sesionActiva,
      estado: 'pendiente',
    });

    await nuevoPedido.save();

    // 4) Actualiza mesa
    mesaExistente.pedidos.push(nuevoPedido._id);
    mesaExistente.total = Number((mesaExistente.total + totalPedido).toFixed(2));
    await mesaExistente.save();

    // 5) Ventas + stock
    for (const item of productosCompletos) {
      const venta = new Venta({
        producto: item.producto,
        pedidoId: nuevoPedido._id,
        cantidad: item.cantidad,
        tipo: item.tipo || 'plato',
        total: item.total || 0,
      });
      await venta.save();

      const prodDB = productosDB.find(pd => pd._id.toString() === String(item.producto));
      if (prodDB) {
        prodDB.ventas.push(venta._id);
        prodDB.stock -= item.cantidad;
        await prodDB.save();
      } else {
        logger.error('Producto no encontrado en la base de datos:', item.producto);
        return res.status(400).json({ error: 'Producto no encontrado en la base de datos' });
      }
    }

    if (cartId) await Cart.findByIdAndDelete(cartId);

    // 6) Sockets

    // a) Emisión general
    req.io.emit('nuevoPedido', {
      tipo: 'crear',
      mesaId: mesaExistente._id.toString(),
      pedido: nuevoPedido.toObject(),
    });

    // b) Por estación (kitchen:newItems)
    // Tras el save, los subdocs ya tienen _id. Hacemos pairing por índice.
    const porEstacion = {};
    nuevoPedido.productos.forEach((it, idx) => {
      const est = it.estacion || 'frito';
      (porEstacion[est] ||= []).push({
        pedidoId: nuevoPedido._id,
        item: it.toObject(),
        mesa: { _id: mesaExistente._id, numero: mesaExistente.numero },
      });
    });

    Object.entries(porEstacion).forEach(([est, items]) => {
      req.io.to(`cocina:${est}`).emit('kitchen:newItems', { estacion: est, items });
    });

    // Opcional: mandar todo también a la central
    req.io.to('cocina:frito').emit('kitchen:newItems', {
      estacion: 'frito',
      items: Object.values(porEstacion).flat(),
    });

    // 7) TTS cocina
    const itemsDetallados = productosCompletos
      .filter((p) => ['plato', 'tapaRacion'].includes(p.tipo))
      .map((p) => {
        const prodInfo = productosDB.find((pd) => pd._id.toString() === p.producto.toString());
        const nombre = prodInfo?.nombre || 'Producto';
        const cant = artCant(p.cantidad);
        const tp = labelTipoPrecio(p.tipoPrecio);
        const conExtras = [juntar(p.adicionales), juntar(p.extras)].filter(Boolean).join(', ');
        const sinIngr = juntar(p.ingredientesEliminados, null);
        const nota = limpiar(p.mensaje);
        const tipoPlatoTxt = p.tipoPrecio === 'individual' ? 'individual'
          : p.tipoPrecio === 'compartir' ? 'para compartir' : '';
        const partes = [`${cant} ${nombre}`, tp || '', tipoPlatoTxt || '', conExtras ? `con ${conExtras}` : '', sinIngr ? `sin ${sinIngr}` : '', nota ? `nota: ${nota}` : ''].filter(Boolean);
        return {
          nombre, cantidad: p.cantidad, tipoPrecio: p.tipoPrecio, adicionales: p.adicionales, extras: p.extras,
          ingredientesEliminados: p.ingredientesEliminados, mensaje: p.mensaje, tipoPlato: p.tipoPlato, seccion: p.seccion,
          texto: partes.join(', ')
        };
      });

    const notasGlobales = productosCompletos.map(p => limpiar(p.mensaje)).filter(Boolean).join('. ');
    const alergiasItems = productosCompletos
      .map(p => limpiar(p.alergiasComensal))
      .filter(Boolean); const lecturaKey = `${nuevoPedido._id}:${mesaExistente.numero}:${itemsDetallados.map(i => i.texto).join('|')}`;

    req.io.emit('nuevaComanda', {
      area: 'cocina',
      mesa: mesaExistente.numero,
      items: itemsDetallados,
      itemsTexto: itemsDetallados.map(i => i.texto),
      alergias: alergiasItems,
      notas: notasGlobales,
      lecturaKey,
    });

    res.status(201).json({
      message: 'Pedido creado con éxito',
      pedidoId: nuevoPedido._id,
      pedido: nuevoPedido,
    });
  } catch (error) {
    logger.error('Error al procesar el pedido:', error);
    res.status(400).json({ error: error.message });
  }
};

export const agregarProductoAlPedido = async (req, res) => {
  const { mesaId } = req.params;
  const { productos } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos un producto válido.' });
  }

  const errores = productos.filter(
    (p) => !p.producto || !p.cantidad || !p.total || !p.precioSeleccionado
  );
  if (errores.length > 0) {
    return res.status(400).json({
      error: 'Cada producto debe tener: producto, cantidad, total y precioSeleccionado.',
    });
  }

  try {
    // === Buscar mesa (por ObjectId o por número)
    const mesa = /^[0-9a-fA-F]{24}$/.test(mesaId)
      ? await Mesa.findById(mesaId).populate('pedidos')
      : await Mesa.findOne({ numero: parseInt(mesaId, 10) }).populate('pedidos');

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    // === Verificar sesión activa
    const sesionActiva = await SesionMesa.findOne({ mesa: mesa._id, estado: 'activa' });
    if (!sesionActiva) {
      return res.status(400).json({ error: 'La mesa no tiene una sesión activa.' });
    }

    // === Traer info de catálogo para enriquecer
    const idsProductos = productos.map((p) => p.producto);
    const productosDB = await Producto.find({ _id: { $in: idsProductos } });

    const productosCompletos = productos.map((p) => {
      const prodInfo = productosDB.find((x) => x._id.toString() === p.producto.toString());
      const estacion = prodInfo?.estacion || 'frito'; // fallback seguro
      return {
        ...p,
        nombre: prodInfo?.nombre,
        categoria: p.categoria || prodInfo?.categoria,
        tipo: p.tipo || prodInfo?.tipo || 'plato',
        tipoPrecio: p.tipoPrecio || prodInfo?.tipoPrecio || 'tapa',
        estacion,
        workflow: {
          estado: 'pendiente',
          solicitadoPor: null,
          solicitadoA: estacion,
          tPendiente: Date.now(),
          tSolicitado: null,
          tInicio: null,
          tListo: null,
        },
      };
    });

    // === Agregar a pedido pendiente existente o crear uno nuevo
    let pedidoModificado;
    const pedidoExistente = mesa.pedidos.find((p) => p.estado === 'pendiente');

    if (pedidoExistente) {
      productosCompletos.forEach((p) => {
        pedidoExistente.productos.push({ ...p });
        pedidoExistente.total += p.total;
      });
      pedidoModificado = await pedidoExistente.save();
    } else {
      const nuevoPedido = new Pedido({
        mesa: mesa._id,
        sesionId: sesionActiva._id,
        productos: productosCompletos,
        estado: 'pendiente',
        total: productosCompletos.reduce((sum, p) => sum + p.total, 0),
      });
      pedidoModificado = await nuevoPedido.save();
      mesa.pedidos.push(pedidoModificado._id);
    }

    // === Recalcular total de la mesa (evita errores por concurrencia)
    const pedidos = await Pedido.find({
      mesa: mesa._id,
      sesionId: sesionActiva._id,
      estado: { $in: ['pendiente', 'listo'] }
    });

    const pedidosBebidas = await PedidoBebida.find({
      mesa: mesa._id,
      sesionId: sesionActiva._id,
      estado: { $in: ['pendiente', 'listo'] }
    });

    const totalPedidos = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalBebidas = pedidosBebidas.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalMesa = totalPedidos + totalBebidas;

    mesa.total = parseFloat(totalMesa.toFixed(2));
    await mesa.save();

    // === Registrar ventas + actualizar stock
    for (const producto of productosCompletos) {
      const venta = new Venta({
        producto: producto.producto,
        pedidoId: pedidoModificado._id,
        cantidad: producto.cantidad,
        tipo: producto.tipo || 'plato',
        total: producto.total,
      });
      await venta.save();

      const productoEnDB = productosDB.find((p) => p._id.toString() === producto.producto.toString());
      if (productoEnDB) {
        productoEnDB.ventas.push(venta._id);
        productoEnDB.stock -= producto.cantidad;
        await productoEnDB.save();
      } else {
        logger.error('Producto no encontrado al registrar venta:', producto.producto);
      }
    }

    // === SOCKETS (general)
    req.io.emit('nuevoPedido', {
      tipo: 'agregar',
      mesaId: mesa._id.toString(),
      pedido: pedidoModificado.toObject(),
    });

    // === SOCKETS por estación (frio/frito/plancha) + central (frito)
    // Identificar cuáles son los ítems recién agregados en el documento guardado
    // (mapeo por (producto,cantidad,total,nombre) es suficiente en práctica; si quieres más robustez, añade un UUID cliente)
    const nuevosItemsGuardados = [];
    for (const it of pedidoModificado.productos) {
      const match = productosCompletos.find(
        (p) =>
          String(p.producto) === String(it.producto) &&
          p.cantidad === it.cantidad &&
          Number(p.total) === Number(it.total) &&
          (p.nombre || '') === (it.nombre || '')
      );
      if (match) {
        nuevosItemsGuardados.push({
          pedidoId: pedidoModificado._id,
          item: it.toObject(),
          mesa: { _id: mesa._id, numero: mesa.numero },
        });
      }
    }

    // Agrupar por estación
    const porEstacion = nuevosItemsGuardados.reduce((acc, it) => {
      const est = it.item.estacion || 'frito';
      (acc[est] ||= []).push(it);
      return acc;
    }, {});

    // Emitir a cada sala de cocina específica
    for (const estacion of Object.keys(porEstacion)) {
      req.io.to(`cocina:${estacion}`).emit('kitchen:newItems', {
        estacion,
        items: porEstacion[estacion],
      });
    }
    // Avisar también a la central (frito) con todos los ítems nuevos
    req.io.to('cocina:frito').emit('kitchen:newItems', {
      estacion: 'frito',
      items: Object.values(porEstacion).flat(),
    });

    // === Preparar datos para impresión
    const datosRespuesta = {
      mesaNumero: mesa.numero,
      comensales: mesa.comensales || 0,
      productos: productosCompletos.map((p) => {
        const productoInfo = productosDB.find((prod) => prod._id.toString() === p.producto.toString());
        return {
          nombre: productoInfo?.nombre || 'Producto desconocido',
          cantidad: p.cantidad,
          opcionesPersonalizables: p.opcionesPersonalizables,
          precioSeleccionado: p.precioSeleccionado,
          total: p.total,
          tipoPlato: p.tipoPlato,
          acompanante: p.acompanante,
          ingredientes: p.ingredientes,
          categoria: p.categoria,
          mensaje: p.mensaje,
          adicionales: p.adicionales,
          tipo: p.tipo,
          alergiasComensal: p.alergiasComensal,
          tipoPrecio: p.tipoPrecio,
          seccion: p.seccion,
          extras: p.extras || [],
        };
      }),
      total: productosCompletos.reduce((sum, p) => sum + p.total, 0),
      horaSalida: new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    // === Impresión (best-effort)
    try {
      await axios.post(`${IMPRESION_SERVER}/imprimir`, datosRespuesta);
    } catch (error) {
      logger.error('Error al enviar pedido a la impresora:', error.message);
    }

    // === TTS cocina (como ya tenías)
    const itemsDetallados = productosCompletos
      .filter((p) => ['plato', 'tapaRacion'].includes(p.tipo))
      .map((p) => {
        const prodInfo = productosDB.find((pd) => pd._id.toString() === p.producto.toString());
        const nombre = prodInfo?.nombre || 'Producto';
        const cant = artCant(p.cantidad);
        const tp = labelTipoPrecio(p.tipoPrecio);

        const conExtras = [juntar(p.adicionales), juntar(p.extras)].filter(Boolean).join(', ');
        const sinIngr = juntar(p.ingredientesEliminados, null);
        const nota = limpiar(p.mensaje);
        const tipoPlatoTxt =
          p.tipoPrecio === 'individual' ? 'individual' :
            p.tipoPrecio === 'compartir' ? 'para compartir' : '';

        const partes = [
          `${cant} ${nombre}`,
          tp || '',
          tipoPlatoTxt || '',
          conExtras ? `con ${conExtras}` : '',
          sinIngr ? `sin ${sinIngr}` : '',
          nota ? `nota: ${nota}` : '',
        ].filter(Boolean);

        return {
          nombre,
          cantidad: p.cantidad,
          tipoPrecio: p.tipoPrecio,
          adicionales: p.adicionales,
          extras: p.extras,
          ingredientesEliminados: p.ingredientesEliminados,
          mensaje: p.mensaje,
          tipoPlato: p.tipoPlato,
          seccion: p.seccion,
          texto: partes.join(', '),
        };
      });

    const notasGlobales = productosCompletos.map((p) => limpiar(p.mensaje)).filter(Boolean).join('. ');
    const alergias = productosCompletos.map((p) => limpiar(p.alergiasComensal)).filter(Boolean);
    const lecturaKey = `${pedidoModificado._id}:${mesa.numero}:${itemsDetallados.map((i) => i.texto).join('|')}`;

    req.io.emit('nuevaComanda', {
      area: 'cocina',
      mesa: mesa.numero,
      items: itemsDetallados,
      itemsTexto: itemsDetallados.map((i) => i.texto),
      alergias,
      notas: notasGlobales,
      lecturaKey,
    });

    // === Respuesta
    res.json(datosRespuesta);
  } catch (error) {
    logger.error('Error al agregar producto:', error);
    res.status(500).json({ error: 'Error al agregar producto' });
  }
};

// Obtener todos los pedidos
export const obtenerPedidos = async (req, res) => {
  try {
    const pedidos = await Pedido.find()
      .populate('mesa')
      .populate('productos.producto');
    res.status(200).json(pedidos);
  } catch (error) {
    logger.error('Error al obtener los pedidos:', error);
    res.status(500).json({ error: 'Error al obtener los pedidos' });
  }
};

// Obtener un pedido por ID
export const obtenerPedidosId = async (req, res) => {
  const { id } = req.params;

  try {
    const pedido = await Pedido.findById(id)
      .populate('mesa')
      .populate('productos.productoId');
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.status(200).json(pedido);
  } catch (error) {
    logger.error('Error al obtener el pedido:', error);
    res.status(500).json({ error: 'Error al obtener el pedido' });
  }
};
export const obtenerPedidoPorMesaId = async (req, res) => {
  const { mesaId } = req.params;

  try {
    // Buscar la mesa por ID
    const mesa = await Mesa.findById(mesaId);

    if (!mesa) {
      console.warn('⚠️ Mesa no encontrada con ese ID');
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    // Verificar si la mesa está abierta
    if (mesa.estado?.toLowerCase() !== 'abierta') {
      console.warn(`⚠️ La mesa no está abierta. Estado actual: ${mesa.estado}`);
      return res.status(400).json({ error: `La mesa no está abierta. Estado actual: ${mesa.estado}` });
    }

    // Verificar si tiene una sesión activa
    if (!mesa.sesionActiva) {
      console.warn(`⚠️ Mesa sin sesión activa:`, mesa);
      return res.status(404).json({ error: 'La mesa no tiene una sesión activa registrada' });
    }

    // Buscar pedidos de comida
    const pedidos = await Pedido.find({
      mesa: mesa._id,
      sesionId: mesa.sesionActiva,
    })
      .populate('mesa')
      .populate('productos.producto');

    // Buscar pedidos de bebida
    const pedidosBebidas = await PedidoBebida.find({
      mesa: mesa._id,
      sesionId: mesa.sesionActiva,
    })
      .populate('mesa')
      .populate('productos.producto');

    // Verificar si hay pedidos
    if (!pedidos.length && !pedidosBebidas.length) {
      console.warn('⚠️ No se encontraron pedidos en esta sesión');
      return res.status(404).json({
        error: 'No se encontraron pedidos en la sesión activa para esta mesa',
      });
    }

    // Mapear productos de comida
    const productosComida = pedidos.flatMap((p) =>
      p.productos.map((prod) => {
        const productoFinal = {
          ...prod.toObject(),
          tipo: 'comida',
        };
        return productoFinal;
      })
    );

    // Mapear productos de bebida
    const productosBebidas = pedidosBebidas.flatMap((p) =>
      p.productos.map((prod) => {
        const productoFinal = {
          ...prod.toObject(),
          tipo: 'bebida',
        };
        return productoFinal;
      })
    );

    // Unificar todos los productos
    const productosUnificados = [...productosComida, ...productosBebidas];

    res.status(200).json(productosUnificados);
  } catch (error) {
    console.error('🔴 Error inesperado al obtener los pedidos de la mesa:', error);
    res.status(500).json({ error: 'Error al obtener los pedidos de la mesa' });
  }
};


// Obtener pedidos pendientes
export const obtenerPedidosPendientes = async (req, res) => {
  try {
    const { tipo } = req.query; // Obtener el tipo de la consulta (plato o bebida)

    const filter = { estado: 'pendiente' };
    if (tipo) {
      filter['productos.tipo'] = tipo; // Filtrar productos por tipo si se especifica
    }

    const pedidos = await Pedido.find(filter)
      .populate('mesa')
      .populate('productos.producto'); // Expande los detalles del producto

    res.status(200).json(pedidos);
  } catch (error) {
    logger.error('Error al obtener pedidos pendientes:', error);
    res.status(500).json({ error: 'Error al obtener pedidos pendientes' });
  }
};

// Obtener pedidos finalizados
export const obtenerPedidosFinalizados = async (req, res) => {
  try {
    const { tipo } = req.query; // Obtener el tipo de la consulta (plato o bebida)
    const hace20Minutos = new Date(Date.now() - 20 * 60 * 1000); // Fecha límite

    const filter = {
      estado: 'listo',
      fecha: { $gte: hace20Minutos },
    };

    if (tipo) {
      filter['productos.tipo'] = tipo; // Filtrar productos por tipo si se especifica
    }

    const pedidosFinalizados = await Pedido.find(filter)
      .populate('mesa')
      .populate('productos.producto'); // Expande los detalles del producto

    res.status(200).json(pedidosFinalizados);
  } catch (error) {
    logger.error('Error al obtener pedidos finalizados:', error);
    res.status(500).json({ error: 'Error al obtener pedidos finalizados' });
  }
};

export const actualizarProducto = async (req, res) => {
  try {
    const { pedidoId, productoId } = req.params;
    const { estadoPreparacion } = req.body;

    const pedido = await Pedido.findById(pedidoId).populate('mesa');
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const producto = pedido.productos.id(productoId);
    if (!producto)
      return res.status(404).json({ error: 'Producto no encontrado' });

    producto.estadoPreparacion = estadoPreparacion;
    await pedido.save();

    // Verificar si TODOS los productos de TODOS los pedidos de la misma mesa están listos
    const pedidosMesa = await Pedido.find({ mesa: pedido.mesa._id });

    const todosListos = pedidosMesa.every((ped) =>
      ped.productos.every((prod) => prod.estadoPreparacion === 'listo')
    );

    // Emitir el evento usando el número real de mesa
    io.emit('pedidosActualizados', {
      numeroMesa: pedido.mesa.numero,
      todosListos,
    });

    res.status(200).json({ message: 'Producto actualizado correctamente' });
  } catch (error) {
    logger.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// Actualizar un pedido por ID
export const actualizarPedido = async (req, res) => {
  const { id } = req.params;
  const { productos, total, comensales, alergias, pan, estado } = req.body;

  try {
    const pedido = await Pedido.findById(id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Actualizar campos permitidos
    if (productos) {
      pedido.productos = productos;
      pedido.markModified('productos');           // 👈 asegura persistencia de subdocs
    }
    if (total !== undefined) pedido.total = Number((Number(total) || 0).toFixed(2));
    if (comensales !== undefined) pedido.comensales = comensales;
    if (alergias !== undefined) pedido.alergias = alergias;
    if (pan !== undefined) pedido.pan = pan;
    if (estado !== undefined) pedido.estado = estado;

    await pedido.save();

    // 👇 Evento simple, global, sin rooms ni historias
    req.io.emit('cocina:refresh', {
      source: 'pedido:update',
      pedidoId: pedido._id.toString(),
      estado: pedido.estado,
      ts: Date.now(),
    });

    res.status(200).json({ message: 'Pedido actualizado con éxito', pedido });
  } catch (error) {
    logger.error('Error al actualizar el pedido:', error);
    res.status(400).json({ error: 'Error al actualizar el pedido' });
  }
};

// Eliminar un pedido por ID
export const eliminarPedido = async (req, res) => {
  const { id } = req.params;

  try {
    const pedido = await Pedido.findByIdAndDelete(id);

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Actualizar la mesa para quitar el pedido eliminado
    const mesa = await Mesa.findById(pedido.mesa);
    if (mesa) {
      mesa.pedidos = mesa.pedidos.filter(
        (pedidoId) => pedidoId.toString() !== id
      );
      mesa.total -= pedido.total;
      await mesa.save();
    }

    res.status(200).json({ message: 'Pedido eliminado con éxito' });
  } catch (error) {
    logger.error('Error al eliminar el pedido:', error);
    res.status(500).json({ error: 'Error al eliminar el pedido' });
  }
};

// Endpoint para verificar si todos los pedidos de una mesa están listos
export const verificarPedidosMesa = async (req, res) => {
  const { numeroMesa } = req.params;

  if (!numeroMesa || isNaN(Number(numeroMesa))) {
    logger.error("Número de mesa no válido:", numeroMesa);
    return res.status(400).json({ error: "Número de mesa no válido." });
  }

  try {
    const mesa = await Mesa.findOne({ numero: Number(numeroMesa) });
    if (!mesa) {
      return res.status(404).json({ error: "Mesa no encontrada." });
    }

    if (!mesa.sesionActiva) {
      // ✅ Si no hay sesión activa, no tiene pedidos en curso
      return res.status(200).json({ todosListos: false });
    }

    // Filtramos pedidos de esta mesa y de la sesión activa
    const pedidos = await Pedido.find({ 
      mesa: mesa._id, 
      sesionId: mesa.sesionActiva 
    });

    if (pedidos.length === 0) {
      return res.status(200).json({ todosListos: false });
    }

    const todosListos = pedidos.every((pedido) => pedido.estado === "listo");

    logger.info(
      `Mesa ${numeroMesa} (sesión ${mesa.sesionActiva}) - ${pedidos.length} pedidos, todos listos: ${todosListos}`
    );

    res.status(200).json({ todosListos });
  } catch (error) {
    logger.error("Error al verificar pedidos de la mesa:", error);
    res.status(500).json({ error: "Error al verificar pedidos de la mesa." });
  }
};


