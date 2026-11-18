import { Router } from "express";

import { login } from "../controllers/controller.auth.js";
import {
    enviarCodigoRecuperacion,
    restablecerContrasena,
    verificarCodigoRecuperacion
} from "../controllers/controller.recuperacion.js";

const router = Router();

// Ruta para iniciar sesión
router.post("/login", login);

// Rutas de recuperación de contraseña (Endpoints estándar solicitados)
router.post("/forgot-password", enviarCodigoRecuperacion);
router.post("/reset-password", restablecerContrasena);

// Rutas de recuperación (compatibilidad con vistas existentes)
router.post("/recuperacion/codigo", enviarCodigoRecuperacion);
router.post("/recuperacion/verificar", verificarCodigoRecuperacion);
router.post("/recuperacion/restablecer", restablecerContrasena);

export default router;
