import {
    createHash,
    createHmac,
    randomBytes,
    randomInt,
    timingSafeEqual
} from "node:crypto";
import conexion from "../config/database.js";
import { JWT_SECRET } from "../config/auth.js";
import { enviarCodigoResend } from "../services/resend.service.js";
import bcrypt from "bcryptjs";

// Tiempo de expiración del código OTP: 15 minutos
const DURACION_CODIGO_MS = 15 * 60 * 1000;
const INTERVALO_REENVIO_MS = 60 * 1000;
const MAX_INTENTOS = 5;

const hashCodigo = (codigo) =>
    createHmac("sha256", JWT_SECRET).update(codigo).digest("hex");

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const coincideHash = (actual, esperado) => {
    if (!actual || !esperado) return false;
    const hashActual = Buffer.from(actual, "hex");
    const hashEsperado = Buffer.from(esperado, "hex");
    return hashActual.length === hashEsperado.length &&
        timingSafeEqual(hashActual, hashEsperado);
};

const MENSAJE_GENERICO =
    "Si los datos corresponden a un usuario registrado, hemos enviado un código de recuperación a su correo.";

/**
 * Endpoint 1: Solicitar código de recuperación (POST /forgot-password o POST /recuperacion/codigo)
 * Acepta email o documento en el cuerpo de la petición
 */
export const enviarCodigoRecuperacion = async (req, res) => {
    try {
        const identificador = (
            req.body.email ||
            req.body.correo ||
            req.body.documento ||
            ""
        ).toString().trim();

        if (!identificador || identificador.length > 255) {
            return res.status(400).json({ mensaje: "Ingresa un correo o documento válido." });
        }

        // Buscar usuario por correo o documento
        const [usuarios] = await conexion.query(
            "SELECT documento, correo, nombre FROM personal_militar WHERE documento = ? OR correo = ? LIMIT 1",
            [identificador, identificador]
        );

        // Si no existe el usuario o no tiene correo asociado, retornamos respuesta genérica por seguridad
        if (usuarios.length === 0 || !usuarios[0].correo) {
            return res.json({ mensaje: MENSAJE_GENERICO });
        }

        const usuario = usuarios[0];
        const ahora = Date.now();

        // Verificar límite de tasa de reenvío (1 minuto entre solicitudes)
        const [solicitudes] = await conexion.query(
            "SELECT creado_en FROM saffe_codigos_recuperacion WHERE documento = ?",
            [usuario.documento]
        );

        if (
            solicitudes.length > 0 &&
            ahora - Number(solicitudes[0].creado_en) < INTERVALO_REENVIO_MS
        ) {
            return res.json({ mensaje: MENSAJE_GENERICO });
        }

        // Generar código OTP numérico seguro de 6 dígitos
        const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
        const expiraEn = ahora + DURACION_CODIGO_MS;

        // Guardar código hasheado con expiración de 15 minutos y marcar como no usado (usado = 0)
        await conexion.query(
            `INSERT INTO saffe_codigos_recuperacion
                (documento, correo, codigo_hash, token_hash, expira_en, creado_en, intentos, usado)
             VALUES (?, ?, ?, NULL, ?, ?, 0, 0)
             ON DUPLICATE KEY UPDATE
                correo = VALUES(correo),
                codigo_hash = VALUES(codigo_hash),
                token_hash = NULL,
                expira_en = VALUES(expira_en),
                creado_en = VALUES(creado_en),
                intentos = 0,
                usado = 0`,
            [usuario.documento, usuario.correo, hashCodigo(codigo), expiraEn, ahora]
        );

        try {
            // Enviar correo a través de la API REST de Resend
            await enviarCodigoResend({
                email: usuario.correo,
                codigo,
                nombre: usuario.nombre
            });
        } catch (error) {
            // Si falla el envío de Resend, eliminamos el código recién creado para permitir un nuevo intento limpio
            await conexion.query(
                "DELETE FROM saffe_codigos_recuperacion WHERE documento = ?",
                [usuario.documento]
            );

            console.error("Error al enviar correo con Resend:", error.message);
            return res.status(503).json({
                mensaje: `Error en el servicio de correo: ${error.message}`
            });
        }

        return res.json({ mensaje: MENSAJE_GENERICO });
    } catch (error) {
        console.error("Error general en enviarCodigoRecuperacion:", error);
        return res.status(500).json({
            mensaje: "No se pudo procesar la solicitud de recuperación. Inténtalo más tarde."
        });
    }
};

