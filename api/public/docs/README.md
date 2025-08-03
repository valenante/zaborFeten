# TPV Base – Sistema de Punto de Venta para Restaurantes

Este repositorio contiene la versión predeterminada del software TPV desarrollado para restaurantes, bares y cafeterías. El sistema está listo para su despliegue, personalización e instalación en entornos reales, cumpliendo con todos los requisitos técnicos y legales, incluyendo la **Ley 11/2021 (Ley Antifraude)**.

## ✅ Funcionalidades principales

- Gestión de mesas: abrir, cerrar, transferir y editar pedidos.
- Gestión de productos y carta digital.
- Flujos separados para cocina, barra y caja.
- Panel de administración para modificar estilos, productos y configuración general.
- Impresión automática de pedidos y facturas.
- Sistema de reservas con confirmación manual o automática.
- Firma digital y generación de hash encadenado para cada factura.
- Compatible con la futura conexión a **VERI*FACTU**.
- Sistema de facturación nominativa y encadenada conforme a normativa.

## ⚖️ Cumplimiento Legal

Este software ha sido desarrollado conforme a los principios exigidos por la **Ley 11/2021**:

- 📌 Inalterabilidad de los registros.
- 📌 Firma digital hash encadenada por cada emisión de factura.
- 📌 Registro de todos los eventos relevantes (anulación, corrección, etc.).
- 📌 Preparado para conexión con la API de **VERI*FACTU**.

📄 Si necesitas el **documento de declaración de cumplimiento**, se encuentra en la carpeta `/docs/declaracion_legal.pdf`.

## 🛠️ Tecnologías utilizadas

- **Frontend:** React.js
- **Backend:** Node.js + Express
- **Base de datos:** MongoDB Atlas
- **Comunicación en tiempo real:** Socket.IO
- **Impresión:** Microservicio Express con ESC/POS o `lp` para impresión térmica
- **Seguridad:** JWT + Cookies seguras + CORS controlado

## 🚀 Instalación rápida

1. Clonar el repositorio:

```bash
git clone https://github.com/valenante/base.git
cd base
