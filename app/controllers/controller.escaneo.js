
import conexion from "../config/database.js";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/auth.js";

export const validarEscaneo = async (req, res) => {
    try {
        const { descriptor } = req.body;

        if (!Array.isArray(descriptor) || descriptor.length === 0) {
            return res.status(400).json({
                acceso: false,
                mensaje: "No se recibió un rostro válido"
            });
        }

        const [usuarios] = await conexion.query(
            `SELECT documento, nombre, apellido, rango, descriptor_facial
             FROM personal_militar
             WHERE descriptor_facial IS NOT NULL`
        );

        let mejorCoincidencia = null;
        let mejorDistancia = Infinity;

        for (const usuario of usuarios) {
            try {
                const guardado = JSON.parse(usuario.descriptor_facial);

                if (!Array.isArray(guardado) ||
                    guardado.length !== descriptor.length) {
                    continue;
                }

                const distancia = Math.sqrt(
                    descriptor.reduce(
                        (suma, valor, i) =>
                            suma + Math.pow(valor - guardado[i], 2),
                        0
                    )
                );

                if (distancia < mejorDistancia) {
                    mejorDistancia = distancia;
                    mejorCoincidencia = usuario;
                }
            } catch (error) {
                console.error("Descriptor inválido:", error.message);
            }
        }

        if (!mejorCoincidencia || mejorDistancia > 0.8) {
            return res.status(401).json({
                acceso: false,
                mensaje: "Rostro no reconocido"
            });
        }

        const token = jwt.sign(
            {
                documento: mejorCoincidencia.documento,
                nombre: mejorCoincidencia.nombre
            },
            JWT_SECRET,
            { expiresIn: "2h" }
        );

        return res.json({
            acceso: true,
            mensaje: "Acceso autorizado",
            token,
            usuario: {
                documento: mejorCoincidencia.documento,
                nombre: mejorCoincidencia.nombre,
                apellido: mejorCoincidencia.apellido,
                rango: mejorCoincidencia.rango
            }
        });

    } catch (error) {
        console.error("Error en escaneo facial:", error);
        return res.status(500).json({
            acceso: false,
            mensaje: "Error al procesar el reconocimiento facial"
        });
    }
};

