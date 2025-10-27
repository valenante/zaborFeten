import { Schema, model } from 'mongoose';
// Subesquema para presentaciones y opciones personalizables
const opcionPersonalizableSchema = new Schema(
  {
    tipo: { type: String, required: true }, // Ejemplo: "queso", "acompañamiento"
    opcion: { type: [String], default: [] }, // Ejemplo: ["cheddar", "mozzarella"]
  },
  { _id: false }
);

const adicionalSchema = new Schema(
  {
    nombre: { type: String, required: true }, // Ejemplo: "Unidad adicional"
    precio: { type: Number, required: true }, // Ejemplo: 2.1
  },
  { _id: false }
);

const WorkflowSchema = new Schema({
  estado: {
    type: String,
    enum: ['pendiente', 'solicitado', 'en_preparacion', 'listo'],
    default: 'pendiente'
  },
  solicitadoPor: { type: String, enum: ['frito', 'sala', 'caja', null], default: null },
  solicitadoA: { type: String, enum: ['frio', 'plancha', 'frito', null], default: null },
  tPendiente: { type: Number },   // epoch ms
  tSolicitado: { type: Number },
  tInicio: { type: Number },
  tListo: { type: Number }
}, { _id: false });

const PedidoSchema = new Schema({
  mesa: { type: Schema.Types.ObjectId, ref: 'Mesa', required: true },
  usuario: { type: Schema.Types.ObjectId, ref: 'User' }, // Opcional
  comensales: { type: Number },
  estado: { type: String, enum: ['pendiente', 'listo'], default: 'pendiente' },
  fecha: { type: Date, default: Date.now },
  sesionId: { type: Schema.Types.ObjectId, ref: 'SesionMesa' }, // ✅ Sesión de la mesa
         cerradoPorEstacion: {
    frio: { type: Boolean, default: false },
    plancha: { type: Boolean, default: false },
    frito: { type: Boolean, default: false }, // opcional, si quieres que central también se marque
  },
   mensajesSeccion: {
    entrante: { type: String, default: "" },
    medio: { type: String, default: "" },
    final: { type: String, default: "" },
  },
  servirTodoJunto: { type: Boolean, default: false }, // Indica si se deben servir todos los platos juntos
  productos: [
    {
      producto: {
        type: Schema.Types.ObjectId,
        ref: 'Producto',
        required: true,
      },
      workflow: { type: WorkflowSchema, default: () => ({ tPendiente: Date.now() }) },
      estacion: { 
        type: String, 
        enum: ['frio', 'frito', 'plancha'], 
        required: true 
      },
      cantidad: { type: Number, required: true },
      eliminado: { type: Boolean, default: false }, // Indica si se eliminó
      tipo: {
        type: String,
        enum: ['plato', 'tapaRacion', 'bebida', 'extra', 'postre'],
        required: true,
      }, // Diferencia entre plato y bebida
      categoria: { type: String, required: true }, // Ej: "entrante", "plato principal", "refresco", "licor"
      precioSeleccionado: { type: Number, required: true }, // Precio seleccionado
      ingredientesEliminados: { type: [String], default: [] }, // Ingredientes que el cliente ha solicitado quitar
      tipoPrecio: {
        type: String,
        enum: ['tapa', 'racion', 'surtido', 'precioBase', 'copa', 'botella'],
        required: true,
      }, // Tipo de precio seleccionado
      seccion: {
        type: String,
        enum: ['entrante', 'medio', 'final', null],
        default: 'medio',
      }, // ✅
      sabor: {
        type: [
          {
            ingrediente: String,
            cantidad: Number,
          },
        ],
        default: [],
      },
      puntosDeCoccion: [{ type: String }], // Ej: "Poco hecho", "Bien hecho"
      opcionesPersonalizables: [opcionPersonalizableSchema], // Opciones personalizables para el cliente
      nombreComensal: String,
      alergiasComensal: String,
      especificaciones: { type: [String], default: [] }, // Ejemplo: "Sin sal", "Extra picante"
      estadoPreparacion: {
        type: String,
        enum: ['pendiente', 'listo'],
        default: 'pendiente',
      },
      tipoPlato: {
        type: String,
        enum: ['individual', 'compartir'],
        required: false,
      }, // Tipo de plato
      tipoCroqueta: { type: String, default: 'normal' }, // Tipo de croqueta,
      adicionales: [adicionalSchema],
      mensaje: {
        type: String,
        default: '',
      },
      total: { type: Number, required: true },
      extras: [
        {
          nombre: { type: String, required: true }, // Nombre del extra
          precio: { type: Number, required: true }, // Precio del extra
        },
      ], // Extras opcionales que el cliente puede agregar
    },
  ],
  total: { type: Number, required: true },
});

export default model('Pedido', PedidoSchema);
