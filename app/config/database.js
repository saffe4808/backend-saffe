import "./env.js";
import mysql from "mysql2/promise";

let rawHost = (process.env.MYSQLHOST || process.env.DB_HOST || "127.0.0.1").trim();
let port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
const connectionUri = (process.env.DATABASE_URL || process.env.MYSQL_URL || "").trim();

// Limpiar prefijo de protocolo si el usuario puso "mysql://" o "https://" en DB_HOST
rawHost = rawHost.replace(/^[a-z]+:\/\//i, "");

// Si el usuario incluyó el puerto dentro del host (ejemplo: "gateway01...tidbcloud.com:4000")
if (rawHost.includes(":")) {
    const [h, p] = rawHost.split(":");
    rawHost = h;
    if (p && !process.env.DB_PORT && !process.env.MYSQLPORT) {
        port = Number(p);
    }
}

// Remover cualquier barra final o espacio accidental
const host = rawHost.replace(/\/+$/, "").trim();

// Habilitar SSL si se especifica explícitamente o si se detecta un host cloud común (TiDB, Aiven, etc.)
const requiereSSL =
    process.env.DB_SSL === "true" ||
    process.env.MYSQL_SSL === "true" ||
    process.env.TIDB_ENABLE_SSL === "true" ||
    host.includes("tidbcloud.com") ||
    host.includes("aivencloud.com") ||
    connectionUri.includes("tidbcloud.com") ||
    connectionUri.includes("aivencloud.com") ||
    connectionUri.includes("ssl=");

const sslOption = requiereSSL ? { rejectUnauthorized: false } : undefined;

let poolConfig;

if (connectionUri) {
    try {
        // Parsear URL para asegurar que las opciones (incluyendo SSL) se apliquen limpiamente
        const parsed = new URL(connectionUri);
        poolConfig = {
            host: parsed.hostname,
            port: Number(parsed.port || 3306),
            user: decodeURIComponent(parsed.username || "root"),
            password: decodeURIComponent(parsed.password || ""),
            database: parsed.pathname.replace(/^\//, "") || "sistema_usuarios",
            ssl: sslOption,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
    } catch {
        poolConfig = {
            uri: connectionUri,
            ssl: sslOption,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
    }
} else {
    poolConfig = {
        host,
        port,
        user: (process.env.MYSQLUSER || process.env.DB_USER || "root").trim(),
        password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
        database: (process.env.MYSQLDATABASE || process.env.DB_NAME || "sistema_usuarios").trim(),
        ssl: sslOption,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
}

const conexion = mysql.createPool(poolConfig);

export { host, port };
export default conexion;
