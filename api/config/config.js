// config/config.js
import { Server } from 'socket.io';
import { config } from 'dotenv';
import { connect } from 'mongoose';
import logger from '../utils/logger.js';
import MongoStore from 'connect-mongo';
import dotenv from "dotenv";

dotenv.config();

// Configuración de CORS
export const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://valenante.info',
    'http://192.168.1.150:3000',
    'http://192.168.1.150:3001',
    "http://192.168.1.150:3002",
    "http://192.168.1.143:3000",
    "http://192.168.1.143:3001",
    "http://192.168.1.143:3002",

    // Otros dominios permitidos (IPs locales si las usás en desarrollo)
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Cart-ID', 'x-token-lider'],
  credentials: true,
};

// Configuración de la sesión
export const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true, // Solo true en producción
    sameSite: 'Lax' ? 'None' : 'Lax',
    maxAge: 5 * 60 * 60 * 1000, // ⏱️ 5 horas en milisegundos
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 5 * 60 * 60, // 🧠 5 horas en segundos
  }),
};

// Socket.IO
export const configureSocketIO = (server) => {
  return new Server(server, {
    cors: corsOptions,
  });
};

// MongoDB
const MONGO_URI = process.env.MONGO_URI;

export const connectToDatabase = async () => {
  try {
    await connect(MONGO_URI, {
      useNewUrlParser: true,
    });
    logger.info('✅ Conectado a MongoDB');
  } catch (error) {
    logger.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
};

// Puerto
export const PORT = process.env.PORT || 3000;
