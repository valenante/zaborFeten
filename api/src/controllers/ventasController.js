import Venta from '../models/Ventas.js';
import logger from '../../utils/logger.js'; // Asegúrate de tener un logger configurado
import Producto from '../models/Producto.js';
import Pedido from '../models/Pedido.js';

// Obtener todas las ventas
export const obtenerVentas = async (req, res) => {
  try {
    const ventas = await Venta.find().populate('producto');
    res.status(200).json(ventas);
  } catch (error) {
    logger.error('Error al obtener las ventas:', error);
    res.status(500).json({ error: 'Error al obtener las ventas' });
  }
};

// Obtener una venta por ID
export const obtenerVentasPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const venta = await Venta.findById(id);
    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    res.status(200).json(venta);
  } catch (error) {
    logger.error('Error al obtener la venta:', error);
    res.status(500).json({ error: 'Error al obtener la venta' });
  }
};

// Crear una nueva venta
export const crearVenta = async (req, res) => {
  const { productoId, pedidoId, cantidad } = req.body;

  try {
    // Verificar que el producto exista
    const producto = await Producto.findById(productoId);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Verificar que el pedido exista
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Crear la nueva venta
    const nuevaVenta = new Venta({
      productoId,
      pedidoId,
      cantidad,
      tipo: producto.tipo,
    });

    // Guardar la venta en la base de datos
    await nuevaVenta.save();

    // Asociar la venta al producto
    producto.ventas.push(nuevaVenta._id);
    producto.stock -= cantidad; // Restar la cantidad vendida al stock
    await producto.save();

    res
      .status(201)
      .json({ message: 'Venta creada con éxito', venta: nuevaVenta });
  } catch (error) {
    logger.error('Error al crear la venta:', error);
    res
      .status(400)
      .json({ error: 'Error al crear la venta. Verifica los datos enviados.' });
  }
};

// Actualizar una venta por ID
export const actualizarVenta = async (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;

  try {
    const venta = await Venta.findById(id);

    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    // Actualizar la cantidad en la venta
    if (cantidad !== undefined) {
      const producto = await Producto.findById(venta.productoId);
      if (producto) {
        producto.stock += venta.cantidad; // Revertir el stock actual
        producto.stock -= cantidad; // Aplicar la nueva cantidad
        await producto.save();
      }
      venta.cantidad = cantidad;
    }

    // Guardar los cambios en la venta
    await venta.save();

    res.status(200).json({ message: 'Venta actualizada con éxito', venta });
  } catch (error) {
    logger.error('Error al actualizar la venta:', error);
    res.status(400).json({ error: 'Error al actualizar la venta.' });
  }
};

// Eliminar una venta por ID
export const eliminarVenta = async (req, res) => {
  const { id } = req.params;

  try {
    const venta = await Venta.findByIdAndDelete(id);

    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    // Revertir el stock en el producto asociado
    const producto = await Producto.findById(venta.productoId);
    if (producto) {
      producto.stock += venta.cantidad;
      await producto.save();
    }

    res.status(200).json({ message: 'Venta eliminada con éxito', venta });
  } catch (error) {
    logger.error('Error al eliminar la venta:', error);
    res.status(500).json({ error: 'Error al eliminar la venta.' });
  }
};
