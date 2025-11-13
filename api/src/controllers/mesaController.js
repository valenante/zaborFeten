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
import { emitirRegistroVerifactu } from "../../utils/emitirFactura.js";
import moment from "moment-timezone";
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
  try {
    const { mesa, comensales = 1 } = req.body;

    if (!mesa) {
      return res.status(400).json({ error: "El número de mesa es obligatorio." });
    }

    // Buscar mesa REAL
    const mesaDoc = await Mesa.findOne({ numero: Number(mesa) });
    if (!mesaDoc) {
      return res.status(404).json({ error: "Mesa no encontrada." });
    }

    // Si mesa ya está abierta Y sesión es válida → devolverla sin romper nada
    if (mesaDoc.estado === "abierta" && mesaDoc.sesionActiva) {
      const sesionOK = await SesionMesa.findById(mesaDoc.sesionActiva);
      if (sesionOK) {
        return res.status(200).json({
          tokenLider: mesaDoc.tokenLider,
          sesionActiva: mesaDoc.sesionActiva,
          estado: mesaDoc.estado,
        });
      }
    }

    // Crear token líder si no existe
    if (!mesaDoc.tokenLider) {
      mesaDoc.tokenLider = uuidv4();
    }

    // Crear sesión nueva válida
    const nuevaSesion = await SesionMesa.create({
      mesa: mesaDoc._id,
      estado: "activa",
      inicio: new Date(),
    });

    // Actualizar estado de mesa
    mesaDoc.sesionActiva = nuevaSesion._id;
    mesaDoc.estado = "abierta";
    mesaDoc.comensales = comensales;
    mesaDoc.total = 0;

    await mesaDoc.save();

    // Emitir al TPV
    req.io.emit("mesaAbierta", {
      _id: mesaDoc._id,
      numero: mesaDoc.numero,
      sesionActiva: mesaDoc.sesionActiva,
      comensales,
      estado: "abierta",
    });

    res.status(201).json({
      tokenLider: mesaDoc.tokenLider,
      sesionActiva: mesaDoc.sesionActiva,
      estado: mesaDoc.estado,
    });

  } catch (error) {
    logger.error("Error al crear tokenLider:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};


// Obtener todas las mesas ordenadas correctamente
export const obtenerMesas = async (req, res) => {
  try {
    const mesas = await Mesa.find().populate("pedidos");

    const mesasOrdenadas = mesas.sort((a, b) => {
      const numA = a.numero;
      const numB = b.numero;

      // Si ambos son submesas (ej. 2401, 2402)
      const baseA = numA >= 100 ? Math.floor(numA / 100) : numA;
      const baseB = numB >= 100 ? Math.floor(numB / 100) : numB;

      // Si pertenecen al mismo grupo base → ordenar normalmente
      if (baseA === baseB) return numA - numB;

      // Si A es submesa de B
      if (baseA === numB) return 1; // A después de B
      if (baseB === numA) return -1; // B después de A

      // Si A es una submesa (2001) y su base está entre A y B
      if (baseA === Math.floor(numB / 100)) return -1;
      if (baseB === Math.floor(numA / 100)) return 1;

      // Orden normal
      return baseA - baseB;
    });

    res.status(200).json(mesasOrdenadas);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Error al obtener las mesas activas" });
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

  logger.info("===== 🟣 INICIO cerrarMesa =====");
  logger.info(`📥 Mesa ID: ${id}`);
  logger.info(`📥 MetodoPago recibido: ${JSON.stringify(metodoPago)}`);
  logger.info(`📥 Cliente: ${clienteNombre} | NIF: ${clienteNIF}`);
  logger.info(`📥 Camarero: ${camarero}`);

  try {
    const ahora = moment().tz("Europe/Madrid").toDate();
    logger.info(`🕒 Fecha actual: ${ahora}`);

    // === 1️⃣ Cargar mesa con pedidos ===
    logger.info("🔍 Buscando mesa con pedidos y bebidas...");
    const mesa = await Mesa.findById(id)
      .populate({
        path: "pedidos pedidosBebidas",
        populate: { path: "productos.producto" },
      })
      .lean();

    logger.info(`📌 Mesa encontrada: ${mesa ? "Sí" : "No"}`);
    if (!mesa) {
      logger.error("❌ Mesa no encontrada");
      return res.status(404).json({ error: "Mesa no encontrada" });
    }

    logger.info(`➡️ Mesa ${mesa.numero}, Estado: ${mesa.estado}, Total: ${mesa.total}`);

    // === 🔸 Cierre sin consumo ===
    const sinPedidos =
      (!mesa.pedidos || mesa.pedidos.length === 0) &&
      (!mesa.pedidosBebidas || mesa.pedidosBebidas.length === 0);

    logger.info(`🟡 ¿Sin pedidos? ${sinPedidos}`);

    if (sinPedidos) {
      logger.info("🟡 Iniciando cierre SIN consumo...");

      const mesaCerrada = await MesaCerrada.create({
        numero: mesa.numero,
        pedidos: [],
        pedidoBebidas: [],
        total: 0,
        inicio: mesa.inicio,
        cierre: new Date(),
        comensales: mesa.comensales || 0,
        metodoPago: { tipo: "sinConsumo", efectivo: 0, tarjeta: 0, propina: 0, cambio: 0 },
        sesionActiva: mesa.sesionActiva,
        camarero: camarero || "",
        cierreSinConsumo: true,
        motivoCierre: "sin consumo",
      });

      logger.info("🟡 Mesa sin consumo registrada en MesaCerrada");

      await SesionMesa.updateOne(
        { mesa: mesa._id, estado: "activa" },
        { $set: { estado: "cerrada", cierre: new Date() } }
      );

      logger.info("🟡 Sesión activa marcada como cerrada");

      await Mesa.updateOne(
        { _id: id },
        {
          estado: "cerrada",
          total: 0,
          pedidos: [],
          pedidosBebidas: [],
          comensales: null,
          tokenLider: null,
          sesionActiva: null,
          cuentaImpresa: false,
        }
      );

      logger.info("🟡 Mesa actualizada como cerrada ");

      return res.status(200).json({
        message: "Mesa cerrada sin consumo (sin pedidos ni productos)",
        mesaCerrada,
        facturaEmitida: false,
        tipoCierre: "sinConsumo",
      });
    }

    // === 2️⃣ Totales y validaciones ===
    logger.info("🧮 Validando totales...");

    const { efectivo = 0, tarjeta = 0, propina = 0 } = metodoPago || {};
    const totalMesa = Number((mesa.total || 0).toFixed(2));
    const totalPagado = Number((efectivo + tarjeta).toFixed(2));

    logger.info(`💶 Total mesa: ${totalMesa}`);
    logger.info(`💶 Total pagado: ${totalPagado}`);
    logger.info(`💶 Efectivo: ${efectivo}, Tarjeta: ${tarjeta}, Propina: ${propina}`);

    if (totalPagado < totalMesa) {
      logger.warn("⚠️ Pago insuficiente");
      return res.status(400).json({
        error: `El monto ingresado (${totalPagado} €) es menor que el total de la mesa (${totalMesa} €).`,
      });
    }

    const cambio = Number((totalPagado - totalMesa).toFixed(2));
    const propinaCalc = Number(propina.toFixed(2));
    logger.info(`💶 Cambio a devolver: ${cambio}`);

    // === 3️⃣ Caja del día ===
    logger.info("🧾 Buscando caja del día…");

    const inicioDia = new Date(ahora); inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(ahora); finDia.setHours(23, 59, 59, 999);

    let caja = await Caja.findOne({
      fechaApertura: { $gte: inicioDia, $lte: finDia },
      estado: "abierta",
    });

    logger.info(`📌 Caja encontrada: ${caja ? "Sí" : "No"}`);

    const opCaja = {
      tipo: "cierre",
      monto: totalMesa,
      razon: `Cierre de la mesa número ${mesa.numero}`,
    };

    if (caja) {
      logger.info("✏️ Actualizando caja actual...");
      const efectivoReal = Math.min(efectivo, totalMesa);
      const tarjetaReal = Math.min(tarjeta, Math.max(totalMesa - efectivoReal, 0));

      caja.detallesMetodoPago.efectivo += efectivoReal;
      caja.detallesMetodoPago.tarjeta += tarjetaReal;
      caja.detallesMetodoPago.propina += propinaCalc;
      caja.total += totalMesa;
      caja.operaciones.push(opCaja);

      await caja.save();
    } else {
      logger.info("📦 Creando nueva caja del día");
      caja = await Caja.create({
        total: totalMesa,
        detallesMetodoPago: { efectivo, tarjeta, propina: propinaCalc },
        operaciones: [opCaja],
      });
    }

    // === 4️⃣ Registrar mesa cerrada ===
    logger.info("📦 Registrando mesa cerrada...");

    const mesaCerrada = await MesaCerrada.create({
      numero: mesa.numero,
      pedidos: mesa.pedidos.map(p => p._id),
      pedidoBebidas: mesa.pedidosBebidas.map(p => p._id),
      total: totalMesa,
      inicio: mesa.inicio,
      cierre: new Date(),
      comensales: mesa.comensales || 1,
      metodoPago: { efectivo, tarjeta, propina: propinaCalc, cambio },
      sesionActiva: mesa.sesionActiva,
      camarero: camarero || "",
      cierreSinConsumo: false,
      motivoCierre: "consumo realizado",
    });

    logger.info("🟢 MesaCerrada creada correctamente.");

    // === 5️⃣ Intentar abrir cajón ===
    logger.info("🟪 Intentando abrir cajón...");
    try {
      await abrirCajon();
      logger.info("🟢 Cajón intentado (no bloquea)");
    } catch (err) {
      logger.warn(`⚠️ No se pudo abrir cajón: ${err?.message}`);
    }

    // === 6️⃣ Obtener número de factura ===
    logger.info("🧾 Obteniendo número de factura...");
    const numeroFactura = await obtenerNumeroFactura();
    logger.info(`📄 Número de factura: ${numeroFactura}`);

    // === 7️⃣ Productos ===
    logger.info("📦 Generando lista de productos para factura...");

    const productos = [
      ...mesa.pedidos.flatMap(p => p.productos),
      ...mesa.pedidosBebidas.flatMap(p => p.productos),
    ].map(({ producto, cantidad, precioSeleccionado }) => ({
      nombre: producto?.nombre || "Producto desconocido",
      cantidad: Number(cantidad || 1),
      precio: Number(precioSeleccionado || 0),
      iva: Number(producto?.iva ?? 10),
    }));

    logger.info(`📌 Total productos: ${productos.length}`);

    const to2 = n => Number(n.toFixed(2));

    // === 8️⃣ VeriFactu
    logger.info("📡 Enviando a VeriFactu...");

    let facturaDoc = {};
    try {
      facturaDoc = await emitirRegistroVerifactu({
        tipo: "alta",
        datos: {
          numeroFactura,
          fechaExpedicion: new Date().toISOString().split("T")[0],
          clienteNombre: clienteNombre || "Consumidor Final",
          clienteNIF,
          productos,
          mesaNumero: mesa.numero,
          camarero: camarero || "",
        },
      });

      logger.info(`🟢 VeriFactu OK: ${facturaDoc.hashFactura || facturaDoc.huellaTCR}`);
    } catch (err) {
      logger.warn("⚠️ VeriFactu falló, flujo continúa:", err.message);
      facturaDoc = { estado: "error", hashFactura: null };
    }

    // === 11️⃣ Cerrar sesión activa
    logger.info("🔒 Cerrando sesión activa…");
    await SesionMesa.updateOne(
      { mesa: mesa._id, estado: "activa" },
      { $set: { estado: "cerrada", cierre: new Date() } }
    );
    logger.info("🟢 Sesión cerrada");

    // === 12️⃣ Limpiar mesa
    logger.info("🧹 Limpiando mesa…");
    await Mesa.updateOne(
      { _id: id },
      {
        estado: "cerrada",
        total: 0,
        pedidos: [],
        pedidosBebidas: [],
        comensales: null,
        tokenLider: null,
        sesionActiva: null,
        cuentaImpresa: false,
      }
    );
    logger.info("🟢 Mesa limpiada y cerrada");

    // === 13️⃣ Respuesta final ===
    logger.info("===== 🟢 FIN cerrarMesa - ÉXITO =====");

    return res.status(200).json({
      message: "Mesa cerrada con éxito",
      mesaCerrada,
      propina: propinaCalc,
      cambio,
      facturaEmitida: facturaDoc.estado !== "error",
      numeroFactura,
      estadoAEAT: facturaDoc.estado || "no_enviada",
      hashFactura: facturaDoc.hashFactura || facturaDoc.huellaTCR || null,
      fechaExpedicion: new Date().toISOString(),
      datosImpresion: {
        mesaNumero: mesa.numero,
        comensales: mesa.comensales || 1,
        clienteNombre: clienteNombre || "Consumidor Final",
        clienteNIF,
        numeroFactura,
        fechaExpedicion: new Date().toISOString(),
        productos,
        total: totalMesa,
        hash: facturaDoc.hashFactura || facturaDoc.huellaTCR || null,
        camarero: camarero || "",
      },
    });

  } catch (error) {
    logger.error("❌ ERROR FATAL en cerrarMesa:", error);
    res.status(500).json({ error: "Error al cerrar la mesa" });
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
    const { numero, zona = "interior" } = req.body;

    // Verificar duplicados
    const mesaExistente = await Mesa.findOne({ numero });
    if (mesaExistente) {
      return res.status(400).json({ error: `La mesa número ${numero} ya existe.` });
    }

    // Asignar posición por defecto (segura)
    // Para hacerlo más ordenado, movemos las mesas nuevas en diagonal incremental
    const totalMesas = await Mesa.countDocuments({});
    const offset = (totalMesas % 10) * 8; // cada nueva mesa se desplaza un poco más
    const posicion = {
      x: 10 + offset, // entre 10% y 90%
      y: 10 + offset, // igual
    };

    const nuevaMesa = new Mesa({
      numero,
      estado: "cerrada",
      zona,
      posicion,
      total: 0,
      pedidos: [],
      pedidosBebidas: [],
      inicio: new Date(),
    });

    await nuevaMesa.save();
    res.status(201).json({
      message: `Mesa ${numero} creada exitosamente en zona ${zona}`,
      mesa: nuevaMesa,
    });
  } catch (error) {
    logger.error("Error al crear la mesa:", error);
    res.status(500).json({ error: "Hubo un problema al crear la mesa." });
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

// PUT /mesas/:id/comensales
export const actualizarComensales = async (req, res) => {
  const { id } = req.params;
  const { comensales } = req.body;

  try {
    if (!comensales || isNaN(comensales) || comensales < 1 || comensales > 25) {
      return res
        .status(400)
        .json({ error: "Número de comensales inválido (debe estar entre 1 y 25)." });
    }

    const mesa = await Mesa.findById(id);
    if (!mesa) {
      return res.status(404).json({ error: "Mesa no encontrada." });
    }

    const comensalesPrevios = mesa.comensales || 0;
    mesa.comensales = comensales;
    await mesa.save();

    // Emitir actualización en tiempo real
    if (req.io) {
      req.io.emit("mesaActualizada", {
        id: mesa._id,
        numero: mesa.numero,
        comensales,
      });
    }

    logger.info(
      `👥 Comensales actualizados en mesa ${mesa.numero}: ${comensalesPrevios} → ${comensales}`
    );

    return res.status(200).json({
      message: `Comensales actualizados correctamente (${comensales}).`,
      mesa: {
        id: mesa._id,
        numero: mesa.numero,
        comensales: mesa.comensales,
      },
    });
  } catch (error) {
    logger.error("❌ Error al actualizar comensales:", error);
    res.status(500).json({ error: "Error al actualizar comensales." });
  }
};

// PUT /mesas/:id/posicion
export const actualizarPosicionMesa = async (req, res) => {
  try {
    const { x, y } = req.body;
    const mesa = await Mesa.findByIdAndUpdate(
      req.params.id,
      { posicion: { x, y } },
      { new: true }
    );
    if (!mesa) return res.status(404).json({ error: "Mesa no encontrada" });
    res.json(mesa);
  } catch (error) {
    console.error("❌ Error al actualizar posición de mesa:", error);
    res.status(500).json({ error: "Error al actualizar posición" });
  }
};

// ✅ Actualizar una mesa (número, zona, capacidad, etc.)
export const actualizarMesa = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, zona, capacidad, posicion } = req.body;

    const mesa = await Mesa.findById(id);
    if (!mesa) {
      return res.status(404).json({ error: "Mesa no encontrada" });
    }

    // 🔹 Actualizamos solo los campos enviados (sin sobreescribir todo)
    if (numero !== undefined) mesa.numero = numero;
    if (zona !== undefined) mesa.zona = zona;
    if (capacidad !== undefined) mesa.capacidad = capacidad;
    if (posicion !== undefined) mesa.posicion = posicion;

    await mesa.save();

    res.status(200).json({
      message: "✅ Mesa actualizada correctamente",
      mesa,
    });
  } catch (error) {
    console.error("❌ [actualizarMesa] Error:", error);
    res.status(500).json({ error: "Error al actualizar la mesa" });
  }
};
