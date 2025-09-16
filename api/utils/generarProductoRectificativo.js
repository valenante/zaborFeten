/**
 * Genera un producto genérico para facturas rectificativas.
 * @param {number} importeTotal - Importe total con IVA incluido
 * @param {number} iva - Tipo de IVA (ej: 10 o 21)
 * @param {string} descripcion - Texto descriptivo opcional
 * @returns {Array} - Array con un producto válido para el XML
 */
export function generarProductoRectificativo(importeTotal, iva = 21, descripcion = "Rectificación factura") {
  if (!importeTotal || isNaN(importeTotal)) {
    throw new Error("Debe indicar un importeTotal válido");
  }

  const base = +(importeTotal / (1 + iva / 100)).toFixed(2);
  const cuota = +(importeTotal - base).toFixed(2);

  return [
    {
      nombre: descripcion,
      cantidad: 1,
      precio: base,
      iva,
      base,
      cuota
    }
  ];
}
