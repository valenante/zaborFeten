export function buildVerifactuXML({ numeroFactura, fecha, nombreCliente, nifCliente, productos, total, huella }) {
  const lineas = productos.map((p, i) => `
      <sf:DetalleLinea>
        <sf:Descripcion>${p.nombre}</sf:Descripcion>
        <sf:Cantidad>${p.cantidad}</sf:Cantidad>
        <sf:ImporteUnitario>${p.precio.toFixed(2)}</sf:ImporteUnitario>
        <sf:ImporteTotal>${(p.cantidad * p.precio).toFixed(2)}</sf:ImporteTotal>
      </sf:DetalleLinea>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
  <sf:SuministroLRFacturasEmitidas xmlns:sf="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/tic/sede/verifactu/ws/ws-verifactu-v1.xsd">
    <sf:Cabecera>
      <sf:IDVersionSii>1.1</sf:IDVersionSii>
      <sf:Titular>
        <sf:NombreRazon>Nombre del Emisor</sf:NombreRazon>
        <sf:NIF>12345678Z</sf:NIF>
      </sf:Titular>
    </sf:Cabecera>
    <sf:RegistroLRFacturasEmitidas>
      <sf:PeriodoLiquidacion>
        <sf:Ejercicio>${fecha.slice(0, 4)}</sf:Ejercicio>
        <sf:Periodo>${fecha.slice(5, 7)}</sf:Periodo>
      </sf:PeriodoLiquidacion>
      <sf:IDFactura>
        <sf:NumSerieFacturaEmisor>${numeroFactura}</sf:NumSerieFacturaEmisor>
        <sf:FechaExpedicionFacturaEmisor>${fecha}</sf:FechaExpedicionFacturaEmisor>
      </sf:IDFactura>
      <sf:FacturaExpedida>
        <sf:DescripcionFactura>Factura electrónica TPV</sf:DescripcionFactura>
        <sf:Destinatarios>
          <sf:IDDestinatario>
            <sf:NombreRazon>${nombreCliente}</sf:NombreRazon>
            <sf:NIF>${nifCliente}</sf:NIF>
          </sf:IDDestinatario>
        </sf:Destinatarios>
        <sf:ImporteTotal>${total.toFixed(2)}</sf:ImporteTotal>
        <sf:DetallesFactura>${lineas}</sf:DetallesFactura>
        <sf:Huella>${huella}</sf:Huella>
      </sf:FacturaExpedida>
    </sf:RegistroLRFacturasEmitidas>
  </sf:SuministroLRFacturasEmitidas>`;
}
