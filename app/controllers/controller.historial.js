import conexion from "../config/database.js";

const normalizarFiltro = (valor) =>
    typeof valor === "string" ? valor.trim() : "";

export const obtenerHistorial = async (req, res) => {
    try {
        const condiciones = [];
        const parametros = [];

        if (req.usuario.rol !== "admin") {
            condiciones.push("a.documento = ?");
            parametros.push(req.usuario.documento);
        } else {
            const documento = normalizarFiltro(req.query.documento);
            const nombre = normalizarFiltro(req.query.nombre);
            const rango = normalizarFiltro(req.query.rango);

            if (documento) {
                condiciones.push("a.documento LIKE ?");
                parametros.push(`%${documento}%`);
            }
            if (nombre) {
                condiciones.push("CONCAT_WS(' ', p.nombre, p.apellido) LIKE ?");
                parametros.push(`%${nombre}%`);
            }
            if (rango) {
                condiciones.push("p.rango LIKE ?");
                parametros.push(`%${rango}%`);
            }
        }

        const filtro = condiciones.length > 0
            ? `WHERE ${condiciones.join(" AND ")}`
            : "";
        const [historial] = await conexion.query(
            `SELECT 
                a.id,
                a.documento, 
                p.nombre, 
                p.apellido,
                p.rango,
                a.hora,
                a.dia,
                a.mes,
                a.anio,
                a.estado,
                a.fecha_acceso
             FROM accesos a
             LEFT JOIN personal_militar p ON a.documento = p.documento
             ${filtro}
             ORDER BY a.id DESC
             LIMIT 50`,
            parametros
        );

        return res.json(historial);
    } catch (error) {
        console.error("Error en obtenerHistorial:", error);
        return res.status(500).json({
            error: error.message,
            mensaje: "Error al obtener el historial de accesos"
        });
    }
};

export const registrarAcceso = async (req, res) => {
    try {
        const { documento, hora, dia, mes, anio } = req.body;

        await conexion.query(
            "INSERT INTO accesos (documento, hora, dia, mes, anio) VALUES (?, ?, ?, ?, ?)",
            [documento, hora, dia, mes, anio]
        );

        return res.json({ mensaje: "Acceso registrado correctamente" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};