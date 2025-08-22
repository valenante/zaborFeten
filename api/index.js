import express from 'express';
import { config } from 'dotenv';
import compression from 'compression';
import logger from './utils/logger.js';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import redisClient from './config/redisClient.js';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import {
  corsOptions,
  sessionConfig,
  configureSocketIO,
  connectToDatabase,
  PORT,
} from './config/config.js'; // ✅ Importamos la configuración
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import {attachUser} from './src/middlewares/attachUser.js'; // Importar middleware para adjuntar usuario
import mesaRoutes from './src/routes/mesaRoutes.js';
import productoRoutes from './src/routes/productosRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import pedidosRoutes from './src/routes/pedidosRoutes.js';
import pedidoBebidasRoutes from './src/routes/pedidoBebidasRoutes.js';
import ventasRoutes from './src/routes/ventasRoutes.js';
import cartRoutes from './src/routes/cartRoutes.js';
import passwordRoutes from './src/routes/passwordRoutes.js';
import errorHandler from './src/middlewares/errorHandler.js';
import notFoundHandler from './src/middlewares/notFoundHandler.js';
import cajaRoutes from './src/routes/cajaRoutes.js';
import eliminacionRoutes from './src/routes/eliminacionRoutes.js';
import cajaDiariaRoutes from './src/routes/cajaDiariaRoutes.js';
import valoracionesRoutes from './src/routes/valoracionesRoutes.js';
import cuentaRoutes from './src/routes/cuentaRoutes.js';
import imagesRoutes from './src/routes/imagesRoutes.js';
import configuracionesReservasRoutes from './src/routes/configuracionesReservasRoutes.js'; // ✅ Importamos las rutas de configuraciones de reservas
import reservasRoutes from './src/routes/reservasRoutes.js'; // ✅ Importamos las rutas de reservas
import disponibilidadRoutes from './src/routes/disponibilidadRoutes.js'; // ✅ Importamos las rutas de disponibilidad
import facturasRoutes from './src/routes/facturasRoutes.js'; // ✅ Importamos las rutas de facturas
import imprimirRoutes from './src/routes/imprimirRoutes.js'; // ✅ Importamos las rutas de impresión
import configuracionRoutes from './src/routes/configuracionRoutes.js'; // Importar las rutas de configuración global
import extraRoutes from './src/routes/extraRoutes.js'; // Importar las rutas de extras
import firmaRoutes from './src/routes/firmaRoutes.js'; // Importar las rutas de firma digital
import reportesRoutes from './src/routes/reportesRoutes.js'
// Configurar dotenv
config();

// Inicializar Express y servidor HTTP
const app = express();
const server = createServer(app);

// Middleware de compresión HTTP
app.use(compression());

// Middleware para parsear JSON y formularios (PRIMERO)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy para manejar sesiones detrás de proxies (como Nginx)
app.set('trust proxy', 1);


// Cookies y sesión (DESPUÉS de parsear)
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(session(sessionConfig));

// Middleware de seguridad
app.use(helmet());

// Configurar Socket.IO
const io = configureSocketIO(server);

// Compartir instancia de Socket.IO con las rutas
app.use((req, res, next) => {
  req.io = io;
  next();
});

//Devolver imagenes
app.use(
  express.static('public', {
    maxAge: '30d', // Cachear por 30 días
    setHeaders: (res, path) => {
      if (
        path.endsWith('.jpg') ||
        path.endsWith('.jpeg') ||
        path.endsWith('.png') ||
        path.endsWith('.avif')
      ) {
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 días en segundos
      }
    },
  })
);

app.use(attachUser); // Intenta decodificar al usuario en TODAS las rutas, para logging

// Crear carpeta de logs si no existe
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Crear stream de escritura para access.log
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' } // 'a' = append, no sobrescribe
);

// Formato de log personalizado para incluir el usuario
morgan.token('user', (req) => {
  return req.user?.name || 'anónimo';
});

// Formato con timestamp + método + URL + status + usuario
const customFormat = (tokens, req, res) => {
  return [
    `[${new Date().toISOString()}]`,
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    '- user:',
    tokens.user(req, res),
  ].join(' ');
};

app.use(morgan(customFormat, { stream: accessLogStream }));

// En desarrollo, muestra también en consola
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan(customFormat));
}

// Registrar rutas
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/v1/productos', productoRoutes);
app.use('/api/v1/mesas', mesaRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pedidos', pedidosRoutes);
app.use('/api/v1/pedidosBebidas', pedidoBebidasRoutes);
app.use('/api/v1/ventas', ventasRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/password', passwordRoutes);
app.use('/api/v1/caja', cajaRoutes);
app.use('/api/v1/eliminaciones', eliminacionRoutes);
app.use('/api/v1/cajaDiaria', cajaDiariaRoutes);
app.use('/api/v1/valoraciones', valoracionesRoutes);
app.use('/api/v1/cuenta', cuentaRoutes);
app.use('/api/v1/images', imagesRoutes);
app.use('/api/v1/reservasConfiguracion', configuracionesReservasRoutes);
app.use('/api/v1/reservas', reservasRoutes);
app.use('/api/v1/facturas', facturasRoutes);
app.use('/api/v1/disponibilidad', disponibilidadRoutes);
app.use('/api/v1/imprimir', imprimirRoutes);
app.use('/api/v1/configuracion-global', configuracionRoutes);
app.use('/api/v1/extras', extraRoutes);
app.use('/api/v1/firma', firmaRoutes); // Rutas de firma digital
app.use('/api/v1/reportes', reportesRoutes);

// Middlewares de error
app.use(notFoundHandler);
app.use(errorHandler);

// Ruta principal
app.get('/', (req, res) => {
  logger.info('Se recibió una solicitud en la ruta raíz');
  res.send('¡Bienvenido a la API de LP!');
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error(`Excepción no capturada: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Promesa no manejada: ${reason}`);
  process.exit(1);
});

// Configurar eventos de Socket.IO
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`Cliente desconectado: ${socket.id}, motivo: ${reason}`);
  });
});

const iniciarServidor = async () => {
  try {
    await redisClient.connect();
    logger.info('✅ Redis conectado correctamente');

    connectToDatabase();

    server.listen(PORT, () => {
      logger.info(`Servidor escuchando en el puerto ${PORT}`);
    });

  } catch (err) {
  console.error('Error capturado al conectar Redis');

  try {
    console.log('typeof logger', typeof logger);
    console.log('logger', logger);
    logger.error('❌ No se pudo conectar a Redis:', err);
  } catch (loggerError) {
    console.error('FALLO AL USAR LOGGER:', loggerError);
    console.error('ERROR ORIGINAL:', err);
  }

  process.exit(1);
}
}
  iniciarServidor();

  export { io };
