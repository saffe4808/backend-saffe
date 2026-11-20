import conexion from "../config/database.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { JWT_SECRET } from "../config/auth.js";

// 1. Inicio de sesión estándar (Contraseña)
export const login = async (req, res) => {
    try {
        const { documento, contraseña, contrasena } = req.body;
        const clave = contraseña ?? contrasena;

        if (!documento || !clave) {
            return res.status(400).json({
                mensaje: "El documento y la contraseña son obligatorios"
            });
        }

        const [usuarios] = await conexion.query(
            "SELECT * FROM personal_militar WHERE documento = ?",
            [documento]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: "Documento no registrado" });
        }

        const usuario = usuarios[0];
        const tieneContrasenaHash =
            typeof usuario.contraseña === "string" &&
            /^\$2[aby]\$\d{2}\$/.test(usuario.contraseña);
        const contrasenaValida = tieneContrasenaHash
            ? await bcrypt.compare(clave, usuario.contraseña)
            : usuario.contraseña === clave;

        if (!contrasenaValida) {
            return res.status(401).json({ mensaje: "Contraseña incorrecta" });
        }

        // --- REGISTRO DEL INGRESO EN LA TABLA ACCESOS ---
        const ahora = new Date();
        const hora = ahora.toLocaleTimeString("es-CO", { hour12: false });
        const dia = ahora.getDate();
        const mes = ahora.getMonth() + 1;
        const anio = ahora.getFullYear();

        await conexion.query(
            `INSERT INTO accesos
                (documento, hora, dia, mes, anio, fecha_acceso, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [usuario.documento, hora, dia, mes, anio, ahora, "AUTORIZADO"]
        );
        // ------------------------------------------------

        const token = jwt.sign(
            { documento: usuario.documento, nombre: usuario.nombre },
            JWT_SECRET,
            { expiresIn: "2h" }
        );

        return res.json({ mensaje: "Inicio de sesión correcto", token });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 2. Registro y vinculación del vector/descriptor facial
export const registrarRostro = async (req, res) => {
    try {
        const { documento, descriptor, faceDescriptor } = req.body;
        const vector = faceDescriptor || descriptor;

        if (!documento || !vector) {
            return res.status(400).json({ 
                mensaje: "El documento y el descriptor facial son obligatorios" 
            });
        }

        // Convertir el vector biométrico a formato JSON para MySQL
        const descriptorJSON = JSON.stringify(vector);

        const [resultado] = await conexion.query(
            "UPDATE personal_militar SET descriptor_facial = ?, face_descriptor = ? WHERE documento = ?",
            [descriptorJSON, descriptorJSON, documento]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Usuario no encontrado en la base de datos" });
        }

        return res.json({ mensaje: "Rostro registrado y vinculado correctamente" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Función para calcular la distancia euclidiana entre dos vectores de 128 posiciones:
 * d(p, q) = sqrt( sum( (p_i - q_i)^2 ) )
 */
export const calcularDistanciaEuclidiana = (vectorA, vectorB) => {
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
        return Infinity;
    }
    let suma = 0;
    for (let i = 0; i < vectorA.length; i++) {
        const diff = Number(vectorA[i]) - Number(vectorB[i]);
        suma += diff * diff;
    }
    return Math.sqrt(suma);
};

// 3. Login por reconocimiento facial en el Backend (1:1 o 1:N)
export const loginFacial = async (req, res) => {
    try {
        const { faceDescriptor, descriptor, documento, correo } = req.body;
        const vectorEntrante = faceDescriptor || descriptor;

        if (!vectorEntrante || !Array.isArray(vectorEntrante) || vectorEntrante.length !== 128) {
            return res.status(400).json({
                mensaje: "Se requiere un vector facial válido de 128 posiciones."
            });
        }

        // Obtener usuarios con vector facial registrado
        let query = "SELECT documento, nombre, apellido, correo, descriptor_facial, face_descriptor FROM personal_militar WHERE descriptor_facial IS NOT NULL OR face_descriptor IS NOT NULL";
        const params = [];

        if (documento) {
            query += " AND documento = ?";
            params.push(documento);
        } else if (correo) {
            query += " AND correo = ?";
            params.push(correo);
        }

        const [usuarios] = await conexion.query(query, params);

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensaje: "No hay usuarios biométricos registrados para comparar."
            });
        }

        const UMBRAL_SEGURIDAD = 0.55; // Distancia máxima permitida para aceptar identidad
        let mejorCoincidencia = null;
        let menorDistancia = Infinity;

        for (const usuario of usuarios) {
            const rawVector = usuario.face_descriptor || usuario.descriptor_facial;
            if (!rawVector) continue;

            let vectorGuardado;
            try {
                vectorGuardado = typeof rawVector === "string" ? JSON.parse(rawVector) : rawVector;
            } catch {
                continue;
            }

            if (Array.isArray(vectorGuardado) && vectorGuardado.length === 128) {
                const distancia = calcularDistanciaEuclidiana(vectorEntrante, vectorGuardado);
                if (distancia < menorDistancia) {
                    menorDistancia = distancia;
                    mejorCoincidencia = usuario;
                }
            }
        }

        const ahora = new Date();
        const hora = ahora.toLocaleTimeString("es-CO", { hour12: false });
        const dia = ahora.getDate();
        const mes = ahora.getMonth() + 1;
        const anio = ahora.getFullYear();

        // Validar si la menor distancia está dentro del umbral de seguridad
        if (mejorCoincidencia && menorDistancia < UMBRAL_SEGURIDAD) {
            // Registrar acceso autorizado
            await conexion.query(
                `INSERT INTO accesos
                    (documento, hora, dia, mes, anio, fecha_acceso, estado)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [mejorCoincidencia.documento, hora, dia, mes, anio, ahora, "AUTORIZADO"]
            );

            // Generar token JWT exactamente igual que en el login tradicional
            const token = jwt.sign(
                { documento: mejorCoincidencia.documento, nombre: mejorCoincidencia.nombre },
                JWT_SECRET,
                { expiresIn: "2h" }
            );

            return res.json({
                mensaje: "Autenticación facial exitosa",
                usuario: {
                    documento: mejorCoincidencia.documento,
                    nombre: mejorCoincidencia.nombre,
                    apellido: mejorCoincidencia.apellido
                },
                distancia: Number(menorDistancia.toFixed(4)),
                token
            });
        }

        // Si se especificó un documento pero no coincidió, registrar denegado
        const docDenegado = mejorCoincidencia ? mejorCoincidencia.documento : (documento || "DESCONOCIDO");
        await conexion.query(
            `INSERT INTO accesos
                (documento, hora, dia, mes, anio, fecha_acceso, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [docDenegado, hora, dia, mes, anio, ahora, "DENEGADO"]
        );

        return res.status(401).json({
            mensaje: "Rostro no reconocido o nivel de confianza insuficiente.",
            distancia: menorDistancia === Infinity ? null : Number(menorDistancia.toFixed(4)),
            umbral: UMBRAL_SEGURIDAD
        });
    } catch (error) {
        console.error("Error en loginFacial:", error);
        return res.status(500).json({ error: error.message });
    }
};