/**
 * Endpoint de verificación intermedia (POST /recuperacion/verificar)
 */
export const verificarCodigoRecuperacion = async (req, res) => {
    try {
        const identificador = (
            req.body.email ||
            req.body.correo ||
            req.body.documento ||
            ""
        ).toString().trim();

        const codigo = (req.body.code || req.body.codigo || "").toString().trim();

        if (!identificador || !/^\d{6}$/.test(codigo)) {
            return res.status(400).json({ mensaje: "Identificador o código no válido." });
        }

        const [usuarios] = await conexion.query(
            "SELECT documento FROM personal_militar WHERE documento = ? OR correo = ? LIMIT 1",
            [identificador, identificador]
        );

        if (usuarios.length === 0) {
            return res.status(400).json({ mensaje: "El código es inválido o venció." });
        }

        const documento = usuarios[0].documento;

        const [solicitudes] = await conexion.query(
            `SELECT codigo_hash, expira_en, intentos, usado
             FROM saffe_codigos_recuperacion
             WHERE documento = ?`,
            [documento]
        );

        if (solicitudes.length === 0) {
            return res.status(400).json({ mensaje: "El código es inválido o venció." });
        }

        const solicitud = solicitudes[0];

        if (solicitud.usado === 1 || Number(solicitud.expira_en) <= Date.now()) {
            await conexion.query(
                "DELETE FROM saffe_codigos_recuperacion WHERE documento = ?",
                [documento]
            );
            return res.status(400).json({ mensaje: "El código es inválido o venció." });
        }

        if (Number(solicitud.intentos) >= MAX_INTENTOS) {
            return res.status(429).json({
                mensaje: "Se superó el número de intentos. Solicita un código nuevo."
            });
        }

        if (!coincideHash(hashCodigo(codigo), solicitud.codigo_hash)) {
            await conexion.query(
                `UPDATE saffe_codigos_recuperacion
                 SET intentos = intentos + 1
                 WHERE documento = ?`,
                [documento]
            );
            return res.status(400).json({ mensaje: "El código es inválido o venció." });
        }

        const token = randomBytes(32).toString("hex");
        await conexion.query(
            `UPDATE saffe_codigos_recuperacion
             SET token_hash = ?, intentos = 0
             WHERE documento = ?`,
            [hashToken(token), documento]
        );

        return res.json({ mensaje: "Código confirmado.", token });
    } catch (error) {
        console.error("Error al verificar código de recuperación:", error);
        return res.status(500).json({
            mensaje: "No se pudo verificar el código. Inténtalo de nuevo más tarde."
        });
    }
};

/**
 * Endpoint 2: Restablecer contraseña (POST /reset-password o POST /recuperacion/restablecer)
 * Acepta:
 * - email / documento
 * - code (OTP de 6 dígitos) O token (de verificación previa)
 * - new_password / contrasena
 */
