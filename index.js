import "./app/config/env.js";
import express from "express";
import cors from "cors";

import conexion, { host as dbHost, port as dbPort } from "./app/config/database.js";
import { migrarBaseDeDatos } from "./app/config/migrate.js";
import { normalizarOrigen } from "./app/config/origin.js";
import routeUsuario from "./app/routes/routes.usuario.js";
import routeAuth from "./app/routes/routes.auth.js";
import routeAcceso from "./app/routes/routes.acceso.js";
import routeHistorial from "./app/routes/routes.historial.js";
import routeRostro from "./app/routes/routes.rostro.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Necesario en Render / proxies para reconocer HTTPS y headers adecuadamente
app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_ORIGIN ||
    "http://localhost:4000,https://saffefrontend.up.railway.app")
    .split(",")
    .map(normalizarOrigen)
    .filter(Boolean);

app.use(express.json({ limit: "512kb" }));
app.use(cors({
    origin: (origin, callback) => {
        // Peticiones sin origen (Postman, curl, Render health check, server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        const normalizado = normalizarOrigen(origin);

        // Permitir si coincide con la lista, comodín *, subdominios de Render o localhost
        if (
            allowedOrigins.includes("*") ||
            allowedOrigins.includes(normalizado) ||
            normalizado.endsWith(".onrender.com") ||
            normalizado.includes("localhost") ||
            normalizado.includes("127.0.0.1")
        ) {
            return callback(null, true);
        }

        return callback(new Error("Origen no permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204
}));
app.use(express.urlencoded({ extended: true }));

app.use("/api", routeUsuario);
app.use("/api", routeAuth);
app.use("/api", routeAcceso);
app.use("/api", routeHistorial);
app.use("/api", routeRostro);

// Alias directos para /forgot-password y /reset-password (además de /api/...)
app.use("/", routeAuth);

app.get("/", (req, res) => {
    res.json({ mensaje: "Backend SAFFE funcionando correctamente" });
});

app.get("/health", async (req, res) => {
    try {
        await conexion.query("SELECT 1");
        return res.json({ status: "ok", database: "connected" });
    } catch (error) {
        console.error("Health check could not connect to MySQL:", error.code || error.message);
        return res.status(503).json({ status: "error", database: "unavailable" });
    }
});

app.use((error, req, res, next) => {
    if (error.message === "Origen no permitido por CORS") {
        return res.status(403).json({ mensaje: error.message });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({ mensaje: "La solicitud supera el tamaño permitido." });
    }

    console.error("Error no controlado en la API:", error.message);
    return res.status(500).json({ mensaje: "Error interno del servidor." });
});

const iniciarServidor = async () => {
    try {
        await migrarBaseDeDatos();
        app.listen(PORT, () => {
            console.log(`Servidor ejecutándose en el puerto ${PORT}`);
        });
    } catch (error) {
        if (error.code === "ER_ACCESS_DENIED_ERROR") {
            console.error(
                "No se pudo conectar a MySQL: verifica DB_USER y DB_PASSWORD en backend/.env. " +
                "DB_PASSWORD es la contraseña de MySQL, no la de Gmail."
            );
        } else if (error.code === "ER_BAD_DB_ERROR") {
            console.error(
                "La base de datos configurada no existe. Verifica DB_NAME en backend/.env."
            );
        } else if (error.code === "ENOTFOUND") {
            console.error(
                `Error DNS (ENOTFOUND): No se pudo resolver el host "${dbHost}". ` +
                "Verifica en Render que DB_HOST sea solo el nombre de dominio, sin 'mysql://', sin ':4000', ni espacios."
            );
        } else {
            console.error(`No se pudo preparar la base de datos (${dbHost}:${dbPort}):`, error.code || error.message);
        }
        await conexion.end();
        process.exit(1);
    }
};

iniciarServidor();
