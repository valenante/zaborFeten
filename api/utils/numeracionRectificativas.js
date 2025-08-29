import registroVerifactus from '../src/models/RegistroVerifactu.js';

export async function generarNumeroFacturaRectificativa() {
  // Buscar la última factura rectificativa (que empiece con "R-" o tu prefijo)
  const ultimaRectificativa = await registroVerifactus.findOne({
    numeroFactura: { $regex: /^R-/ }
  }).sort({ createdAt: -1 }).lean();

  if (!ultimaRectificativa) {
    return 'R-2025-0001'; // O el formato que prefieras, incluyendo año
  }

  // Extraer la parte numérica, por ejemplo "R-2025-0005" -> 5
  const match = ultimaRectificativa.numeroFactura.match(/(\d+)$/);
  const ultimoNumero = match ? parseInt(match[1], 10) : 0;

  const nuevoNumero = (ultimoNumero + 1).toString().padStart(4, '0');

  return `R-2025-${nuevoNumero}`; // Aquí ajusta el prefijo y año si quieres
}
