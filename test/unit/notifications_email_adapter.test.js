// ============================================================
// TEST: adapters/email.adapter (Step 6.3)
// Ejecutar: node test/unit/notifications_email_adapter.test.js
//
// Usa un mock manual de Nodemailer interceptando createTransport.
// No envía correos reales ni requiere SMTP configurado.
// ============================================================

// ------------------------------------------------------------
// MOCK: interceptar Nodemailer ANTES de requerir el adapter
// ------------------------------------------------------------
const nodemailer = require('nodemailer');
const originalCreateTransport = nodemailer.createTransport;

let capturedMails = [];
let mockVerifyResult = true;

nodemailer.createTransport = function mockCreateTransport(config) {
    mockCreateTransport.lastConfig = config;

    return {
        sendMail: async (mailOptions) => {
            capturedMails.push(mailOptions);
            return { messageId: 'mock-id-' + capturedMails.length };
        },
        verify: async () => {
            if (!mockVerifyResult) throw new Error('mock verify failed');
            return true;
        }
    };
};

// Env vars mínimas para que el adapter pueda construirse
process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.local';
process.env.SMTP_PASS = 'secret';
process.env.SMTP_FROM = 'Test <test@test.local>';

const adapter = require('../../src/modules/notifications/adapters/email.adapter');

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

