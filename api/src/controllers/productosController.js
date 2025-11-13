import Producto from '../models/Producto.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado
import Pedido from '../models/Pedido.js';
import PedidoBebidas from '../models/PedidoBebidas.js';
import Eliminacion from '../models/Eliminacion.js';
import Mesa from '../models/Mesa.js';


export const recalcularTotalMesa = async (mesaId) => {
  const mesa = await Mesa.findById(mesaId);
  if (!mesa) throw new Error("Mesa no encontrada");

  const [pedidos, pedidosBebidas] = await Promise.all([
    Pedido.find({
      mesa: mesaId,
      sesionId: mesa.sesionActiva,
      estado: { $in: ["pendiente", "listo"] },
    }),
    PedidoBebidas.find({
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
// Obtener todos los productos
export const obtenerProductos = async (req, res) => {
  try {
    const productos = await Producto.find();
    res.status(200).json(productos);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
};

// Obtener un producto por ID
export const obtenerProductoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const producto = await Producto.findById(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(200).json(producto);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
};

export const obtenerCategoriasPorTipo = async (req, res) => {
  const { type } = req.params;

  try {
    const filtroTipo = type === 'plato' ? ['plato', 'tapaRacion'] : [type];
    const categorias = await Producto.distinct('categoria', {
      tipo: { $in: filtroTipo },
    });

    res.status(200).json({ categories: categorias });
  } catch (error) {
    logger.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener las categorías' });
  }
};

//Editar producto
export const editarProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const productoActualizado = await Producto.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (req.file) {
      productoActualizado.img = `/images/${req.file.filename}`;
    }
    if (!productoActualizado) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(200).json(productoActualizado);
  } catch (error) {
    logger.error(error);
    res.status(400).json({
      error: 'Error al actualizar el producto. Verifica los datos enviados.',
    });
  }
};

export const obtenerProductosPorCategoria = async (req, res) => {
  const { category } = req.params;

  try {
    const productos = await Producto.find({ categoria: category });

    res.status(200).json({ products: productos });
  } catch (error) {
    logger.error('Error al obtener productos por categoría:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
};

// Crear un nuevo producto
export const crearProducto = async (req, res) => {
  try {
    const nuevoProducto = new Producto(req.body);
    if (req.file) {
      nuevoProducto.img = `/images/${req.file.filename}`; // Asignar la ruta de la imagen
    }
    await nuevoProducto.save();

    // Emitir evento de creación de producto
    req.io.emit('productoCreado', nuevoProducto);

    res.status(201).json(nuevoProducto);
  } catch (error) {
    logger.error(error);
    res.status(400).json({
      error: 'Error al crear el producto. Verifica los datos enviados.',
    });
  }
};

export const eliminarProducto = async (req, res) => {
  const { id } = req.params;

  try {
    const producto = await Producto.findByIdAndDelete(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(200).json({ message: 'Producto eliminado con éxito' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};

export const eliminarProductoPedido = async (req, res) => {
  const { pedidoId, id: productoId } = req.params;
  const user = req.user?.id || req.user?._id;

  try {
    if (!user) {
      return res.status(401).json({ error: "Usuario no autenticado." });
    }

    // Buscar el pedido en pedidos o en pedidosBebidas
    let pedido = await Pedido.findById(pedidoId);
    let pedidoTipo = "producto";

    if (!pedido) {
      pedido = await PedidoBebidas.findById(pedidoId);
      pedidoTipo = "bebida";
    }

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    // Buscar producto dentro del pedido
    const productoEliminado = pedido.productos.find(
      (producto) =>
        producto._id.toString() === productoId ||
        producto.producto.toString() === productoId
    );

    if (!productoEliminado) {
      return res.status(404).json({ error: "Producto no encontrado en el pedido." });
    }

    // Eliminar producto del array
    pedido.productos = pedido.productos.filter(
      (producto) => producto._id.toString() !== productoEliminado._id.toString()
    );

    // Recalcular total del pedido
    pedido.total = pedido.productos.reduce(
      (total, producto) => total + (producto.total || 0),
      0
    );

    // Si ya no quedan productos → eliminar pedido entero
    if (pedido.productos.length === 0) {
      await pedido.deleteOne(); // elimina Pedido o PedidoBebida según corresponda

      // Cargar mesa SIN populate
      const mesa = await Mesa.findById(pedido.mesa);
      if (!mesa) return res.status(404).json({ error: "Mesa no encontrada." });

      if (pedidoTipo === "producto") {
        mesa.pedidos = mesa.pedidos.filter((p) => p.toString() !== pedidoId);
      } else {
        mesa.pedidosBebidas = mesa.pedidosBebidas.filter((p) => p.toString() !== pedidoId);
      }

      await mesa.save();

      // Recalcular total real de la mesa (query limpia)
      const totalActual = await recalcularTotalMesa(mesa._id);

      // Registrar eliminación
      const eliminacion = new Eliminacion({
        producto: productoEliminado.producto,
        pedido: pedidoId,
        cantidad: productoEliminado.cantidad || 1,
        user,
        mesa: pedido.mesa,
        tipo: pedidoTipo,
      });

      await eliminacion.save();

      return res.json({
        message: `${pedidoTipo === "bebida" ? "Bebida" : "Producto"} eliminado. Pedido vacío eliminado.`,
        mesa: { id: mesa._id, total: totalActual },
        pedido: null,
      });
    }

    // Si aún quedan productos → guardar pedido
    await pedido.save();

    // Cargar mesa SIN populate
    const mesa = await Mesa.findById(pedido.mesa);
    if (!mesa) return res.status(404).json({ error: "Mesa no encontrada." });

    // Recalcular total real
    const totalActual = await recalcularTotalMesa(mesa._id);

    // Registrar eliminación
    const eliminacion = new Eliminacion({
      producto: productoEliminado.producto,
      pedido: pedidoId,
      cantidad: productoEliminado.cantidad || 1,
      user,
      mesa: pedido.mesa,
      tipo: pedidoTipo,
    });

    await eliminacion.save();

    return res.json({
      message: `${pedidoTipo === "bebida" ? "Bebida" : "Producto"} eliminado y registrado.`,
      mesa: { id: mesa._id, total: totalActual },
      pedido: {
        id: pedido._id,
        total: pedido.total,
        productos: pedido.productos,
      },
    });

  } catch (error) {
    logger.error("❌ Error al eliminar producto/bebida:", error);
    res.status(500).json({ error: "Error al eliminar producto/bebida." });
  }
};

export const buscarProductoPorNombre = async (req, res) => {
  let nombre = req.query.nombre;
  if (!nombre)
    return res.status(400).json({ error: 'Falta el nombre del producto' });

  const nombreNormalizado = nombre.toLowerCase().replace(/[\s-]+/g, '');

  try {
    const productos = await Producto.find({
      $or: [
        { nombreNormalizado: { $regex: nombreNormalizado, $options: 'i' } },
        {
          aliases: { $elemMatch: { $regex: nombreNormalizado, $options: 'i' } },
        },
      ],
    });

    if (productos.length === 0)
      return res.status(404).json({ error: 'Producto no encontrado' });

    res.json(productos[0]);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Error al buscar producto' });
  }
};
