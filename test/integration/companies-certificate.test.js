// ============================================================
// Tests de integración: certificado digital (.p12)
// Cubre 8.2 (upload) — 8.3 y 8.4 se agregan en sus propios steps
// ============================================================

require('dotenv').config();
const http = require('http');
const { generateTestP12 } = require('../helpers/generate-test-p12');
const sequelize = require('../../src/config/database');
const { User, Company, AuditLog, Subscription, Sequence } = require('../../src/models');

const BASE_URL = 'http://localhost:4001';
const PORT = 4001;

// Credenciales de prueba
const testRnc = '130999901';
const ownerEmail = 'cert-owner@expedinap.com';
const ownerPassword = 'OwnerPass123';
const adminEmail = 'cert-admin@expedinap.com';

let ownerCookie = null;
let companyId = null;
let adminId = null;

// ------------------------------------------------------------
// Helpers HTTP
// ------------------------------------------------------------
function loginAndGetCookie(email, password) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ email, password });
        const req = http.request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const cookies = res.headers['set-cookie'] || [];
                const access = cookies.find(c => c.startsWith('access_token='));
                if (!access) return reject(new Error('No access_token cookie'));
                resolve(access.split(';')[0]);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Construye un body multipart/form-data manualmente
function buildMultipart({ fileBuffer, filename, password, boundary }) {
    const CRLF = '\r\n';
    const parts = [];

    // Campo password
    parts.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="password"${CRLF}${CRLF}` +
        `${password}${CRLF}`
    ));

    // Archivo
    parts.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="certificate"; filename="${filename}"${CRLF}` +
        `Content-Type: application/x-pkcs12${CRLF}${CRLF}`
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));

    return Buffer.concat(parts);
}

