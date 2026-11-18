import "./env.js";
import mysql from "mysql2/promise";

const host = process.env.MYSQLHOST || process.env.DB_HOST || "127.0.0.1";
const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL;

// Habilitar SSL si se especifica explícitamente o si se detecta un host cloud común (TiDB, Aiven, etc.)
const requiereSSL = 
    process.env.DB_SSL === "true" ||
    process.env.MYSQL_SSL === "true" ||
    process.env.TIDB_ENABLE_SSL === "true" ||
    host.includes("tidbcloud.com") ||
    host.includes("aivencloud.com") ||
    (Boolean(connectionUri) && connectionUri.includes("ssl="));

const sslOption = requiereSSL ? { rejectUnauthorized: false } : undefined;

const poolConfig = connectionUri
    ? {
        uri: connectionUri,
        ssl: sslOption,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    }
    : {
        host,
        user: process.env.MYSQLUSER || process.env.DB_USER || "root",
        password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
        database: process.env.MYSQLDATABASE || process.env.DB_NAME || "sistema_usuarios",
        port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
        ssl: sslOption,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

const conexion = mysql.createPool(poolConfig);

export default conexion;
