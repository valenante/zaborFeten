// routes/reportes.js
import express from "express";
import { getVentasHoy } from "../controllers/reportesController.js";

const router = express.Router();
router.get("/ventas-hoy", getVentasHoy);
export default router;
