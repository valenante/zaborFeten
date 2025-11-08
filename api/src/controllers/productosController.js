import Producto from '../models/Producto.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado
import Pedido from '../models/Pedido.js';
import PedidoBebidas from '../models/PedidoBebidas.js';
import Eliminacion from '../models/Eliminacion.js';
import Mesa from '../models/Mesa.js';
import mongoose from 'mongoose';

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
    // Verificar que se envió el usuario
    if (!user) {
      return res.status(401).json({ error: "Usuario no autenticado." });
    }

    // Buscar el pedido en pedidos de productos
    let pedido = await Pedido.findById(pedidoId);
    let pedidoTipo = "producto";

    if (!pedido) {
      pedido = await PedidoBebidas.findById(pedidoId);
      pedidoTipo = "bebida";
    }

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    // Buscar el producto en el pedido
    const productoEliminado = pedido.productos.find(
      (producto) =>
        producto._id.toString() === productoId ||
        producto.producto.toString() === productoId
    );

    if (!productoEliminado) {
      return res.status(404).json({ error: "Producto no encontrado en el pedido." });
    }

    // Filtrar el producto del pedido y recalcular el total
    const antes = pedido.productos.length;
    pedido.productos = pedido.productos.filter(
      (producto) => producto._id.toString() !== productoEliminado._id.toString()
    );
    const despues = pedido.productos.length;

    pedido.total = pedido.productos.reduce(
      (total, producto) => total + (producto.total || 0),
      0
    );

    // Si el pedido no tiene productos después de la eliminación, eliminar el pedido
    if (pedido.productos.length === 0) {
      if (pedidoTipo === "producto") {
        await Pedido.findByIdAndDelete(pedidoId);
      } else {
        await PedidoBebidas.findByIdAndDelete(pedidoId);
      }

      const mesa = await Mesa.findById(pedido.mesa).populate("pedidos pedidosBebidas");
      if (!mesa) {
        return res.status(404).json({ error: "Mesa no encontrada." });
      }

      // Eliminar el pedido correspondiente
      if (pedidoTipo === "producto") {
        mesa.pedidos = mesa.pedidos.filter((p) => p._id.toString() !== pedidoId);
      } else {
        mesa.pedidosBebidas = mesa.pedidosBebidas.filter((p) => p._id.toString() !== pedidoId);
      }

      mesa.total = [...mesa.pedidos, ...mesa.pedidosBebidas].reduce(
        (totalMesa, pedido) => totalMesa + (pedido.total || 0),
        0
      );
      await mesa.save();

      // Registrar la eliminación en la colección `Eliminaciones`
      const eliminacion = new Eliminacion({
        producto: productoEliminado.producto,
        pedido: pedidoId,
        cantidad: productoEliminado.cantidad || 1,
        user: mongoose.Types.ObjectId.isValid(user)
          ? user
          : new mongoose.Types.ObjectId("000000000000000000000000"),
        mesa: pedido.mesa,
        tipo: pedidoTipo,
      });

      await eliminacion.save();

      return res.json({
        message: `${pedidoTipo === "bebida" ? "Bebida" : "Producto"} eliminado y pedido eliminado con éxito.`,
        mesa: {
          id: mesa._id,
          total: mesa.total,
        },
        pedido: null,
      });
    }

    // Guardar el pedido actualizado
    await pedido.save();

    // Actualizar el total de la mesa
    const mesa = await Mesa.findById(pedido.mesa).populate("pedidos pedidosBebidas");
    if (!mesa) {
      return res.status(404).json({ error: "Mesa no encontrada." });
    }

    const totalAnteriorMesa = mesa.total;
    mesa.total = [...mesa.pedidos, ...mesa.pedidosBebidas].reduce(
      (totalMesa, pedido) => totalMesa + (pedido.total || 0),
      0
    );
    await mesa.save();

    // Registrar la eliminación en la colección `Eliminaciones`
    const eliminacion = new Eliminacion({
      producto: productoEliminado.producto,
      pedido: pedidoId,
      cantidad: productoEliminado.cantidad || 1,
      user: mongoose.Types.ObjectId.isValid(user)
        ? user
        : new mongoose.Types.ObjectId("000000000000000000000000"),
      mesa: pedido.mesa,
      tipo: pedidoTipo,
    });
    await eliminacion.save();

    res.json({
      message: `${pedidoTipo === "bebida" ? "Bebida" : "Producto"} eliminado y registrado con éxito.`,
      mesa: {
        id: mesa._id,
        total: mesa.total,
      },
      pedido: {
        id: pedido._id,
        total: pedido.total,
        productos: pedido.productos,
      },
    });
  } catch (error) {
    logger.error("Error al eliminar producto/bebida:", error);
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
