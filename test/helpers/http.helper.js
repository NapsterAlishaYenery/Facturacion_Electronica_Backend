const http = require('http');

const BASE_URL = 'http://localhost:4001';

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: options.method || 'GET',
            headers: options.headers || {}
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

        req.end();
    });
}

module.exports = { request };