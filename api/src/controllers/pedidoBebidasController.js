import axios from 'axios';
import logger from '../../utils/logger.js';
import PedidoBebida from '../models/PedidoBebidas.js';
import Pedido from '../models/Pedido.js';
import Mesa from '../models/Mesa.js';
import Venta from '../models/Ventas.js';
import Cart from '../models/Cart.js';
import Producto from '../models/Producto.js';
import SesionMesa from '../models/SesionMesa.js';

const IMPRESION_SERVER = process.env.IMPRESION_SERVER

// 🔁 Función para recalcular el total real de una mesa (platos + bebidas)
export const recalcularTotalMesa = async (mesaId) => {
  const mesa = await Mesa.findById(mesaId);
  if (!mesa) throw new Error("Mesa no encontrada");

  const [pedidos, pedidosBebidas] = await Promise.all([
    Pedido.find({
      mesa: mesaId,
      sesionId: mesa.sesionActiva,
      estado: { $in: ["pendiente", "listo"] },
    }),
    PedidoBebida.find({
      mesa: mesaId,
      sesionId: mesa.sesionActiva,
      estado: { $in: ["pendiente", "listo"] },
    }),
  ]);

  const totalPedidos = pedidos.reduce((acc, p) => acc + (p.total || 0), 0);
  const totalBebidas = pedidosBebidas.reduce((acc, p) => acc + (p.total || 0), 0);

  mesa.total = Number((totalPedidos + totalBebidas).toFixed(2));
  await mesa.save();

  return mesa.total;
};