function uploadCertificateRequest(cookie, { fileBuffer, filename = 'cert.p12', password }) {
    return new Promise((resolve, reject) => {
        const boundary = '----TestBoundary' + Date.now() + Math.random().toString(16).slice(2);
        const body = buildMultipart({ fileBuffer, filename, password, boundary });

        const req = http.request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/companies/me/certificate',
            method: 'PATCH',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length,
                Cookie: cookie
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                let parsed = null;
                try { parsed = data ? JSON.parse(data) : null; } catch (_) { parsed = { raw: data }; }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ------------------------------------------------------------
// Test runner
// ------------------------------------------------------------
let passed = 0, failed = 0;
function test(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // ------------------------------------------------------------
        // Limpieza previa
        // ------------------------------------------------------------
        const oldCompany = await Company.findOne({ where: { rnc: testRnc } });
        if (oldCompany) {
            await AuditLog.destroy({ where: { companyId: oldCompany.id } });
            await Subscription.destroy({ where: { companyId: oldCompany.id } });
            await Sequence.destroy({ where: { companyId: oldCompany.id } });
            await User.destroy({ where: { companyId: oldCompany.id } });
            await Company.destroy({ where: { id: oldCompany.id } });
        }
        await User.destroy({ where: { email: adminEmail } });

        // ------------------------------------------------------------
        // Setup: admin + empresa
        // ------------------------------------------------------------
        const admin = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'Cert',
            role: 'admin'
        });
        adminId = admin.id;

        // Registrar empresa (vía endpoint para que se cree todo)
        const registerBody = JSON.stringify({
            company: { rnc: testRnc, name: 'Cert Test Company SRL', dgiiEnvironment: 'testecf' },
            owner: {
                email: ownerEmail,
                password: ownerPassword,
                firstName: 'Owner',
                lastName: 'Cert'
            }
        });

        await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: PORT,
                path: '/api/auth/register-company',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(registerBody)
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        companyId = parsed?.data?.company?.id;
                    } catch (_) { /* ignore */ }
                    resolve();
                });
            });
            req.on('error', reject);
            req.write(registerBody);
            req.end();
        });

        if (!companyId) {
            throw new Error('No se pudo crear la empresa de prueba');
        }

        ownerCookie = await loginAndGetCookie(ownerEmail, ownerPassword);
        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: upload exitoso
        // ============================================================
        console.log('--- Test 1: upload exitoso ---');
        const { buffer: p12Buffer, password: p12Password } = generateTestP12({
            rnc: testRnc,
            password: 'test-p12-pass'
        });

        const res1 = await uploadCertificateRequest(ownerCookie, {
            fileBuffer: p12Buffer,
            password: p12Password
        });

        test('status 200', res1.status === 200, `got ${res1.status} → ${JSON.stringify(res1.body)}`);
        test('success true', res1.body?.success === true);
        test('has company data', !!res1.body?.data?.company);
        test('company has certificateUploadedAt',
            !!res1.body?.data?.company?.certificateUploadedAt);
        test('company has certificateExpiresAt',
            !!res1.body?.data?.company?.certificateExpiresAt);
        test('does NOT expose certificatePasswordEncrypted',
            res1.body?.data?.company?.certificatePasswordEncrypted === undefined);
        test('does NOT expose certificateIv',
            res1.body?.data?.company?.certificateIv === undefined);
        test('does NOT expose certificateAuthTag',
            res1.body?.data?.company?.certificateAuthTag === undefined);
        test('does NOT expose certificatePath',
            res1.body?.data?.company?.certificatePath === undefined);

        // Verificar en BD que se guardó todo
        const companyDb = await Company.findByPk(companyId);
        test('BD: certificatePath guardado', !!companyDb.certificatePath);
        test('BD: certificatePath es {companyId}.p12.enc',
            companyDb.certificatePath === `${companyId}.p12.enc`);
        test('BD: certificateIv guardado', !!companyDb.certificateIv);
        test('BD: certificateAuthTag guardado', !!companyDb.certificateAuthTag);
        test('BD: certificatePasswordEncrypted guardado',
            !!companyDb.certificatePasswordEncrypted);
        test('BD: password cifrado tiene formato iv:authTag:encrypted',
            companyDb.certificatePasswordEncrypted.split(':').length === 3);

        // Verificar archivo en disco
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.env.CERT_UPLOAD_DIR || './uploads/certs', companyDb.certificatePath);
        test('Archivo .p12.enc existe en disco', fs.existsSync(filePath));

        // Verificar AuditLog
        const audit = await AuditLog.findOne({
            where: { companyId, action: 'company.certificate_uploaded' }
        });
        test('AuditLog company.certificate_uploaded creado', !!audit);
        test('AuditLog tiene entity=company', audit?.entity === 'company');
        test('AuditLog tiene userId', !!audit?.userId);

        // ============================================================
        // TEST 2: password incorrecta
        // ============================================================
        console.log('\n--- Test 2: password incorrecta ---');
        const res2 = await uploadCertificateRequest(ownerCookie, {
            fileBuffer: p12Buffer,
            password: 'wrong-password'
        });
        test('status 400', res2.status === 400, `got ${res2.status}`);
        test('code CERTIFICATE_INVALID_PASSWORD',
            res2.body?.error?.code === 'CERTIFICATE_INVALID_PASSWORD');

        // ============================================================
        // TEST 3: RNC del certificado no coincide
        // ============================================================
        console.log('\n--- Test 3: RNC mismatch ---');
        const { buffer: p12BufferWrongRnc, password: p12PassWrongRnc } = generateTestP12({
            rnc: '130111222', // RNC distinto al de la empresa
            password: 'test-p12-pass'
        });
        const res3 = await uploadCertificateRequest(ownerCookie, {
            fileBuffer: p12BufferWrongRnc,
            password: p12PassWrongRnc
        });
        test('status 400', res3.status === 400, `got ${res3.status}`);
        test('code CERTIFICATE_RNC_MISMATCH',
            res3.body?.error?.code === 'CERTIFICATE_RNC_MISMATCH');

        // ============================================================
        // TEST 4: certificado vencido
        // ============================================================
        console.log('\n--- Test 4: certificado vencido ---');
        const { buffer: p12BufferExpired, password: p12PassExpired } = generateTestP12({
            rnc: testRnc,
            password: 'test-p12-pass',
            expired: true
        });
        const res4 = await uploadCertificateRequest(ownerCookie, {
            fileBuffer: p12BufferExpired,
            password: p12PassExpired
        });
        test('status 400', res4.status === 400, `got ${res4.status}`);
        test('code CERTIFICATE_EXPIRED',
            res4.body?.error?.code === 'CERTIFICATE_EXPIRED');

        // ============================================================
        // TEST 5: extensión inválida
        // ============================================================
        console.log('\n--- Test 5: extensión inválida ---');
        const res5 = await uploadCertificateRequest(ownerCookie, {
            fileBuffer: Buffer.from('no soy un p12'),
            filename: 'certificado.txt',
            password: 'x'
        });
        test('status 400', res5.status === 400, `got ${res5.status}`);
        test('code CERTIFICATE_INVALID_EXTENSION',
            res5.body?.error?.code === 'CERTIFICATE_INVALID_EXTENSION');

        // ============================================================
        // TEST 6: sin archivo
        // ============================================================
        console.log('\n--- Test 6: sin archivo ---');
        const boundary = '----NoFileBoundary' + Date.now();
        const noFileBody = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="password"\r\n\r\n` +
            `algo\r\n` +
            `--${boundary}--\r\n`
        );
        const res6 = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost', port: PORT,
                path: '/api/companies/me/certificate', method: 'PATCH',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': noFileBody.length,
                    Cookie: ownerCookie
                }
            }, (res) => {
                let d = '';
                res.on('data', c => d += c);
                res.on('end', () => resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null }));
            });
            req.on('error', reject);
            req.write(noFileBody);
            req.end();
        });
        test('status 400', res6.status === 400, `got ${res6.status}`);
        test('code CERTIFICATE_FILE_REQUIRED',
            res6.body?.error?.code === 'CERTIFICATE_FILE_REQUIRED');

        // ============================================================
        // TEST 7: sin autenticación
        // ============================================================
        console.log('\n--- Test 7: sin autenticación ---');
        const res7 = await uploadCertificateRequest('', {
            fileBuffer: p12Buffer,
            password: p12Password
        });
        test('status 401', res7.status === 401, `got ${res7.status}`);

        // ============================================================
        // TEST 8: admin (sin empresa) → 400 NO_COMPANY_ASSIGNED
        // El roleMiddleware permite a admin (jerarquía 3 > 2),
        // pero el service rechaza porque no tiene companyId.
        // ============================================================
        console.log('\n--- Test 8: admin sin empresa ---');
        const adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        const res8 = await uploadCertificateRequest(adminCookie, {
            fileBuffer: p12Buffer,
            password: p12Password
        });
        test('status 400', res8.status === 400, `got ${res8.status}`);
        test('code NO_COMPANY_ASSIGNED',
            res8.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 9: operator → 403 INSUFFICIENT_ROLE
        // Un operator (jerarquía 1) NO puede pasar roleMiddleware('company_admin')
        // ============================================================
        console.log('\n--- Test 9: operator bloqueado por roleMiddleware ---');
        // Crear un operator en la empresa
        const operatorPassword = 'OperatorPass123';
        await User.create({
            email: 'cert-operator@expedinap.com',
            password: operatorPassword,
            firstName: 'Operator',
            lastName: 'Cert',
            role: 'operator',
            companyId
        });

        const operatorCookie = await loginAndGetCookie('cert-operator@expedinap.com', operatorPassword);
        const res9 = await uploadCertificateRequest(operatorCookie, {
            fileBuffer: p12Buffer,
            password: p12Password
        });
        test('status 403', res9.status === 403, `got ${res9.status}`);
        test('code INSUFFICIENT_ROLE',
            res9.body?.error?.code === 'INSUFFICIENT_ROLE');

        // Cleanup del operator
        await User.destroy({ where: { email: 'cert-operator@expedinap.com' } });

    } catch (err) {
        console.error('\n❌ Test error:', err.message);
        console.error(err.stack);
        failed++;
    } finally {
        // Cleanup
        try {
            if (companyId) {
                await AuditLog.destroy({ where: { companyId } });
                await Subscription.destroy({ where: { companyId } });
                await Sequence.destroy({ where: { companyId } });
                await User.destroy({ where: { companyId } });
                await Company.destroy({ where: { id: companyId } });

                // Borrar archivo .enc si existe
                const fs = require('fs');
                const path = require('path');
                const encPath = path.join(
                    process.env.CERT_UPLOAD_DIR || './uploads/certs',
                    `${companyId}.p12.enc`
                );
                if (fs.existsSync(encPath)) fs.unlinkSync(encPath);
            }
            if (adminId) {
                await AuditLog.destroy({ where: { userId: adminId } });
                await User.destroy({ where: { id: adminId } });
            }
            console.log('\n🧹 Cleaned up');
        } catch (e) {
            console.error('Cleanup error:', e.message);
        }

        console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
})();