const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sistema_losa",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
});

pool
  .getConnection()
  .then((conn) => {
    console.log("✓ Conexión a BD MySQL exitosa");
    conn.release();
  })
  .catch((err) => {
    console.error("✗ Error conectando a BD:", err.message);
    console.error("  Host:", process.env.DB_HOST);
    console.error("  User:", process.env.DB_USER);
    console.error("  Database:", process.env.DB_NAME);
  });

module.exports = pool;
