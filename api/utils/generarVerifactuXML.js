import { buildVerifactuXML } from './plantillaVerifactu.js';

export async function generarVerifactuXML(datosFactura) {
  const {
    numeroFactura,
    fechaExpedicion,
    clienteNombre,
    clienteNIF,
    productos,
    importeTotal,
    hashFactura,
    hashAnterior,
    cuotaTotal
  } = datosFactura;

  console.log(clienteNombre, clienteNIF, 'en generarVerifactuXML');

  // 👇 Datos del emisor
  const nombreEmisor = process.env.EMPRESA_NOMBRE || "ANTENUCCI AGUILAR VALENTINO NAHUEL";
  const nifEmisor = process.env.EMPRESA_NIF || "X6063327K";

  // 👇 Preprocesar productos para asegurar iva, base y cuota
  const productosNormalizados = productos.map((p) => {
    const iva = p.iva ?? 10; // 10% por defecto en hostelería
    const bruto = p.precio * p.cantidad;
    const base = bruto / (1 + iva / 100);
    const cuota = bruto - base;

    return {
      ...p,
      iva,
      base: parseFloat(base.toFixed(2)),
      cuota: parseFloat(cuota.toFixed(2)),
      total: parseFloat(bruto.toFixed(2)),
    };
  });

  const fechaObj = new Date(fechaExpedicion);
  const fechaFormateada = fechaObj.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).replace(/\//g, "-");

  function getFechaHoraRegistro() {
    const now = new Date();
    // Formateamos YYYY-MM-DDTHH:MM:SS
    const fecha = now.toISOString().split(".")[0]; // quita milisegundos
    return fecha + "+02:00"; // 👈 añade offset
  }

  return buildVerifactuXML({
    numeroFactura,
    fechaExpedicion: fechaFormateada,
    nombreEmisor,
    nifEmisor,
    clienteNombre,
    clienteNIF,
    productos: productosNormalizados,
    importeTotal,
    huellaAnterior: hashAnterior,
    huellaNueva: hashFactura,
    fechaHoraRegistro: getFechaHoraRegistro(),
    cuotaTotal
  });
}

export default generarVerifactuXML;
