export function buildVerifactuXML({
  tipo = "alta",
  numeroFactura,
  fechaExpedicion,
  nombreEmisor,
  nifEmisor,
  clienteNombre,
  clienteNIF,
  productos = [],
  cuotaTotal,
  importeTotal,
  huellaAnterior,
  huellaNueva,
  numFacturaAnterior,
  fechaFacturaAnterior,
  fechaHoraRegistro,
  tipoEvento,
  tipoFactura,
  tipoRectificativa,
  subsanacion = false,
  descripcionOperacion = "Factura de prueba VeriFactu",
  sistema = {
    nombreSistema: "TPV ALEF",
    idSistema: "77",
    version: "1.0.3",
    numeroInstalacion: "383",
    soloVerifactu: "S",
    multiOT: "N",
    multiplesOT: "N",
  },
}) {
  const tf = tipoFactura || "";

  // ------- BLOQUE DESGLOSE -------
  let desglose = "";
  if (tipo === "alta") {
    const agrupados = {};
    productos.forEach((p) => {
      const key = `${p.iva}-01-S1`;
      if (!agrupados[key]) {
        agrupados[key] = {
          impuesto: "01", // IVA por defecto
          iva: parseInt(p.iva, 10),
          clave: "01",
          calificacion: "S1",
          base: 0,
          cuota: 0,
        };
      }
      agrupados[key].base += p.base ?? 0;
      agrupados[key].cuota += p.cuota ?? 0;
    });

    desglose = Object.values(agrupados)
      .map((g) => {
        const baseTag = `<sum1:BaseImponibleOimporteNoSujeto>${g.base.toFixed(2)}</sum1:BaseImponibleOimporteNoSujeto>`;

        return `
      <sum1:DetalleDesglose>
        <sum1:Impuesto>${g.impuesto}</sum1:Impuesto>
        <sum1:ClaveRegimen>${g.clave}</sum1:ClaveRegimen>
        <sum1:CalificacionOperacion>${g.calificacion}</sum1:CalificacionOperacion>
        <sum1:TipoImpositivo>${g.iva}</sum1:TipoImpositivo>
        ${baseTag}
        <sum1:CuotaRepercutida>${g.cuota.toFixed(2)}</sum1:CuotaRepercutida>
      </sum1:DetalleDesglose>`;
      })
      .join("");
  }

  // ------- BLOQUE ENCADENAMIENTO -------
  const encadenamiento = `
  <sum1:Encadenamiento>
    <sum1:RegistroAnterior>
      <sum1:IDEmisorFactura>${nifEmisor}</sum1:IDEmisorFactura>
      <sum1:NumSerieFactura>${numFacturaAnterior || "0"}</sum1:NumSerieFactura>
      <sum1:FechaExpedicionFactura>${fechaFacturaAnterior || "01-01-1900"}</sum1:FechaExpedicionFactura>
      <sum1:Huella>${huellaAnterior || "0000000000000000000000000000000000000000000000000000000000000000"}</sum1:Huella>
    </sum1:RegistroAnterior>
  </sum1:Encadenamiento>`;

  // ------- BLOQUE DESTINATARIOS -------
  let destinatarios = "";
  if (["F1", "F3", "R1", "R2", "R3", "R4"].includes(tipoFactura)) {
    destinatarios = `
    <sum1:Destinatarios>
      <sum1:IDDestinatario>
        <sum1:NombreRazon>${clienteNombre?.trim() || "Consumidor final"}</sum1:NombreRazon>
        ${clienteNIF && clienteNIF.trim() !== ""
        ? `<sum1:NIF>${clienteNIF}</sum1:NIF>`
        : `
        <sum1:IDOtro>
          <sum1:CodigoPais>ES</sum1:CodigoPais>
          <sum1:IDType>07</sum1:IDType>
          <sum1:ID>CF</sum1:ID>
        </sum1:IDOtro>`
      }
      </sum1:IDDestinatario>
    </sum1:Destinatarios>`;
  } else if (["F2", "R5"].includes(tipoFactura)) {
    destinatarios = `<sum1:FacturaSinIdentifDestinatarioArt61d>S</sum1:FacturaSinIdentifDestinatarioArt61d>`;
  }

  let registro = "";

  // -------- ALTA / RECTIFICATIVA --------
  if (tipo === "alta") {
    const baseRectificada = productos.reduce((acc, p) => acc + (p.base ?? 0), 0);
    const cuotaRectificada = productos.reduce((acc, p) => acc + (p.cuota ?? 0), 0);

    // 🔑 Facturas rectificativas: añadir bloques obligatorios
    // 🔑 Facturas rectificativas: añadir bloques obligatorios
    let facturasRectificadas = "";
    let importeRectificacion = "";
    if (tf.startsWith("R")) {
      facturasRectificadas = `
  <sum1:FacturasRectificadas>
    <sum1:IDFacturaRectificada>
      <sum1:IDEmisorFactura>${nifEmisor}</sum1:IDEmisorFactura>
      <sum1:NumSerieFactura>${numFacturaAnterior || "0"}</sum1:NumSerieFactura>
      <sum1:FechaExpedicionFactura>${fechaFacturaAnterior || "01-01-1900"}</sum1:FechaExpedicionFactura>
    </sum1:IDFacturaRectificada>
  </sum1:FacturasRectificadas>`;

      if (tipoRectificativa === "S") {
        // Obligatorio en sustitución
        importeRectificacion = `
    <sum1:ImporteRectificacion>
      <sum1:BaseRectificada>${baseRectificada.toFixed(2)}</sum1:BaseRectificada>
      <sum1:CuotaRectificada>${cuotaRectificada.toFixed(2)}</sum1:CuotaRectificada>
    </sum1:ImporteRectificacion>`;
      }
      // 👉 En diferencias (I) no se añade nada
    }
    registro = `
    <sum:RegistroFactura>
      <sum1:RegistroAlta>
        <sum1:IDVersion>1.0</sum1:IDVersion>
        <sum1:IDFactura>
          <sum1:IDEmisorFactura>${nifEmisor}</sum1:IDEmisorFactura>
          <sum1:NumSerieFactura>${numeroFactura}</sum1:NumSerieFactura>
          <sum1:FechaExpedicionFactura>${fechaExpedicion}</sum1:FechaExpedicionFactura>
        </sum1:IDFactura>
        <sum1:NombreRazonEmisor>${nombreEmisor}</sum1:NombreRazonEmisor>
        ${subsanacion ? `<sum1:Subsanacion>S</sum1:Subsanacion>` : ""}
        <sum1:TipoFactura>${tipoFactura}</sum1:TipoFactura>
        ${tf.startsWith("R") ? `<sum1:TipoRectificativa>${tipoRectificativa || "S"}</sum1:TipoRectificativa>` : ""}
        ${facturasRectificadas}        
        ${importeRectificacion}        
        <sum1:DescripcionOperacion>${descripcionOperacion}</sum1:DescripcionOperacion>
        ${destinatarios}
        <sum1:Desglose>${desglose}</sum1:Desglose>
        <sum1:CuotaTotal>${tf.startsWith("R") ? cuotaRectificada.toFixed(2) : (cuotaTotal ?? 0).toFixed(2)}</sum1:CuotaTotal>
        <sum1:ImporteTotal>${(importeTotal ?? 0).toFixed(2)}</sum1:ImporteTotal>
        ${encadenamiento}
        ${sistemaBlock(nombreEmisor, nifEmisor, sistema)}
        <sum1:FechaHoraHusoGenRegistro>${fechaHoraRegistro}</sum1:FechaHoraHusoGenRegistro>
        <sum1:TipoHuella>01</sum1:TipoHuella>
        <sum1:Huella>${huellaNueva}</sum1:Huella>
      </sum1:RegistroAlta>
    </sum:RegistroFactura>`;
  }

  // -------- ANULACIÓN --------
  if (tipo === "anulacion") {
    registro = `
      <sum:RegistroFactura>
        <sum1:RegistroAnulacion>
          <sum1:IDVersion>1.0</sum1:IDVersion>
          <sum1:IDFactura>
            <sum1:IDEmisorFacturaAnulada>${nifEmisor}</sum1:IDEmisorFacturaAnulada>
            <sum1:NumSerieFacturaAnulada>${numeroFactura}</sum1:NumSerieFacturaAnulada>
            <sum1:FechaExpedicionFacturaAnulada>${fechaExpedicion}</sum1:FechaExpedicionFacturaAnulada>
          </sum1:IDFactura>
          ${encadenamiento}
          ${sistemaBlock(nombreEmisor, nifEmisor, sistema)}
          <sum1:FechaHoraHusoGenRegistro>${fechaHoraRegistro}</sum1:FechaHoraHusoGenRegistro>
          <sum1:TipoHuella>01</sum1:TipoHuella>
          <sum1:Huella>${huellaNueva}</sum1:Huella>
        </sum1:RegistroAnulacion>
      </sum:RegistroFactura>`;
  }

  // -------- EVENTO --------
  if (tipo === "evento") {
    registro = `
      <sum:RegistroEvento>
        <sum1:Evento>
          <sum1:SistemaInformatico>
            <sum1:NIF>${nifEmisor}</sum1:NIF>
            <sum1:IdSistemaInformatico>${sistema.idSistema}</sum1:IdSistemaInformatico>
            <sum1:Version>${sistema.version}</sum1:Version>
            <sum1:NumeroInstalacion>${sistema.numeroInstalacion}</sum1:NumeroInstalacion>
          </sum1:SistemaInformatico>
          <sum1:ObligadoEmision>
            <sum1:NIF>${nifEmisor}</sum1:NIF>
          </sum1:ObligadoEmision>
          <sum1:TipoEvento>${tipoEvento}</sum1:TipoEvento>
          <sum1:Encadenamiento>
            <sum1:EventoAnterior>
              <sum1:HuellaEvento>${huellaAnterior || ""}</sum1:HuellaEvento>
            </sum1:EventoAnterior>
          </sum1:Encadenamiento>
          <sum1:FechaHoraHusoGenEvento>${fechaHoraRegistro}</sum1:FechaHoraHusoGenEvento>
          <sum1:TipoHuella>01</sum1:TipoHuella>
          <sum1:HuellaEvento>${huellaNueva}</sum1:HuellaEvento>
        </sum1:Evento>
      </sum:RegistroEvento>`;
  }

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
      ${registro}
    </sum:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function sistemaBlock(nombreEmisor, nifEmisor, sistema) {
  return `
    <sum1:SistemaInformatico>
      <sum1:NombreRazon>${nombreEmisor}</sum1:NombreRazon>
      <sum1:NIF>${nifEmisor}</sum1:NIF>
      <sum1:NombreSistemaInformatico>${sistema.nombreSistema}</sum1:NombreSistemaInformatico>
      <sum1:IdSistemaInformatico>${sistema.idSistema}</sum1:IdSistemaInformatico>
      <sum1:Version>${sistema.version}</sum1:Version>
      <sum1:NumeroInstalacion>${sistema.numeroInstalacion}</sum1:NumeroInstalacion>
      <sum1:TipoUsoPosibleSoloVerifactu>${sistema.soloVerifactu}</sum1:TipoUsoPosibleSoloVerifactu>
      <sum1:TipoUsoPosibleMultiOT>${sistema.multiOT}</sum1:TipoUsoPosibleMultiOT>
      <sum1:IndicadorMultiplesOT>${sistema.multiplesOT}</sum1:IndicadorMultiplesOT>
    </sum1:SistemaInformatico>`;
}
