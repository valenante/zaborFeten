/**
 * Script de seed para productos con "estacion" y "aliases"
 * Ejecuta:  node scripts/generarProductos.js
 * Requiere: MONGO_URI en process.env o modifica abajo.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// 👉 Ajusta esta importación a tu proyecto real
// Si ya tienes el modelo, usa tu ruta:
import Producto from '../src/models/Producto.js';

// Si NO tuvieras el modelo, descomenta este bloque mínimo:
// import { Schema, model } from 'mongoose';
// const productoSchema = new Schema({
//   nombre: { type: String, required: true, unique: true },
//   aliases: { type: [String], default: [] },
//   tipo: { type: String, default: 'plato' },
//   categoria: { type: String, default: 'general' },
//   descripcion: { type: String, default: '' },
//   traducciones: { type: Object, default: {} },
//   precios: {
//     type: new Schema({
//       precioBase: Number,
//       tapa: Number,
//       racion: Number,
//       copa: Number,
//       botella: Number,
//     }, { _id: false }),
//     default: {},
//   },
//   stock: { type: Number, default: 0 },
//   ingredientes: { type: [String], default: [] },
//   ingredientesEliminados: { type: [String], default: [] },
//   puntosDeCoccion: { type: [String], default: [] },
//   opcionesPersonalizables: { type: [Object], default: [] },
//   adicionales: { type: [Object], default: [] },
//   sabor: { type: [Object], default: [] },
//   estado: { type: String, default: 'habilitado' },
//   estadoPreparacion: { type: String, default: 'pendiente' },
//   tipoPedido: { type: String, default: 'individual' },
//   tipoPlato: { type: String, default: 'individual' },
//   ventas: { type: [mongoose.Types.ObjectId], default: [] },
//   valoraciones: { type: [Object], default: [] },
//   especificaciones: { type: [String], default: [] },
//   estacion: { type: String, enum: ['frio', 'frito', 'plancha'], default: 'frito' },
// }, { timestamps: true });
// const Producto = model('Producto', productoSchema);

// ====== Helpers de aliases ======
const removeAccents = (str = '') =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const toSlug = (str = '') =>
  removeAccents(str).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const unique = (arr) => [...new Set(arr.filter(Boolean))];

const pluralizeEs = (word) => {
  // Pluralización naïve pero útil para cocina
  if (!word) return word;
  if (word.endsWith('z')) return word.slice(0, -1) + 'ces';
  if (/[aeiou]$/i.test(word)) return word + 's';
  return word + 'es';
};

/**
 * Genera aliases variados para mejorar búsqueda:
 * - original, minúsculas, sin acentos
 * - slug simple, palabras sueltas y su plural
 * - combinaciones cortas útiles (sin artículos)
 */
const buildAliases = (nombre) => {
  const base = String(nombre || '').trim();
  const lower = base.toLowerCase();
  const noAcc = removeAccents(lower);
  const slug = toSlug(base);

  const words = noAcc.split(/\s+/).filter(Boolean);
  const plurals = words.map(pluralizeEs);

  const combos = [
    base,
    lower,
    noAcc,
    slug,
    ...words,
    ...plurals,
    words.join(' '),
    plurals.join(' '),
  ];

  // quitar artículos comunes para variantes
  const sinArticulos = noAcc.replace(/\b(el|la|los|las|un|una|unos|unas|al|del)\b/g, '').replace(/\s+/g, ' ').trim();
  if (sinArticulos && sinArticulos !== noAcc) {
    combos.push(sinArticulos);
    combos.push(pluralizeEs(sinArticulos));
  }

  return unique(combos);
};

