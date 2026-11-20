import { Router } from "express";
import {
    obtenerHistorial,
    registrarAcceso
} from "../controllers/controller.historial.js";
import {
    verificarAdministrador,
    verificarToken
} from "../middleware/auth.middleware.js";

const router = Router();

// Ruta para consultar la lista de accesos en la tabla
router.get(
    "/historial",
    verificarToken,
    obtenerHistorial
);

// Ruta para registrar un nuevo acceso desde el escáner facial
router.post(
    "/historial",
    verificarToken,
    verificarAdministrador,
    registrarAcceso
);

export default router;