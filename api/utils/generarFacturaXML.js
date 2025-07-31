// utils/generarFacturaXML.js
export const generarFacturaXML = (factura) => {
  const productosXML = factura.productos
    .map(
      (p) => `
    <Producto>
      <Nombre>${escapeXml(p.nombre)}</Nombre>
      <Cantidad>${p.cantidad}</Cantidad>
      <Precio>${p.precio.toFixed(2)}</Precio>
    </Producto>`
    )
    .join('');

  const softwareXML = `
  <Software>
    <Nombre>TPV Restaurantes</Nombre>
    <Version>1.0.0</Version>
    <Codigo>TPV ALEF-001</Codigo>
    <Fabricante>ALEF</Fabricante>
  </Software>`;

  // Eliminamos la etiqueta Firma para que no aparezca en el XML sin firmar
  // const firmaXML = `
  // <Firma>${factura.firmaDigital}</Firma>`;

  return `
<?xml version="1.0" encoding="UTF-8"?>
<Factura xmlns="http://www.facturae.gob.es/formato">
  <Cabecera>
    <Numero>${factura.numeroFactura}</Numero>
    <Fecha>${new Date(factura.fechaExpedicion).toISOString().slice(0, 10)}</Fecha>
    <ClienteNombre>${escapeXml(factura.clienteNombre)}</ClienteNombre>
    <ClienteNIF>${factura.clienteNIF}</ClienteNIF>
    <ImporteTotal>${factura.importeTotal.toFixed(2)}</ImporteTotal>
    <Hash>${factura.hash}</Hash>
  </Cabecera>
  <Productos>
    ${productosXML}
  </Productos>
  ${softwareXML}
</Factura>`.trim();
};

// Ayuda para evitar errores de codificación
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