function reset() {
    capturedMails = [];
    mockVerifyResult = true;
    adapter._resetTransporter();
    nodemailer.createTransport.lastConfig = null;
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------
console.log('=== email.adapter — API ===\n');
test('exporta send', typeof adapter.send === 'function');
test('exporta verify', typeof adapter.verify === 'function');
test('exporta _resetTransporter', typeof adapter._resetTransporter === 'function');

// ------------------------------------------------------------
// Runner
// ------------------------------------------------------------
(async () => {
    // ------------------------------------------------------------
    // Happy path
    // ------------------------------------------------------------
    console.log('\n=== send — happy path ===\n');
    reset();
    {
        const info = await adapter.send({
            to: 'dest@test.local',
            subject: 'Hola',
            html: '<p>Hi</p>',
            text: 'Hi'
        });

        test('devuelve info con messageId',
            info && typeof info.messageId === 'string');
        test('capturó 1 email', capturedMails.length === 1);

        const mail = capturedMails[0];
        test('to correcto', mail.to === 'dest@test.local');
        test('subject correcto', mail.subject === 'Hola');
        test('html correcto', mail.html === '<p>Hi</p>');
        test('text correcto', mail.text === 'Hi');
        test('from resuelto desde SMTP_FROM',
            mail.from === 'Test <test@test.local>');
    }

    // ------------------------------------------------------------
    // from explícito sobrescribe SMTP_FROM
    // ------------------------------------------------------------
    console.log('\n=== from explícito ===\n');
    reset();
    {
        await adapter.send({
            to: 'dest@test.local',
            subject: 'X',
            html: '<p>x</p>',
            from: 'Otro <otro@test.local>'
        });

        test('from explícito usado',
            capturedMails[0].from === 'Otro <otro@test.local>');
    }

    // ------------------------------------------------------------
    // bcc opcional
    // ------------------------------------------------------------
    console.log('\n=== bcc ===\n');
    reset();
    {
        await adapter.send({
            to: 'dest@test.local',
            subject: 'X',
            html: '<p>x</p>',
            bcc: 'bcc@test.local'
        });

        test('bcc incluido cuando se pasa',
            capturedMails[0].bcc === 'bcc@test.local');
    }

    console.log('\n=== sin bcc ===\n');
    reset();
    {
        await adapter.send({
            to: 'dest@test.local',
            subject: 'X',
            html: '<p>x</p>'
        });

        test('bcc ausente cuando no se pasa',
            capturedMails[0].bcc === undefined);
    }

    // ------------------------------------------------------------
    // Validaciones
    // ------------------------------------------------------------
    console.log('\n=== Validaciones ===\n');
    reset();
    {
        let err = null;
        try { await adapter.send({ subject: 'X', html: 'x' }); }
        catch (e) { err = e; }
        test('lanza si falta to',
            err && err.message.includes('"to" is required'), err?.message);

        err = null;
        try { await adapter.send({ to: 'a@b.com', html: 'x' }); }
        catch (e) { err = e; }
        test('lanza si falta subject',
            err && err.message.includes('"subject" is required'), err?.message);

        err = null;
        try { await adapter.send({ to: 'a@b.com', subject: 'X' }); }
        catch (e) { err = e; }
        test('lanza si falta html y text',
            err && err.message.includes('"html" or "text"'), err?.message);

        test('no capturó emails en validaciones fallidas',
            capturedMails.length === 0);
    }

    // ------------------------------------------------------------
    // transporter lazy
    // ------------------------------------------------------------
    console.log('\n=== transporter lazy ===\n');
    reset();
    {
        test('antes del primer send: no transporter',
            nodemailer.createTransport.lastConfig === null);

        await adapter.send({ to: 'a@b.com', subject: 'X', html: 'x' });

        const cfg = nodemailer.createTransport.lastConfig;
        test('después del primer send: transporter creado', !!cfg);
        test('usa SMTP_HOST', cfg.host === 'smtp.test.local');
        test('usa SMTP_PORT numérico', cfg.port === 587);
        test('secure=false en puerto 587', cfg.secure === false);
        test('auth.user correcto', cfg.auth.user === 'test@test.local');
        test('auth.pass correcto', cfg.auth.pass === 'secret');
    }

    // ------------------------------------------------------------
    // secure=true con puerto 465
    // ------------------------------------------------------------
    console.log('\n=== secure según puerto ===\n');
    reset();
    process.env.SMTP_PORT = '465';
    {
        await adapter.send({ to: 'a@b.com', subject: 'X', html: 'x' });
        test('secure=true en puerto 465',
            nodemailer.createTransport.lastConfig.secure === true);
    }
    process.env.SMTP_PORT = '587';

    // ------------------------------------------------------------
    // transporter reutilizado
    // ------------------------------------------------------------
    console.log('\n=== reutilización del transporter ===\n');
    reset();
    {
        await adapter.send({ to: 'a@b.com', subject: 'X', html: 'x' });
        nodemailer.createTransport.lastConfig = null;

        await adapter.send({ to: 'c@d.com', subject: 'Y', html: 'y' });

        test('no se recreó el transporter',
            nodemailer.createTransport.lastConfig === null);
        test('2 emails capturados', capturedMails.length === 2);
    }

    // ------------------------------------------------------------
    // verify
    // ------------------------------------------------------------
    console.log('\n=== verify ===\n');
    reset();
    {
        const ok = await adapter.verify();
        test('verify=true cuando SMTP funciona', ok === true);

        reset();
        mockVerifyResult = false;
        const fail = await adapter.verify();
        test('verify=false cuando SMTP falla', fail === false);
    }

    // ------------------------------------------------------------
    // Error de SMTP se propaga
    // ------------------------------------------------------------
    console.log('\n=== error de SMTP ===\n');
    reset();
    {
        const failing = {
            sendMail: async () => { throw new Error('boom'); },
            verify: async () => true
        };
        const original = nodemailer.createTransport;
        nodemailer.createTransport = () => failing;

        let err = null;
        try { await adapter.send({ to: 'a@b.com', subject: 'X', html: 'x' }); }
        catch (e) { err = e; }

        test('propaga el error de Nodemailer',
            err && err.message === 'boom', err?.message);

        nodemailer.createTransport = original;
    }

    // ------------------------------------------------------------
    // Restaurar Nodemailer original
    // ------------------------------------------------------------
    nodemailer.createTransport = originalCreateTransport;

    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
})();