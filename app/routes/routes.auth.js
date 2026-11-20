import { Router } from "express";

import { login, loginFacial, registrarRostro } from "../controllers/controller.auth.js";
import {
    enviarCodigoRecuperacion,
    restablecerContrasena,
    verificarCodigoRecuperacion
} from "../controllers/controller.recuperacion.js";
import {
    verificarAdministrador,
    verificarToken
} from "../middleware/auth.middleware.js";

const router = Router();

// Rutas de inicio de sesión
router.post("/login", login);
router.post("/login-facial", loginFacial);
router.post("/usuarios/rostro", verificarToken, verificarAdministrador, registrarRostro);

// Rutas de recuperación de contraseña (Endpoints estándar solicitados)
router.post("/forgot-password", enviarCodigoRecuperacion);
router.post("/reset-password", restablecerContrasena);

// Rutas de recuperación (compatibilidad con vistas existentes)
router.post("/recuperacion/codigo", enviarCodigoRecuperacion);
router.post("/recuperacion/verificar", verificarCodigoRecuperacion);
router.post("/recuperacion/restablecer", restablecerContrasena);

export default router;
