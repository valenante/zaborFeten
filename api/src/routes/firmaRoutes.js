// src/routes/firmaRoutes.js

import express from 'express';
import multer from 'multer';
import { subirCertificado, descargarDeclaracionResponsable } from '../controllers/firmaController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Subida del certificado .p12 y contraseña
router.post('/subir-certificado', upload.single('archivo'), subirCertificado);

// Generación de la declaración responsable en PDF
router.get('/declaracion-responsable', descargarDeclaracionResponsable);

export default router;