export const restablecerContrasena = async (req, res) => {
    const identificador = (
        req.body.email ||
        req.body.correo ||
        req.body.documento ||
        ""
    ).toString().trim();

    const codigo = (req.body.code || req.body.codigo || "").toString().trim();
    const token = (req.body.token || "").toString().trim();
    const contrasena = (
        req.body.new_password ||
        req.body.contrasena ||
        req.body.nuevaContrasena ||
        ""
    ).toString();

    if (!identificador) {
        return res.status(400).json({ mensaje: "El correo o documento es obligatorio." });
    }

    if (!codigo && !token) {
        return res.status(400).json({ mensaje: "Se requiere el código OTP de 6 dígitos o token de autorización." });
    }

    if (
        contrasena.length < 8 ||
        Buffer.byteLength(contrasena, "utf8") > 72
    ) {
        return res.status(400).json({
            mensaje: "La contraseña debe tener entre 8 y 72 caracteres."
        });
    }

    let conexionTransaccion;
    let transaccionIniciada = false;

    try {
        // Encriptar la contraseña con el mismo algoritmo del sistema (bcryptjs, salt 12)
        const contrasenaHash = await bcrypt.hash(contrasena, 12);

        conexionTransaccion = await conexion.getConnection();
        await conexionTransaccion.beginTransaction();
        transaccionIniciada = true;

        // Buscar el usuario
        const [usuarios] = await conexionTransaccion.query(
            "SELECT documento FROM personal_militar WHERE documento = ? OR correo = ? FOR UPDATE",
            [identificador, identificador]
        );

        if (usuarios.length === 0) {
            await conexionTransaccion.rollback();
            transaccionIniciada = false;
            return res.status(404).json({ mensaje: "No se encontró el usuario." });
        }

        const documento = usuarios[0].documento;

        const [solicitudes] = await conexionTransaccion.query(
            `SELECT codigo_hash, token_hash, expira_en, usado
             FROM saffe_codigos_recuperacion
             WHERE documento = ?
             FOR UPDATE`,
            [documento]
        );

        if (solicitudes.length === 0) {
            await conexionTransaccion.rollback();
            transaccionIniciada = false;
            return res.status(400).json({
                mensaje: "La solicitud de recuperación no existe o ha expirado."
            });
        }

        const solicitud = solicitudes[0];

        // Validar expiración y que no haya sido utilizado
        if (solicitud.usado === 1 || Number(solicitud.expira_en) <= Date.now()) {
            await conexionTransaccion.query(
                "DELETE FROM saffe_codigos_recuperacion WHERE documento = ?",
                [documento]
            );
            await conexionTransaccion.commit();
            transaccionIniciada = false;
            return res.status(400).json({
                mensaje: "El código ha expirado o ya fue utilizado previamente."
            });
        }

        // Validar mediante token O mediante código OTP directo
        let validado = false;
        if (token && solicitud.token_hash) {
            validado = coincideHash(hashToken(token), solicitud.token_hash);
        } else if (codigo && /^\d{6}$/.test(codigo)) {
            validado = coincideHash(hashCodigo(codigo), solicitud.codigo_hash);
        }

        if (!validado) {
            await conexionTransaccion.rollback();
            transaccionIniciada = false;
            return res.status(400).json({
                mensaje: "El código o token de autorización es incorrecto."
            });
        }

        // Actualizar la contraseña en personal_militar
        await conexionTransaccion.query(
            "UPDATE personal_militar SET contraseña = ? WHERE documento = ?",
            [contrasenaHash, documento]
        );

        // Invalidar y eliminar el código OTP usado
        await conexionTransaccion.query(
            "DELETE FROM saffe_codigos_recuperacion WHERE documento = ?",
            [documento]
        );

        await conexionTransaccion.commit();
        transaccionIniciada = false;

        return res.json({ mensaje: "La contraseña se actualizó correctamente." });
    } catch (error) {
        if (conexionTransaccion && transaccionIniciada) {
            await conexionTransaccion.rollback();
        }
        console.error("Error al restablecer contraseña:", error);
        return res.status(500).json({
            mensaje: "No se pudo actualizar la contraseña. Inténtalo de nuevo más tarde."
        });
    } finally {
        if (conexionTransaccion) {
            conexionTransaccion.release();
        }
    }
};
