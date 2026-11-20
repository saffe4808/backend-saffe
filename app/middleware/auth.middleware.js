import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/auth.js";
import conexion from "../config/database.js";

export const verificarToken = async (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            mensaje: "Acceso denegado. Token no proporcionado."
        });
    }

    const token = authorization.slice("Bearer ".length).trim();
    let payload;

    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ mensaje: "Token inválido" });
    }

    try {
        const [usuarios] = await conexion.query(
            "SELECT documento, rol FROM personal_militar WHERE documento = ? LIMIT 1",
            [payload.documento]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: "La cuenta asociada al token ya no existe." });
        }

        req.usuario = { ...payload, rol: usuarios[0].rol };
        return next();
    } catch (error) {
        console.error("Error al verificar el usuario autenticado:", error);
        return res.status(500).json({ mensaje: "No se pudo verificar la sesión." });
    }
};

export const verificarAdministrador = (req, res, next) => {
    if (req.usuario?.rol !== "admin") {
        return res.status(403).json({
            mensaje: "Acceso denegado. Se requiere el rol de administrador."
        });
    }

    return next();
};
