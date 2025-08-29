import mongoose from 'mongoose';
import SifConfig from '../src/models/SifConfig.js';
import ObligadoTributario from '../src/models/ObligadoTributario.js';
import dotenv from 'dotenv';
dotenv.config();

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/tu_db';

await mongoose.connect(MONGO);

await SifConfig.deleteMany({});
await ObligadoTributario.deleteMany({});

await SifConfig.create({
  productor: {
    nombreRazon: 'Tu Empresa Productora SL',
    nif: 'B12345678',
  },
  nombreSistemaInformatico: 'TuSIF-TPV',
  idSistemaInformatico: 'TS',     // tu código corto
  version: '1.0.0',
  numeroInstalacion: 'TS-001',
  tipoUsoPosibleSoloVerifactu: 'N',
  tipoUsoPosibleMultiOT: 'N',
  multiplesOTActivos: false,
});

await ObligadoTributario.create({
  nombreRazon: 'Restaurante Demo SL',
  nif: 'B00000000',
  direccionPostal: 'C/ Ejemplo, 1, Madrid',
  activo: true,
});

console.log('Seed OK');
await mongoose.disconnect();
process.exit(0);
