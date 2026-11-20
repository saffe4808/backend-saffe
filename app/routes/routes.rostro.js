import { Router } from "express";
import {
    registrarRostro,
    verificarRostro
} from "../controllers/controller.rostro.js";

const router = Router();

router.post("/rostro/registrar", registrarRostro);
router.post("/rostro/verificar", verificarRostro);

export default router;
