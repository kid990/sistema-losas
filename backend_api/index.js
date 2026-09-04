require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Pool de conexiones a la base de datos
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'api_unheval',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verifica que el pool pueda conectar al iniciar
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
    connection.release();
});

// Helper para manejar errores de forma centralizada
function handleDbError(res, err) {
    console.error('Error en la base de datos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
}

// Rutas
app.get('/api/usuarios', (req, res) => {
    const query = `SELECT * FROM VistaUsuario ORDER BY nombre_completo`;

    db.query(query, (err, results) => {
        if (err) return handleDbError(res, err);

        res.json({
            success: true,
            total: results.length,
            data: results
        });
    });
});

app.get('/api/usuario/:codigo', (req, res) => {
    const { codigo } = req.params;

    if (!codigo || codigo.trim() === '') {
        return res.status(400).json({ error: 'Código requerido' });
    }

    const query = `
        SELECT * FROM VistaUsuario
        WHERE codigo = ?
        LIMIT 1
    `;

    db.query(query, [codigo], (err, results) => {
        if (err) return handleDbError(res, err);

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            data: results[0]
        });
    });
});

// Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando correctamente' });
});

// Manejo 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        message: 'La ruta solicitada no existe'
    });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

// Cierre ordenado del pool al apagar el servidor
process.on('SIGINT', () => {
    console.log('\nCerrando servidor...');
    db.end(() => {
        console.log('Pool de conexiones cerrado');
        server.close(() => process.exit(0));
    });
});