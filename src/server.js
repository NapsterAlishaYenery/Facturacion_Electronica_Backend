// Dependencias principales y middleware de seguridad
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');

// Importar las relaciones de los modelos desde el index
require('./models');

// Importar conexión a base de datos (Sequelize + SQL Server)
const sequelize = require('./config/database');

// Importar rutas (las agregaremos gradualmente)
const authRoutes = require('./modules/auth/auth.routes');
const companiesRoutes = require('./modules/companies/companies.routes');
const sequencesRoutes = require('./modules/sequences/sequences.routes');
const invoicesRoutes = require('./modules/invoices/invoices.routes');
const dgiiRoutes = require('./modules/dgii/dgii.routes');
const plansRoutes = require('./modules/subscriptions/plans/plans.routes');
const subscriptionsRoutes = require('./modules/subscriptions/subscriptions/subscriptions.routes');


// Importar scheduler de jobs programados
const { startScheduler } = require('./modules/jobs/jobs.scheduler');

//Importar Middlewatres globales propios
const { errorMiddleware, notFoundMiddleware } = require('./shared/middlewares/error.middleware');

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
app.use('/api/companies', companiesRoutes);
app.use('/api/sequences', sequencesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/dgii', dgiiRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);


// Middleware global de errores
// ... después de todas las rutas
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Configurar puerto
const port = process.env.PORT || 4001;

// Iniciar el server después de conectar a la base de datos
async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('Conexión a PostgreSQL establecida correctamente');

        // NO usar sync en producción, usar migraciones
        // await sequelize.sync({ alter: false });

        // Arrancar jobs programados (respeta ENABLE_JOBS del .env)
        startScheduler();

        app.listen(port, () => {
            console.log(`🚀 Server running on port ${port} - Facturación Electrónica Ready`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

startServer();