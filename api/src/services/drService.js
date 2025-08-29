// services/drService.js
import dayjs from 'dayjs';

export function buildDeclaracionResponsable({ sif, productor, otActivos = [], versionSif }) {
  // Campos exigidos art. 15.1 (a–l) + recomendados 15.2
  const ahora = dayjs().format('DD-MM-YYYY');

  // Datos de productor
  const prodTxt = productor?.nif
    ? `NIF: ${productor.nif}`
    : productor?.idOtro
      ? `ID (${productor.idOtro.idType} - ${productor.idOtro.codigoPais}): ${productor.idOtro.id}`
      : '';

  // Si hay multi‑OT, listamos los OT
  const multiTxt = otActivos.length > 1 ? 'S' : 'N';

  return `
<h1>DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN</h1>

<p><strong>a)</strong> Nombre del sistema: <u>${sif.nombreSistemaInformatico}</u></p>
<p><strong>b)</strong> Código identificador del sistema (IdSistemaInformatico): <u>${sif.idSistemaInformatico}</u></p>
<p><strong>c)</strong> Versión: <u>${sif.version}</u></p>
<p><strong>d)</strong> Descripción breve: Sistema de facturación para TPV/Restaurante con emisión de registros de facturación conforme al RD 1007/2023 y Orden HAC/1177/2024.</p>
<p><strong>e)</strong> Funcionamiento solo VERI*FACTU: <u>${sif.tipoUsoPosibleSoloVerifactu}</u></p>
<p><strong>f)</strong> Multi‑obligado (permite varios OT): <u>${sif.tipoUsoPosibleMultiOT}</u>. Indicador de múltiples OT presentes: <u>${multiTxt}</u></p>
<p><strong>g)</strong> Tipos de firma empleados cuando NO VERI*FACTU: <u>XAdES Enveloped</u></p>
<p><strong>h)</strong> Productor (nombre/razón social): <u>${productor?.nombreRazon || ''}</u></p>
<p><strong>i)</strong> Identificación productor: <u>${prodTxt}</u></p>
<p><strong>j)</strong> Dirección de contacto productor: <u>(rellenar)</u></p>
<p><strong>k)</strong> Manifestación de cumplimiento: El productor declara que el SIF cumple con el art. 29.2.j) LGT, RD 1007/2023, Orden HAC/1177/2024 y detalles técnicos publicados por la AEAT.</p>
<p><strong>l)</strong> Lugar y fecha: <u>(Ciudad, País)</u>, <u>${ahora}</u></p>

<hr/>
<h2>Anexo recomendado</h2>
<p>• Contactos adicionales: (email/soporte)</p>
<p>• Sitio web del productor: (URL)</p>
<p>• Explicación técnica del cumplimiento (hash SHA‑256, encadenamiento, firma XAdES, conservación, exportación, registro de eventos, etc.)</p>

${
  otActivos.length
    ? `<h3>Obligados tributarios gestionados</h3><ul>${otActivos.map(o=>`<li>${o.nombreRazon} — ${o.nif}</li>`).join('')}</ul>`
    : ''
}
`;
}
