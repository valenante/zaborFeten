import fs from 'fs';
import Handlebars from 'handlebars';

// --- Leer argumentos ---
const [, , plantilla, payloadFile] = process.argv;

if (!plantilla || !payloadFile) {
  console.error("❌ Uso: node render.js <plantilla> <payload.json>");
  process.exit(1);
}

// --- Cargar JSON con datos ---
const data = JSON.parse(fs.readFileSync(payloadFile, 'utf-8'));

// --- Cargar plantilla correspondiente ---
const templatePath = `templates/${plantilla}.xml.hbs`;
if (!fs.existsSync(templatePath)) {
  console.error(`❌ No existe la plantilla: ${templatePath}`);
  process.exit(1);
}

const templateSrc = fs.readFileSync(templatePath, 'utf-8');
const template = Handlebars.compile(templateSrc);

// --- Renderizar XML ---
const xml = template(data);

// --- Guardar resultado ---
fs.writeFileSync('temp-out.xml', xml, 'utf-8');
console.log(`✅ temp-out.xml generado con plantilla '${plantilla}' y datos de '${payloadFile}'`);
