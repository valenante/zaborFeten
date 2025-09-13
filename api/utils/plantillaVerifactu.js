export function buildVerifactuXML({
  numeroFactura,
  fechaExpedicion,
  nombreEmisor,
  nifEmisor,
  clienteNombre,
  clienteNIF,
  productos,
  cuotaTotal,
  importeTotal,
  huellaAnterior,
  huellaNueva,
  fechaHoraRegistro
}) {
  console.log(productos);
  // Detalle de desglose de IVA
  const desglose = productos.map((p) => `
          <sum1:DetalleDesglose>
            <sum1:ClaveRegimen>01</sum1:ClaveRegimen>
            <sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion>
<sum1:TipoImpositivo>${parseInt(p.iva, 10)}</sum1:TipoImpositivo>
            <sum1:BaseImponibleOimporteNoSujeto>${(p.base ?? 0).toFixed(2)}</sum1:BaseImponibleOimporteNoSujeto>
            <sum1:CuotaRepercutida>${(p.cuota ?? 0).toFixed(2)}</sum1:CuotaRepercutida>
          </sum1:DetalleDesglose>
  `).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd"
  xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">

  <soapenv:Header/>
  <soapenv:Body>
    <sum:RegFactuSistemaFacturacion>

      <sum:Cabecera>
        <sum1:ObligadoEmision>
          <sum1:NombreRazon>${nombreEmisor}</sum1:NombreRazon>
          <sum1:NIF>${nifEmisor}</sum1:NIF>
        </sum1:ObligadoEmision>
      </sum:Cabecera>

      <sum:RegistroFactura>
        <sum1:RegistroAlta>
          <sum1:IDVersion>1.0</sum1:IDVersion>

          <sum1:IDFactura>
            <sum1:IDEmisorFactura>${nifEmisor}</sum1:IDEmisorFactura>
            <sum1:NumSerieFactura>${numeroFactura}</sum1:NumSerieFactura>
            <sum1:FechaExpedicionFactura>${fechaExpedicion}</sum1:FechaExpedicionFactura>
          </sum1:IDFactura>

          <sum1:NombreRazonEmisor>${nombreEmisor}</sum1:NombreRazonEmisor>
          <sum1:TipoFactura>F1</sum1:TipoFactura>
          <sum1:DescripcionOperacion>Factura de prueba VeriFactu</sum1:DescripcionOperacion>

          <sum1:Destinatarios>
            <sum1:IDDestinatario>
              <sum1:NombreRazon>${clienteNombre}</sum1:NombreRazon>
              <sum1:NIF>${clienteNIF}</sum1:NIF>
            </sum1:IDDestinatario>
          </sum1:Destinatarios>

          <sum1:Desglose>
            ${desglose}
          </sum1:Desglose>

         <sum1:CuotaTotal>${(cuotaTotal ?? 0).toFixed(2)}</sum1:CuotaTotal>
<sum1:ImporteTotal>${(importeTotal ?? 0).toFixed(2)}</sum1:ImporteTotal>

          <sum1:Encadenamiento>
            <sum1:RegistroAnterior>
              <sum1:IDEmisorFactura>${nifEmisor}</sum1:IDEmisorFactura>
              <sum1:NumSerieFactura>${numeroFactura - 1}</sum1:NumSerieFactura>
              <sum1:FechaExpedicionFactura>${fechaExpedicion}</sum1:FechaExpedicionFactura>
              <sum1:Huella>${huellaAnterior}</sum1:Huella>
            </sum1:RegistroAnterior>
          </sum1:Encadenamiento>

          <sum1:SistemaInformatico>
            <sum1:NombreRazon>${nombreEmisor}</sum1:NombreRazon>
            <sum1:NIF>${nifEmisor}</sum1:NIF>
            <sum1:NombreSistemaInformatico>TPV Restaurante</sum1:NombreSistemaInformatico>
            <sum1:IdSistemaInformatico>77</sum1:IdSistemaInformatico>
            <sum1:Version>1.0.3</sum1:Version>
            <sum1:NumeroInstalacion>383</sum1:NumeroInstalacion>
            <sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>
            <sum1:TipoUsoPosibleMultiOT>N</sum1:TipoUsoPosibleMultiOT>
            <sum1:IndicadorMultiplesOT>N</sum1:IndicadorMultiplesOT>
          </sum1:SistemaInformatico>

          <sum1:FechaHoraHusoGenRegistro>${fechaHoraRegistro}</sum1:FechaHoraHusoGenRegistro>
          <sum1:TipoHuella>01</sum1:TipoHuella>
          <sum1:Huella>${huellaNueva}</sum1:Huella>
        </sum1:RegistroAlta>
      </sum:RegistroFactura>
    </sum:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`;
}
