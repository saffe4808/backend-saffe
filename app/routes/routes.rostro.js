import { Router } from "express";
import {
    registrarRostro,
    verificarRostro
} from "../controllers/controller.rostro.js";
import {
    verificarAdministrador,
    verificarToken
} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/rostro/registrar", verificarToken, verificarAdministrador, registrarRostro);
router.post("/rostro/verificar", verificarRostro);

export default router;