export const crearPedido = async (req, res) => {
  try {
    const {
      mesa,
      productos = [], // [{ producto, cantidad, precioSeleccionado, total }]
      total,
      comensales,
      alergias,
      cartId,
    } = req.body;

    const mesaExistente = await Mesa.findById(mesa);
    if (!mesaExistente) {
      logger.error('Mesa no encontrada');
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    console.log('Mesa existente:', mesaExistente);

    // 🔒 Buscar sesión activa

    // DEBUG COMPLETO
    const todasLasSesiones = await SesionMesa.find({});
    console.log("📌 TODAS LAS SESIONES EN BD (SesionMesa):\n", JSON.stringify(todasLasSesiones, null, 2));

    const sesionActiva = await SesionMesa.findById(mesaExistente.sesionActiva);

    console.log("📌 Sesión activa encontrada:", sesionActiva);

    if (!sesionActiva) {
      return res.status(400).json({ error: "La mesa no tiene una sesión activa." });
    }

    // 🧾 Congelar precios producto por producto
    const idsProductos = productos.map(p => p.producto);
    const productosDB = await Producto.find({ _id: { $in: idsProductos } });

    const productosCongelados = productos.map((p) => {
      const info = productosDB.find(x => x._id.toString() === String(p.producto));

      const precioCongelado = parseFloat(p.precioSeleccionado ?? info?.precioBase ?? 0);
      const totalCongelado = parseFloat((precioCongelado * (p.cantidad ?? 1)).toFixed(2));

      return {
        ...p,
        nombre: info?.nombre || p.nombre || 'Producto',
        categoria: info?.categoria || 'bebida',
        tipo: 'bebida',
        estacion: info?.estacion || 'barra',
        precioSeleccionado: precioCongelado,
        total: totalCongelado,
      };
    });

    // 🧮 Calcular total del pedido con precisión
    const totalPedido = Number(
      productosCongelados.reduce((sum, p) => sum + (p.total || 0), 0).toFixed(2)
    );

    // 🧾 Crear pedido
    const nuevoPedido = new PedidoBebida({
      productos: productosCongelados,
      total: totalPedido,
      comensales,
      alergias,
      mesa: mesaExistente._id,
      sesionId: mesaExistente.sesionActiva,
      estado: 'pendiente',
    });

    await nuevoPedido.save();

    // 🧩 Actualizar mesa
    mesaExistente.pedidosBebidas.push(nuevoPedido._id);

    // 🔥 Guardar la mesa ANTES del recálculo
    await mesaExistente.save();

    // Recalcular total
    await recalcularTotalMesa(mesaExistente._id);


    // 💾 Registrar ventas individuales
    for (const item of productosCongelados) {
      const venta = new Venta({
        producto: item.producto,
        pedidoId: nuevoPedido._id,
        cantidad: item.cantidad,
        tipo: 'bebida',
        total: item.total, // ✅ precio congelado individual
      });

      await venta.save();

      const productoEnDB = productosDB.find(
        (p) => p._id.toString() === String(item.producto)
      );
      if (productoEnDB) {
        productoEnDB.ventas.push(venta._id);
        productoEnDB.stock -= item.cantidad;
        await productoEnDB.save();
      } else {
        logger.error('Producto no encontrado en la base de datos:', item.producto);
      }
    }

    // 🧹 Eliminar carrito si aplica
    if (cartId) await Cart.findByIdAndDelete(cartId);

    // 🔄 Emitir actualización en tiempo real
    req.io.emit('nuevoPedido', {
      tipo: 'crear-bebida',
      mesaId: mesaExistente._id.toString(),
      pedido: nuevoPedido.toObject(),
    });

    res.status(201).json({
      message: 'Pedido de bebidas creado con éxito',
      pedidoId: nuevoPedido._id,
      pedido: nuevoPedido,
    });
  } catch (error) {
    logger.error('Error al procesar el pedido de bebida:', error);
    res.status(400).json({ error: error.message });
  }
};

export const obtenerPedidos = async (req, res) => {
  try {
    const idsParam = req.query.ids;

    if (!idsParam) {
      return res
        .status(400)
        .json({ error: 'Debes proporcionar los IDs de los pedidos.' });
    }

    const ids = idsParam.split(',');

    const pedidos = await PedidoBebida.find({ _id: { $in: ids } })
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
    const pedido = await PedidoBebida.findById(id)
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

// Obtener pedidos pendientes
export const obtenerPedidosPendientes = async (req, res) => {
  try {
    const { tipo } = req.query; // Obtener el tipo de la consulta (plato o bebida)

    const filter = { estado: 'pendiente' };
    if (tipo) {
      filter['productos.tipo'] = tipo; // Filtrar productos por tipo si se especifica
    }

    const pedidos = await PedidoBebida.find(filter)
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

    const pedidosFinalizados = await PedidoBebida.find(filter)
      .populate('mesa')
      .populate('productos.producto'); // Expande los detalles del producto

    res.status(200).json(pedidosFinalizados);
  } catch (error) {
    logger.error('Error al obtener pedidos finalizados:', error);
    res.status(500).json({ error: 'Error al obtener pedidos finalizados' });
  }
};

//Actualizar el estado de un producto en un pedido
export const actualizarProducto = async (req, res) => {
  try {
    const { pedidoId, productoId } = req.params;
    const { estadoPreparacion } = req.body;

    const pedido = await PedidoBebida.findById(pedidoId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const producto = pedido.productos.id(productoId);
    if (!producto)
      return res.status(404).json({ error: 'Producto no encontrado' });

    producto.estadoPreparacion = estadoPreparacion;
    await pedido.save();

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
    const pedido = await PedidoBebida.findById(id);

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Actualizar los campos permitidos
    if (productos) pedido.productos = productos;
    if (total) pedido.total = parseFloat(total.toFixed(2));
    if (comensales) pedido.comensales = comensales;
    if (alergias) pedido.alergias = alergias;
    if (pan !== undefined) pedido.pan = pan;
    if (estado) pedido.estado = estado;

    // Guardar los cambios
    await pedido.save();

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
    const pedido = await PedidoBebida.findByIdAndDelete(id);

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
    logger.error('Número de mesa no válido:', numeroMesa);
    return res.status(400).json({ error: 'Número de mesa no válido.' });
  }

  try {
    const mesa = await Mesa.findOne({ numero: Number(numeroMesa) });
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada.' });
    }

    const pedidos = await PedidoBebida.find({ mesa: mesa._id });
    const todosListos = pedidos.every((pedido) => pedido.estado === 'listo');

    res.status(200).json({ todosListos });
  } catch (error) {
    logger.error('Error al verificar pedidos de la mesa:', error);
    res.status(500).json({ error: 'Error al verificar pedidos de la mesa.' });
  }
};
export const agregarProductoBebida = async (req, res) => {
  const { mesaId } = req.params;
  const { productos } = req.body;

  try {
    // Validación inicial
    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: "Debes enviar al menos una bebida válida." });
    }

    const errores = productos.filter(
      (p) => !p.producto || !p.cantidad || p.total == null || p.precioSeleccionado == null
    );
    if (errores.length > 0) {
      return res.status(400).json({
        error: "Cada bebida debe tener producto, cantidad, total y precioSeleccionado.",
      });
    }

    // Buscar mesa SIN populate
    const mesa = /^[0-9a-fA-F]{24}$/.test(mesaId)
      ? await Mesa.findById(mesaId)
      : await Mesa.findOne({ numero: parseInt(mesaId, 10) });

    if (!mesa) return res.status(404).json({ error: "Mesa no encontrada" });

    // Validar sesión activa
    if (!mesa.sesionActiva) {
      return res.status(400).json({ error: "La mesa no tiene una sesión activa." });
    }

    const sesionActiva = await SesionMesa.findById(mesa.sesionActiva);
    if (!sesionActiva) {
      return res.status(400).json({ error: "La mesa no tiene una sesión activa válida." });
    }

    // Obtener datos de los productos desde DB
    const idsProductos = productos.map((p) => p.producto);
    const productosDB = await Producto.find({ _id: { $in: idsProductos } });

    // Construir estructura final
    const productosCompletos = productos.map((p) => {
      const info = productosDB.find((x) => x._id.toString() === p.producto.toString());

      return {
        ...p,
        tipoPrecio: p.tipoPrecio || info?.tipoPrecio || "precioBase",
        categoria: info?.categoria || "bebida",
        tipo: "bebida",
      };
    });

    // Buscar pedido pendiente (SIN populate)
    let pedidoExistenteId = mesa.pedidosBebidas.find((id) => id); // solo IDs
    let pedidoExistente = pedidoExistenteId
      ? await PedidoBebida.findById(pedidoExistenteId)
      : null;

    if (pedidoExistente && pedidoExistente.estado !== "pendiente") {
      pedidoExistente = null;
    }

    let pedidoFinal;

    // Si existe pedido pendiente → añadir productos
    if (pedidoExistente) {
      productosCompletos.forEach((p) => {
        pedidoExistente.productos.push({ ...p });
        pedidoExistente.total = Number((pedidoExistente.total + p.total).toFixed(2));
      });

      pedidoFinal = await pedidoExistente.save();
    } else {
      // Crear nuevo pedido
      const nuevoPedido = new PedidoBebida({
        mesa: mesa._id,
        sesionId: mesa.sesionActiva,
        productos: productosCompletos,
        estado: "pendiente",
        total: Number(productosCompletos.reduce((sum, p) => sum + p.total, 0)),
      });

      pedidoFinal = await nuevoPedido.save();

      // Agregar referencia a mesa (evitar duplicados)
      if (!mesa.pedidosBebidas.includes(pedidoFinal._id)) {
        mesa.pedidosBebidas.push(pedidoFinal._id);
        await mesa.save();
      }
    }

    // Recalcular total real de la mesa (consulta limpia)
    await recalcularTotalMesa(mesa._id);

    // Registrar ventas de cada producto
    for (const p of productosCompletos) {
      const venta = new Venta({
        producto: p.producto,
        pedidoId: pedidoFinal._id,
        cantidad: p.cantidad,
        total: p.total,
        tipo: "bebida",
      });

      await venta.save();

      const productoEnDB = await Producto.findById(p.producto);
      if (productoEnDB) {
        productoEnDB.ventas.push(venta._id);
        productoEnDB.stock -= p.cantidad;
        await productoEnDB.save();
      }
    }

    // Emitir evento en socket
    req.io.emit("nuevoPedido", {
      tipo: "crear-bebida",
      mesaId: mesa._id.toString(),
      pedido: pedidoFinal.toObject(),
    });

    // Construir respuesta
    const datosRespuesta = {
      mesaNumero: mesa.numero,
      comensales: mesa.comensales || 0,
      productos: productosCompletos.map((p) => {
        const info = productosDB.find((x) => x._id.toString() === p.producto);
        return {
          nombre: info?.nombre || "Producto",
          cantidad: p.cantidad,
          tipoPrecio: p.tipoPrecio,
          acompanante: p.acompanante || null,
          mensaje: p.mensaje || "",
          alergiasComensal: p.alergiasComensal || "",
        };
      }),
      total: Number(productosCompletos.reduce((sum, p) => sum + p.total, 0)),
    };

    // Intentar imprimir SIN BLOQUEAR EL FLUJO
    try {
      const secret = process.env.PRINT_SECRET || "clave-demo";
      const baseURL = process.env.IMPRESION_SERVER || "http://127.0.0.1:4000";

      await axios.post(`${baseURL}/imprimir-bebidas`, datosRespuesta, {
        headers: {
          "x-tpv-apikey": secret,
          "Content-Type": "application/json",
        },
      });

      logger.info("🖨️ Pedido de bebidas enviado a impresora");
    } catch (err) {
      logger.error("❌ Error al imprimir, pero NO se rompe el flujo:", err.message);
    }

    return res.json(datosRespuesta);

  } catch (error) {
    logger.error("❌ Error al agregar bebida:", error);
    res.status(500).json({ error: "Error al agregar bebida" });
  }
};
