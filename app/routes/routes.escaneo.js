import { Router } from "express";
import { validarEscaneo } from "../controllers/controller.escaneo.js";

const router = Router();

router.post("/escaneo", validarEscaneo);

export default router;
