// Dependencias principales y de seguridad
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const path = require('path');

// Importar conexión a base de datos (Sequelize + SQL Server)
const sequelize = require('./config/database');

// Importar rutas (las agregaremos gradualmente)
const authRoutes = require('./modules/auth/auth.routes');
const ecfRoutes = require('./modules/ecf/ecf.routes');

// Crear el server
const app = express();

// Configurar proxy (si estás detrás de Nginx)
app.set('trust proxy', 1);

// Configurar CORS
const allowedOrigins = [
    "http://localhost:4200",
    process.env.FRONTEND_URL
].filter(Boolean); // Elimina valores undefined

app.use(cors({
    origin: (origin, callback) => {
        // Permitir Postman y herramientas sin origin
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error("CORS not allowed"));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middlewares globales
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' })); // e-CF XML puede ser grande
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Ruta de health check (para monitoreo)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/ecf', ecfRoutes);

// Middleware global de errores
app.use((err, req, res, next) => {
    console.error("Global Server Error:", err.message);
    // No exponer detalles internos en producción
    const message = process.env.NODE_ENV === 'production'
        ? "Internal server error"
        : err.message;
    res.status(500).json({ error: message });
});

// Configurar puerto
const port = process.env.PORT || 4001;

// Iniciar el server después de conectar a la base de datos
async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('Conexión a PostgreSQL establecida correctamente');

        // NO usar sync en producción, usar migraciones
        // await sequelize.sync({ alter: false });

        app.listen(port, () => {
            console.log(`🚀 Server running on port ${port} - Facturación Electrónica Ready`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

startServer();