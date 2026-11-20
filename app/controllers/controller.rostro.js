import conexion from "../config/database.js";

const DIMENSION_DESCRIPTOR = 128;
const UMBRAL_COINCIDENCIA = 0.6;

const descriptorValido = (descriptor) =>
    Array.isArray(descriptor) &&
    descriptor.length === DIMENSION_DESCRIPTOR &&
    descriptor.every((valor) => typeof valor === "number" && Number.isFinite(valor));

const calcularDistanciaEuclidiana = (descriptorA, descriptorB) => {
    let suma = 0;
    for (let indice = 0; indice < DIMENSION_DESCRIPTOR; indice++) {
        const diferencia = descriptorA[indice] - descriptorB[indice];
        suma += diferencia * diferencia;
    }
    return Math.sqrt(suma);
};

export const registrarRostro = async (req, res) => {
    try {
        const { userId, descriptor } = req.body ?? {};

        if (
            (typeof userId !== "string" && typeof userId !== "number") ||
            String(userId).trim() === ""
        ) {
            return res.status(400).json({ mensaje: "El userId es obligatorio." });
        }
        if (!descriptorValido(descriptor)) {
            return res.status(400).json({
                mensaje: "El descriptor debe contener 128 valores numéricos finitos."
            });
        }

        const [usuarios] = await conexion.query(
            "SELECT documento FROM personal_militar WHERE documento = ? LIMIT 1",
            [String(userId)]
        );
        if (usuarios.length === 0) {
            return res.status(404).json({ mensaje: "Usuario no encontrado." });
        }

        const descriptorJSON = JSON.stringify(descriptor);
        await conexion.query(
            `UPDATE personal_militar
             SET descriptor_facial = ?, face_descriptor = ?
             WHERE documento = ?`,
            [descriptorJSON, descriptorJSON, String(userId)]
        );

        return res.json({ mensaje: "Descriptor facial registrado correctamente." });
    } catch (error) {
        console.error("Error al registrar descriptor facial:", error);
        return res.status(500).json({ mensaje: "No se pudo registrar el descriptor facial." });
    }
};

export const verificarRostro = async (req, res) => {
    try {
        const { descriptor } = req.body ?? {};
        if (!descriptorValido(descriptor)) {
            return res.status(400).json({
                mensaje: "El descriptor debe contener 128 valores numéricos finitos."
            });
        }

        const [usuarios] = await conexion.query(
            `SELECT descriptor_facial, face_descriptor
             FROM personal_militar
             WHERE descriptor_facial IS NOT NULL OR face_descriptor IS NOT NULL`
        );

        let distanciaMinima = Infinity;
        for (const usuario of usuarios) {
            const guardado = usuario.face_descriptor || usuario.descriptor_facial;
            let descriptorGuardado;
            try {
                descriptorGuardado = typeof guardado === "string" ? JSON.parse(guardado) : guardado;
            } catch {
                continue;
            }

            if (!descriptorValido(descriptorGuardado)) {
                continue;
            }

            distanciaMinima = Math.min(
                distanciaMinima,
                calcularDistanciaEuclidiana(descriptor, descriptorGuardado)
            );
        }

        const coincide = distanciaMinima < UMBRAL_COINCIDENCIA;
        return res.json({
            coincide,
            distancia: Number.isFinite(distanciaMinima)
                ? Number(distanciaMinima.toFixed(4))
                : null,
            umbral: UMBRAL_COINCIDENCIA
        });
    } catch (error) {
        console.error("Error al verificar descriptor facial:", error);
        return res.status(500).json({ mensaje: "No se pudo verificar el descriptor facial." });
    }
};
