# Facturación Electrónica DGII

Sistema de facturación electrónica para la República Dominicana, compatible con los estándares de la DGII (Dirección General de Impuestos Internos). Diseñado para pequeñas, medianas y grandes empresas.

## Estado del proyecto

🚧 **En desarrollo** — Fase 1: Modelos y migraciones

## Stack tecnológico

| Capa | Tecnología |
| :--- | :--- |
| Backend | Node.js + Express |
| ORM | Sequelize |
| Base de datos | PostgreSQL 18 |
| Frontend | Angular (próximamente) |
| Autenticación | JWT + cookies httpOnly |
| Validación | Joi |
| Firma digital | node-forge (pendiente) |
| Certificado | Viafirma (.p12) |

## Requisitos previos

- Node.js v18 o superior
- PostgreSQL 18 instalado y corriendo
- Una base de datos llamada `facturacion_electronica`
- (Opcional) pgAdmin para administrar la BD

## Instalación

1. Clonar el repositorio:
   ```bash
   git clone <url-del-repo>
   cd Facturacion_Electronica_Backend

2. Intalar dependencias:
   ```bash
   npm install

3. Copiar el archivo de variable de entorno
   ```bash
   cp .env.example .env

4. Editar .env con tus credenciales reales (ver sección "Variables de entorno").

5. Crear la base de datos en PostgreSQL:
   ```sql

    CREATE DATABASE facturacion_electronica
        WITH OWNER = postgres
        ENCODING = 'UTF8'
        LOCALE_PROVIDER = 'libc'
        CONNECTION LIMIT = -1
        IS_TEMPLATE = False;

6. Ejecutar migraciones (cuando estén creadas):
   ```bash
   npx sequelize-cli db:migrate

7. Iniciar el servidor:
   ```bash
   node src/server.js

8. Verificar que funciona:
   http://localhost:4001/health
   http://localhost:4001/api/auth/ping
   http://localhost:4001/api/ecf/ping