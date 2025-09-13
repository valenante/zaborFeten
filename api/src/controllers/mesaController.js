import Mesa from '../models/Mesa.js';
import MesaCerrada from '../models/MesaCerrada.js';
import Pedido from '../models/Pedido.js';
import PedidoBebidas from '../models/PedidoBebidas.js';
import Caja from '../models/Caja.js';
import Comensal from '../models/Comensal.js';
import SesionMesa from '../models/SesionMesa.js';
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid'; // Generador de UUID
import EventoFactura from '../models/EventosFactura.js';
import { obtenerNumeroFactura } from '../services/numeroFacturaServices.js';
import { emitirFacturaBase } from '../../utils/emitirFactura.js';
import { abrirCajon } from './imprimirController.js'; // Importar la función para abrir el cajón


export const verificarTokenLider = async (req, res) => {
  //Conseguir el mesaId de los params
  const { mesaId } = req.params;

  if (!mesaId) {
    return res
      .status(400)
      .json({ error: 'El número de la mesa es obligatorio' });
  }

  try {
    const mesaDoc = await Mesa.findById(mesaId);

    if (!mesaDoc) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    res.status(200).json({ tokenLider: mesaDoc.tokenLider });
  } catch (error) {
    logger.error('Error al verificar el tokenLider:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
};

export const verificarTokenLiderPorNumero = async (req, res) => {
  const { mesa } = req.query; // Obtener el número de mesa desde los query params

  if (!mesa) {
    return res
      .status(400)
      .json({ error: 'El número de la mesa es obligatorio' });
  }

  try {
    // Buscar la mesa por su número
    const mesaDoc = await Mesa.findOne({ numero: mesa });

    if (!mesaDoc) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    // Retornar el tokenLider si existe o null si no existe
    res.status(200).json({ tokenLider: mesaDoc.tokenLider || null });
  } catch (error) {
    logger.error('Error al verificar el tokenLider:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
};

export const crearTokenLider = async (req, res) => {
  const { mesa } = req.body;

  if (!mesa) {
    return res
      .status(400)
      .json({ error: 'El número de la mesa es obligatorio' });
  }

  try {
    const mesaDoc = await Mesa.findOne({ numero: mesa });

    if (!mesaDoc) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    if (mesaDoc.tokenLider) {
      return res
        .status(400)
        .json({ error: 'El tokenLider ya existe para esta mesa' });
    }

    // 🟡 Generar token y abrir mesa
    mesaDoc.tokenLider = uuidv4();
    mesaDoc.estado = 'abierta';

    // 🟢 Crear nueva sesión de mesa
    const nuevaSesion = new SesionMesa({
      mesa: mesaDoc._id,
      estado: 'activa',
    });
    await nuevaSesion.save();

    mesaDoc.sesionActiva = nuevaSesion._id;

    await mesaDoc.save();

    // 🔁 Emitir evento en tiempo real
    req.io.emit('mesaAbierta', mesaDoc);

    res.status(201).json({
      tokenLider: mesaDoc.tokenLider,
      estado: mesaDoc.estado,
      sesionActiva: nuevaSesion._id,
    });
  } catch (error) {
    logger.error('Error al crear el tokenLider:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
};

// Obtener todas las mesas activas
export const obtenerMesas = async (req, res) => {
  try {
    const mesas = await Mesa.find().populate('pedidos');
    res.status(200).json(mesas);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al obtener las mesas activas' });
  }
};

// Obtener una mesa activa por ID
export const obtenerMesaPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const mesa = await Mesa.findById(id).populate('pedidos');
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    res.status(200).json(mesa);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al obtener la mesa' });
  }
};

// Reabrir una mesa existente y actualizar comensales
export const abrirMesaCamarero = async (req, res) => {
  const { id } = req.params;
  const { comensales } = req.body;

  try {
    const mesa = await Mesa.findById(id);
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    if (mesa.estado === 'abierta') {
      return res.status(400).json({ error: 'La mesa ya está abierta' });
    }

    mesa.estado = 'abierta';
    mesa.comensales = comensales || mesa.comensales || 1;

    const nuevaSesion = new SesionMesa({
      mesa: mesa._id,
      estado: 'activa',
    });
    await nuevaSesion.save();

    mesa.sesionActiva = nuevaSesion._id;
    await mesa.save();

    req.io.emit('mesaAbierta', mesa);

    res.status(200).json(mesa);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al reabrir la mesa' });
  }
};

export const cerrarMesa = async (req, res) => {
  const { id } = req.params;
  const { metodoPago, clienteNombre, clienteNIF, camarero } = req.body;

  try {
    const ahora = new Date();
    const mesa = await Mesa.findById(id)
      .populate({ path: 'pedidos', populate: { path: 'productos.producto' } })
      .populate({ path: 'pedidosBebidas', populate: { path: 'productos.producto' } });

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    const { efectivo = 0, tarjeta = 0, propina = 0 } = metodoPago || {};
    const totalPagado = efectivo + tarjeta;
    const totalMesa = mesa.total;

    if (totalPagado < totalMesa) {
      return res.status(400).json({
        error: `El monto ingresado (${totalPagado} €) es menor que el total de la mesa (${totalMesa} €).`,
      });
    }

    const cambioCalculado = totalPagado - totalMesa;
    const propinaCalculada = propina;

    const mesaCerrada = new MesaCerrada({
      numero: mesa.numero,
      pedidos: mesa.pedidos.map((p) => p._id),
      pedidoBebidas: mesa.pedidosBebidas.map((p) => p._id),
      total: totalMesa,
      inicio: mesa.inicio,
      cierre: ahora,
      comensales: mesa.comensales || 1,
      metodoPago: { efectivo, tarjeta, propina: propinaCalculada, cambio: cambioCalculado },
      sesionActiva: mesa.sesionActiva,
      camarero: camarero || '',
    });

    await mesaCerrada.save();

    const inicioDia = new Date(ahora.setHours(0, 0, 0, 0));
    const finDia = new Date(ahora.setHours(23, 59, 59, 999));

    const caja = await Caja.findOne({ fechaApertura: { $gte: inicioDia, $lte: finDia }, estado: 'abierta' });

    if (caja) {
      const efectivoReal = Math.min(efectivo, totalMesa);
      const tarjetaReal = Math.min(tarjeta, totalMesa - efectivoReal);
      caja.detallesMetodoPago.efectivo += efectivoReal;
      caja.detallesMetodoPago.tarjeta += tarjetaReal;
      caja.detallesMetodoPago.propina += propinaCalculada;
      caja.total += totalMesa;
      caja.operaciones.push({
        tipo: 'cierre',
        monto: totalMesa,
        razon: `Cierre de la mesa número ${mesa.numero}`,
      });
      await caja.save();
    } else {
      const nuevaCaja = new Caja({
        total: totalMesa,
        detallesMetodoPago: { efectivo, tarjeta, propina: propinaCalculada },
        operaciones: [{
          tipo: 'cierre',
          monto: totalMesa,
          razon: `Cierre de la mesa número ${mesa.numero}`,
        }],
      });
      await nuevaCaja.save();
    }

    await abrirCajon();

    const numeroFactura = await obtenerNumeroFactura();

    const productosPlatos = mesa.pedidos.flatMap((pedido) =>
      pedido.productos.map((p) => ({
        nombre: p.producto?.nombre || 'Producto desconocido',
        cantidad: p.cantidad,
        precio: p.precioSeleccionado || 0,
      }))
    );

    const productosBebidas = mesa.pedidosBebidas.flatMap((pedido) =>
      pedido.productos.map((p) => ({
        nombre: p.producto?.nombre || 'Bebida sin nombre',
        cantidad: p.cantidad,
        precio: p.precioSeleccionado || 0,
      }))
    );

    const productos = [...productosPlatos, ...productosBebidas];

    // ✅ EMITIR FACTURA COMPLETA
    const { hashFactura } = await emitirFacturaBase({
      numeroFactura,
      fechaExpedicion: ahora,
      clienteNombre: clienteNombre || 'Consumidor Final',
      clienteNIF: clienteNIF || 'N/A',
      productos,
      importeTotal: totalMesa,
      mesaNumero: mesa.numero,
      camarero: camarero || '',
    });

    console.log(clienteNombre, clienteNIF, 'en cerrar mesa');

    await new EventoFactura({
      tipoEvento: 'creación',
      numeroFactura,
      clienteNombre: clienteNombre || 'Consumidor Final',
      clienteNIF: clienteNIF || 'N/A',
      motivo: 'Generación de la factura al cierre de la mesa',
      importeTotal: totalMesa,
      hashFactura,
    }).save();

    const sesionActiva = await SesionMesa.findOne({ mesa: mesa._id, estado: 'activa' });
    if (sesionActiva) {
      sesionActiva.estado = 'cerrada';
      sesionActiva.cierre = ahora;
      await sesionActiva.save();
    }

    await Mesa.updateOne(
      { _id: id },
      {
        estado: 'cerrada',
        total: 0,
        pedidos: [],
        pedidosBebidas: [],
        comensales: null,
        tokenLider: null,
        sesionActiva: null,
      }
    );

    res.status(200).json({
      message: 'Mesa cerrada con éxito',
      mesaCerrada,
      propina: propinaCalculada,
      cambio: cambioCalculado,
      facturaEmitida: !!hashFactura,
      numeroFactura,
      hashFactura: hashFactura?.hash || null,
      fechaExpedicion: ahora.toISOString(),
      datosImpresion: {
        mesaNumero: mesa.numero,
        comensales: mesa.comensales || 1,
        clienteNombre: clienteNombre || 'Consumidor Final',
        clienteNIF: clienteNIF || 'N/A',
        numeroFactura,
        fechaExpedicion: ahora.toISOString(),
        productos,
        total: totalMesa,
        hash: hashFactura,
        camarero: camarero || '',
      },

    });
  } catch (error) {
    logger.error('❌ Error al cerrar la mesa:', error);
    res.status(500).json({ error: 'Error al cerrar la mesa' });
  }
};

// Obtener historial de mesas cerradas
export const getHistorialMesas = async (req, res) => {
  const { numero, desde, hasta } = req.query;

  try {
    const filtros = {};
    if (numero) filtros.numero = numero;
    if (desde || hasta) {
      filtros.cierre = {};
      if (desde) filtros.cierre.$gte = new Date(desde);
      if (hasta) filtros.cierre.$lte = new Date(hasta);
    }

    const historial = await MesaCerrada.find(filtros).populate('pedidos');
    res.status(200).json(historial);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al obtener el historial de mesas' });
  }
};

//Obtener el ID de una mesa por su número
export const obtenerMesaPorNumero = async (req, res) => {
  const { numeroMesa } = req.params;
  try {
    const mesa = await Mesa.findOne({ numeroMesa });
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    res.status(200).json(mesa);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al obtener la mesa' });
  }
};

// controllers/mesasCerradas.js
export const obtenerMesasCerradas = async (req, res) => {
  try {
    const { id } = req.query;

    const baseQuery = id ? MesaCerrada.findById(id) : MesaCerrada.find({}).sort({ cierre: -1 });
    const mcRaw = await baseQuery
      .populate({ path: 'pedidos', populate: { path: 'productos.producto' } })
      .populate({ path: 'pedidoBebidas', populate: { path: 'productos.producto' } })
      .lean();

    const normalizar = (mc) => {
      const itemsPlatos = (mc.pedidos || []).flatMap(p =>
        (p.productos || []).map(i => {
          const precioUnit = i.precioSeleccionado ?? i.precioFinal ?? (typeof i.total === 'number' ? i.total : 0);
          const cantidad = i.cantidad || 1;
          return {
            tipo: i.tipo || 'plato',
            nombre: i.producto?.nombre || i.nombre || 'Producto',
            cantidad,
            precio: Number((precioUnit || 0).toFixed(2)),
            subtotal: Number(((precioUnit || 0) * cantidad).toFixed(2)),
          };
        })
      );

      const itemsBebidas = (mc.pedidoBebidas || []).flatMap(p =>
        (p.productos || []).map(i => {
          const precioUnit = i.precioSeleccionado ?? (typeof i.total === 'number' ? i.total : 0);
          const cantidad = i.cantidad || 1;
          return {
            tipo: i.tipo || 'bebida',
            nombre: i.producto?.nombre || i.nombre || 'Bebida',
            cantidad,
            precio: Number((precioUnit || 0).toFixed(2)),
            subtotal: Number(((precioUnit || 0) * cantidad).toFixed(2)),
          };
        })
      );

      return {
        _id: mc._id,
        numero: mc.numero,
        inicio: mc.inicio,
        cierre: mc.cierre,
        total: Number((mc.total || 0).toFixed(2)),
        metodoPago: {
          efectivo: Number((mc.metodoPago?.efectivo || 0).toFixed(2)),
          tarjeta: Number((mc.metodoPago?.tarjeta || 0).toFixed(2)),
          propina: Number((mc.metodoPago?.propina || 0).toFixed(2)),
        },
        pedidosIds: (mc.pedidos || []).map(p => p._id),
        pedidoBebidasIds: (mc.pedidoBebidas || []).map(p => p._id),
        items: [...itemsPlatos, ...itemsBebidas],
      };
    };

    if (id) {
      if (!mcRaw) return res.status(404).json({ error: 'Mesa cerrada no encontrada' });
      return res.json(normalizar(mcRaw)); // 👈 objeto
    }

    const mesas = mcRaw || [];
    return res.json(mesas.map(normalizar)); // 👈 array
  } catch (err) {
    console.error('Error al obtener mesas cerradas:', err);
    return res.status(500).json({ error: 'Error al obtener las mesas cerradas' });
  }
};

export const obtenerMesasAbiertas = async (req, res) => {
  try {
    const mesasAbiertas = await Mesa.find({ estado: 'abierta' }).populate(
      'pedidos'
    );
    res.status(200).json(mesasAbiertas);
  } catch (error) {
    logger.error('Error al obtener las mesas abiertas:', error);
    res.status(500).json({ error: 'Error al obtener las mesas abiertas.' });
  }
};
export const recuperarMesa = async (req, res) => {
  const { mesaId } = req.params; // ID de la mesa cerrada
  try {
    // 1️⃣ Obtener la mesa cerrada
    const mesaCerrada = await MesaCerrada.findById(mesaId);
    if (!mesaCerrada) {
      return res.status(404).json({ error: 'Mesa cerrada no encontrada.' });
    }

    // 2️⃣ Buscar la mesa activa correspondiente
    const mesaActiva = await Mesa.findOne({ numero: mesaCerrada.numero });
    if (!mesaActiva) {
      return res.status(404).json({ error: 'Mesa activa no encontrada.' });
    }

    // 3️⃣ Buscar y reactivar la sesión anterior si existe
    const sesionAnterior = await SesionMesa.findOne({
      mesa: mesaActiva._id,
      estado: 'cerrada',
    }).sort({ cierre: -1 });

    if (sesionAnterior) {
      sesionAnterior.estado = 'activa';
      sesionAnterior.cierre = null; // Limpiar fecha de cierre
      await sesionAnterior.save();
      mesaActiva.sesionId = sesionAnterior._id;
    }

    // 4️⃣ Transferir los datos de la mesa cerrada a la activa
    mesaActiva.pedidos = mesaCerrada.pedidos;
    mesaActiva.pedidosBebidas = mesaCerrada.pedidoBebidas; // ✅ También las bebidas
    mesaActiva.sesionActiva = mesaActiva.sesionId; // Mantener la sesión activa
    mesaActiva.total = mesaCerrada.total;
    mesaActiva.inicio = mesaCerrada.inicio;
    mesaActiva.estado = 'abierta'; // Cambiar el estado a abierta
    mesaActiva.updatedAt = new Date();

    await mesaActiva.save();

    // 5️⃣ Ajustar la caja actual restando el total de la mesa
    const hoy = new Date();
    const inicioDelDia = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      0,
      0,
      0
    );
    const finDelDia = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      23,
      59,
      59
    );

    const cajaActual = await Caja.findOne({
      fechaApertura: { $gte: inicioDelDia, $lte: finDelDia },
      estado: 'abierta',
    });

    if (cajaActual) {
      cajaActual.total -= mesaCerrada.total;
      cajaActual.detallesMetodoPago.efectivo -=
        mesaCerrada.metodoPago.efectivo || 0;
      cajaActual.detallesMetodoPago.tarjeta -=
        mesaCerrada.metodoPago.tarjeta || 0;
      cajaActual.detallesMetodoPago.propina -=
        mesaCerrada.metodoPago.propina || 0;
      cajaActual.operaciones.push({
        tipo: 'ajuste',
        monto: -mesaCerrada.total,
        razon: `Recuperación de la mesa número ${mesaCerrada.numero}`,
      });
      await cajaActual.save();
    }

    // 6️⃣ Eliminar la mesa cerrada
    await MesaCerrada.findByIdAndDelete(mesaId);

    res.status(200).json({
      message: '✅ Mesa recuperada y caja ajustada correctamente.',
      sesionId: sesionAnterior ? sesionAnterior._id : null,
    });
  } catch (error) {
    logger.error('❌ Error al recuperar la mesa:', error);
    res.status(500).json({ error: 'Error al recuperar la mesa.' });
  }
};

export const crearMesa = async (req, res) => {
  try {
    const { numero } = req.body;

    // Verificar si el número de la mesa ya existe
    const mesaExistente = await Mesa.findOne({ numero });
    if (mesaExistente) {
      return res
        .status(400)
        .json({ error: `La mesa número ${numero} ya existe.` });
    }

    // Crear la nueva mesa
    const nuevaMesa = new Mesa({
      numero,
      inicio: new Date(),
      cierre: null,
      estado: 'cerrada',
      total: 0,
      metodoPago: { efectivo: 0, tarjeta: 0 }, // Inicializa método de pago vacío
      pedidos: [], // Inicializa con pedidos vacíos
    });

    await nuevaMesa.save(); // Guarda la mesa en la base de datos

    res
      .status(201)
      .json({ message: 'Mesa creada exitosamente', mesa: nuevaMesa });
  } catch (error) {
    logger.error('Error al crear la mesa:', error);
    res.status(500).json({ error: 'Hubo un problema al crear la mesa.' });
  }
};

export const eliminarMesa = async (req, res) => {
  try {
    const { numero } = req.query; // Obtiene el número de la mesa del cuerpo de la solicitud

    // Verificar que el número fue proporcionado
    if (!numero) {
      return res
        .status(400)
        .json({ error: 'El número de la mesa es obligatorio.' });
    }

    // Buscar y eliminar la mesa por su número
    const mesaEliminada = await Mesa.findOneAndDelete({ numero });

    // Si no se encontró la mesa, devolver un error
    if (!mesaEliminada) {
      return res
        .status(404)
        .json({ error: `No se encontró una mesa con el número ${numero}.` });
    }

    res.status(200).json({
      message: `Mesa número ${numero} eliminada exitosamente.`,
      mesa: mesaEliminada,
    });
  } catch (error) {
    logger.error('Error al eliminar la mesa:', error);
    res.status(500).json({ error: 'Hubo un problema al eliminar la mesa.' });
  }
};

// POST /mesas/comensal
export const registrarComensal = async (req, res) => {
  try {
    const { mesa, nombre, alergias, esLider, comensales } = req.body;

    if (!mesa || !nombre) {
      return res
        .status(400)
        .json({ message: 'Mesa y nombre son obligatorios.' });
    }

    const nuevoComensal = new Comensal({
      mesa,
      nombre,
      alergias,
      esLider,
      comensales: esLider ? comensales : null,
    });

    await nuevoComensal.save();
    res.status(201).json({ message: 'Comensal registrado correctamente.' });
  } catch (error) {
    logger.error('Error al guardar comensal:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
export const transferirProducto = async (req, res) => {
  const { productoId, pedidoId, desde, hacia, tipoPedido, cantidad } = req.body;

  if (
    !productoId ||
    !pedidoId ||
    !desde ||
    !hacia ||
    !tipoPedido ||
    !cantidad
  ) {
    return res.status(400).json({
      error:
        'Faltan datos: productoId, pedidoId, desde, hacia, tipoPedido y cantidad son obligatorios.',
    });
  }

  try {
    const campoPopulate =
      tipoPedido === 'bebida' ? 'pedidosBebidas' : 'pedidos';
    const mesaOrigen = await Mesa.findById(desde).populate(campoPopulate);
    const mesaDestino = await Mesa.findById(hacia).populate(campoPopulate);

    if (!mesaOrigen || !mesaDestino) {
      return res
        .status(404)
        .json({ error: 'Mesa origen o destino no encontrada.' });
    }

    const pedidosOrigen =
      tipoPedido === 'bebida' ? mesaOrigen.pedidosBebidas : mesaOrigen.pedidos;
    const pedidosDestino =
      tipoPedido === 'bebida'
        ? mesaDestino.pedidosBebidas
        : mesaDestino.pedidos;

    const pedidoOrigen = pedidosOrigen.find(
      (p) => p._id.toString() === pedidoId
    );
    if (!pedidoOrigen) {
      return res.status(404).json({ error: 'Pedido origen no encontrado.' });
    }

    const productoIndex = pedidoOrigen.productos.findIndex(
      (p) => p._id.toString() === productoId
    );
    if (productoIndex === -1) {
      return res
        .status(404)
        .json({ error: 'Producto no encontrado en el pedido origen.' });
    }

    const productoOriginal = pedidoOrigen.productos[productoIndex];

    // Validar cantidad
    if (cantidad > productoOriginal.cantidad) {
      return res
        .status(400)
        .json({ error: 'Cantidad a transferir mayor que la disponible.' });
    }

    const precioUnitario =
      (productoOriginal.total || 0) / productoOriginal.cantidad;
    const totalTransferido = +(precioUnitario * cantidad).toFixed(2);

    // Restar cantidad al producto original
    if (productoOriginal.cantidad === cantidad) {
      pedidoOrigen.productos.splice(productoIndex, 1); // eliminar si se transfiere todo
    } else {
      productoOriginal.cantidad -= cantidad;
      productoOriginal.total = +(
        precioUnitario * productoOriginal.cantidad
      ).toFixed(2);
    }

    pedidoOrigen.total = +(pedidoOrigen.total - totalTransferido).toFixed(2);
    mesaOrigen.total = +(mesaOrigen.total - totalTransferido).toFixed(2);

    // Guardar pedido origen
    const ModeloPedido = tipoPedido === 'bebida' ? PedidoBebidas : Pedido;
    await ModeloPedido.findByIdAndUpdate(pedidoOrigen._id, {
      productos: pedidoOrigen.productos,
      total: pedidoOrigen.total,
    });

    // Buscar o crear pedido destino
    let pedidoDestino = pedidosDestino.find((p) => p.estado === 'pendiente');
    if (!pedidoDestino) {
      pedidoDestino = new ModeloPedido({
        mesa: mesaDestino._id,
        productos: [],
        estado: 'pendiente',
        total: 0,
      });
      await pedidoDestino.save();
      if (tipoPedido === 'bebida') {
        mesaDestino.pedidosBebidas.push(pedidoDestino._id);
      } else {
        mesaDestino.pedidos.push(pedidoDestino._id);
      }
    } else {
      pedidoDestino = await ModeloPedido.findById(pedidoDestino._id);
    }

    // Crear copia del producto con cantidad transferida
    const productoTransferido = {
      ...productoOriginal.toObject(),
      _id: undefined, // para que Mongo genere uno nuevo
      cantidad: cantidad,
      total: totalTransferido,
    };

    pedidoDestino.productos.push(productoTransferido);
    pedidoDestino.total = +(pedidoDestino.total + totalTransferido).toFixed(2);
    mesaDestino.total = +(mesaDestino.total + totalTransferido).toFixed(2);

    await pedidoDestino.save();
    await mesaOrigen.save();
    await mesaDestino.save();

    req.io.emit('productoTransferido', {
      desde,
      hacia,
      productoId,
      pedidoId,
      tipoPedido,
      cantidad,
    });

    return res.json({ mensaje: 'Producto transferido con éxito.' });
  } catch (error) {
    logger.error('❌ Error al transferir producto:', error);
    return res
      .status(500)
      .json({ error: 'Error interno al transferir el producto.' });
  }
};
