import conexion from "../config/database.js";

export const obtenerHistorial = async (req, res) => {
    try {
        const filtroPersonal = req.usuario.rol === "admin"
            ? ""
            : "WHERE a.documento = ?";
        const parametros = req.usuario.rol === "admin"
            ? []
            : [req.usuario.documento];
        const [historial] = await conexion.query(
            `SELECT 
                a.id,
                a.documento, 
                p.nombre, 
                p.apellido,
                a.hora,
                a.dia,
                a.mes,
                a.anio,
                a.estado,
                a.fecha_acceso
             FROM accesos a
             LEFT JOIN personal_militar p ON a.documento = p.documento
             ${filtroPersonal}
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