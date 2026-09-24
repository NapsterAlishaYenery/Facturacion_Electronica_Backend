const http = require('http');

const BASE_URL = 'http://localhost:4001';

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const body = options.body || null;

        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                ...options.headers,
                ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: data ? JSON.parse(data) : null
                });
            });
        });

        req.on('error', (error) => {
            if (error.code === 'ECONNREFUSED') {
                reject(new Error(
                    `❌ Cannot connect to ${BASE_URL}.\n` +
                    `   ¿Está el server corriendo? Ejecuta 'node src/server.js' en otra terminal.`
                ));
            } else {
                reject(error);
            }
        });

        if (body) req.write(body);
        req.end();
    });
}

module.exports = { request };