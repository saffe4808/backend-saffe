import { Router } from "express";

import {

    registrarAcceso,
    listarAccesos,
    obtenerAcceso,
    actualizarEstadoAcceso

} from "../controllers/controller.acceso.js";

import {
    verificarAdministrador,
    verificarToken
} from "../middleware/auth.middleware.js";

const router = Router();

// Registrar acceso
router.post("/accesos", verificarToken, registrarAcceso);

// Listar accesos
router.get("/accesos", verificarToken, verificarAdministrador, listarAccesos);

// Buscar acceso
router.get("/accesos/:id", verificarToken, verificarAdministrador, obtenerAcceso);

// Actualizar estado del acceso
router.put("/accesos/:id/estado", verificarToken, verificarAdministrador, actualizarEstadoAcceso);

export default router;