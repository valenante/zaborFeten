export function mapFacturaToVerifactu(factura) {
  return {
    Cabecera: {
      IDVersionSIF: "1.0", // versión del sistema
      TipoComunicacion: factura.tipoComunicacion || "A0", // Alta por defecto
    },
    RegistroFacturaExpedida: {
      FacturaExpedida: {
        IDFactura: {
          NumSerieFacturaEmisor: factura.numeroFactura,
          FechaExpedicionFacturaEmisor: formatFecha(factura.fechaExpedicion),
        },
        Factura: {
          DescripcionFactura: factura.descripcionFactura || "Venta de productos",
          ImporteTotal: factura.importeTotal,
          DatosFactura: {
            BaseImponible: factura.baseImponible || null,
            TipoIVA: factura.tipoIVA || null,
            CuotaIVA: factura.importeIVA || null,
          }
        },
        Destinatario: factura.clienteNIF
          ? {
              NombreRazon: factura.clienteNombre || "Consumidor final",
              NIF: factura.clienteNIF,
            }
          : undefined,
        EncadenamientoFactura: {
          Hash: factura.hash,
          HashAnterior: factura.hashAnterior,
        },
        Firma: factura.firmaDigital || undefined,
      }
    }
  };
}

function formatFecha(date) {
  if (!date) return null;
  return new Date(date).toISOString().split("T")[0]; // yyyy-mm-dd
}