// ====== Datos base (puedes añadir más productos aquí) ======
const seedBase = [
  {
    nombre: 'Pollo al Curry',
    tipo: 'plato',
    categoria: 'principal',
    descripcion: 'Delicioso pollo al curry preparado con ingredientes frescos.',
    traducciones: {
      en: { nombre: 'English Pollo al Curry', descripcion: 'English description.' },
      fr: { nombre: 'Français Pollo al Curry', descripcion: 'Description en français.' },
    },
    precios: { precioBase: 7.46, tapa: 2.61, racion: 7.48, copa: null, botella: null },
    stock: 26,
    ingredientes: ['pollo', 'queso', 'tomate'],
    puntosDeCoccion: ['Poco hecho', 'Al punto', 'Bien hecho'],
    opcionesPersonalizables: [{ tipo: 'queso', opciones: ['cheddar', 'mozzarella'] }],
    adicionales: [{ nombre: 'Huevo extra', precio: 1.2 }],
    sabor: [],
    estado: 'habilitado',
    estadoPreparacion: 'pendiente',
    tipoPedido: 'individual',
    tipoPlato: 'individual',
    estacion: 'plancha', // ↩️ asigna la estación apropiada
  },
  {
    nombre: 'Ensalada César',
    tipo: 'plato',
    categoria: 'entrante',
    descripcion: 'Clásica ensalada con salsa césar y crutones.',
    traducciones: {
      en: { nombre: 'Caesar Salad', descripcion: 'Classic salad with Caesar dressing.' },
      fr: { nombre: 'Salade César', descripcion: 'Salade classique avec sauce César.' },
    },
    precios: { precioBase: 6.9, tapa: 3.5, racion: 6.9, copa: null, botella: null },
    stock: 40,
    ingredientes: ['lechuga', 'pollo', 'parmesano', 'crutones'],
    puntosDeCoccion: [],
    opcionesPersonalizables: [{ tipo: 'pollo', opciones: ['sí', 'no'] }],
    adicionales: [{ nombre: 'Extra parmesano', precio: 0.9 }],
    sabor: [],
    estado: 'habilitado',
    estadoPreparacion: 'pendiente',
    tipoPedido: 'individual',
    tipoPlato: 'individual',
    estacion: 'frio',
  },
  {
    nombre: 'Calamares Fritos',
    tipo: 'plato',
    categoria: 'principal',
    descripcion: 'Calamares a la andaluza, crujientes y dorados.',
    traducciones: {
      en: { nombre: 'Fried Squid', descripcion: 'Crispy Andalusian-style fried squid.' },
      fr: { nombre: 'Calmars Frits', descripcion: 'Calmars frits croustillants.' },
    },
    precios: { precioBase: 9.5, tapa: 4.5, racion: 9.5, copa: null, botella: null },
    stock: 32,
    ingredientes: ['calamar', 'harina', 'limón'],
    puntosDeCoccion: [],
    opcionesPersonalizables: [],
    adicionales: [{ nombre: 'Salsa alioli', precio: 0.8 }],
    sabor: [],
    estado: 'habilitado',
    estadoPreparacion: 'pendiente',
    tipoPedido: 'individual',
    tipoPlato: 'individual',
    estacion: 'frito',
  },
  {
    nombre: 'Secreto Ibérico a la Plancha',
    tipo: 'plato',
    categoria: 'principal',
    descripcion: 'Corte jugoso de cerdo ibérico a la plancha.',
    traducciones: {
      en: { nombre: 'Iberian Pork Secreto', descripcion: 'Juicy Iberian pork on the griddle.' },
      fr: { nombre: 'Secreto Ibérique', descripcion: 'Pièce juteuse de porc ibérique à la plancha.' },
    },
    precios: { precioBase: 14.9, tapa: null, racion: 14.9, copa: null, botella: null },
    stock: 18,
    ingredientes: ['cerdo ibérico', 'sal', 'pimienta'],
    puntosDeCoccion: ['Poco hecho', 'Al punto', 'Bien hecho'],
    opcionesPersonalizables: [],
    adicionales: [{ nombre: 'Pimientos del padrón', precio: 1.5 }],
    sabor: [],
    estado: 'habilitado',
    estadoPreparacion: 'pendiente',
    tipoPedido: 'individual',
    tipoPlato: 'individual',
    estacion: 'plancha',
  },
  {
    nombre: 'Tarta de Queso',
    tipo: 'plato',
    categoria: 'postre',
    descripcion: 'Cremosa tarta de queso horneada.',
    traducciones: {
      en: { nombre: 'Cheesecake', descripcion: 'Creamy baked cheesecake.' },
      fr: { nombre: 'Gâteau au Fromage', descripcion: 'Gâteau au fromage crémeux.' },
    },
    precios: { precioBase: 4.2, tapa: null, racion: 4.2, copa: null, botella: null },
    stock: 22,
    ingredientes: ['queso', 'huevo', 'azúcar', 'galleta'],
    puntosDeCoccion: [],
    opcionesPersonalizables: [],
    adicionales: [{ nombre: 'Coulis de frutos rojos', precio: 0.7 }],
    sabor: [],
    estado: 'habilitado',
    estadoPreparacion: 'pendiente',
    tipoPedido: 'individual',
    tipoPlato: 'individual',
    estacion: 'frio',
  },
];

// ====== Normaliza y construye documento final ======
const normalizeProducto = (p) => {
  const aliases = buildAliases(p.nombre);
  return {
    ...p,
    aliases,
    // Asegura estructura consistente
    traducciones: p.traducciones || { en: { nombre: p.nombre, descripcion: p.descripcion || '' } },
    precios: {
      precioBase: p.precios?.precioBase ?? null,
      tapa: p.precios?.tapa ?? null,
      racion: p.precios?.racion ?? null,
      copa: p.precios?.copa ?? null,
      botella: p.precios?.botella ?? null,
    },
    ingredientes: p.ingredientes || [],
    ingredientesEliminados: p.ingredientesEliminados || [],
    puntosDeCoccion: p.puntosDeCoccion || [],
    opcionesPersonalizables: p.opcionesPersonalizables || [],
    adicionales: p.adicionales || [],
    sabor: p.sabor || [],
    estado: p.estado || 'habilitado',
    estadoPreparacion: p.estadoPreparacion || 'pendiente',
    tipoPedido: p.tipoPedido || 'individual',
    tipoPlato: p.tipoPlato || 'individual',
    estacion: p.estacion || 'frito',
  };
};

// ====== Main ======
async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/tu_db';
  await mongoose.connect(uri);
  console.log('✅ Conectado a Mongo');

  for (const base of seedBase) {
    const doc = normalizeProducto(base);

    // Upsert por nombre (idempotente)
    const res = await Producto.updateOne(
      { nombre: doc.nombre },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    if (res.upsertedCount) {
      console.log(`🆕 Insertado: ${doc.nombre}`);
    } else {
      console.log(`♻️ Actualizado: ${doc.nombre}`);
    }
  }

  console.log('🏁 Seed de productos completado');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Error en seed:', e);
  process.exit(1);
});
