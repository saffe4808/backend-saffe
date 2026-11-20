import { Router } from "express";
import {
    listarUsuarios,
    crearUsuario,
    obtenerUsuario,
    actualizarUsuario,
    actualizarFotoUsuario,
    eliminarUsuario,
    obtenerPerfil
} from "../controllers/controller.usuario.js";
import {
    verificarAdministrador,
    verificarToken
} from "../middleware/auth.middleware.js";

const router = Router();

router.get("/perfil", verificarToken, obtenerPerfil);
router.get("/usuarios", verificarToken, verificarAdministrador, listarUsuarios);
router.post("/usuarios", verificarToken, verificarAdministrador, crearUsuario);
router.post("/registro", crearUsuario);
router.put("/usuarios/:documento/foto", verificarToken, verificarAdministrador, actualizarFotoUsuario);
router.get("/usuarios/:documento", verificarToken, obtenerUsuario);
router.put("/usuarios/:documento", verificarToken, verificarAdministrador, actualizarUsuario);
router.delete("/usuarios/:documento", verificarToken, verificarAdministrador, eliminarUsuario);

export default router;
