// routes/remisionRoutes.js
import { Router } from 'express';
import { remitirRegistros } from '../controllers/remisionController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/verifactu/remision', authMiddleware, remitirRegistros);

export default router;
