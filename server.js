/* Small dependency-free server:
   - serves the app's static files
   - POST /api/webhook/:channel  (gofood | grabfood | shopeefood) -> pushed to every open screen via SSE
   - GET  /api/stream            (Server-Sent Events for the browser)
   Run:  node server.js   (PORT and WEBHOOK_SECRET are optional environment variables)
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.WEBHOOK_SECRET || '';
const CHANNELS = ['gofood', 'grabfood', 'shopeefood'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const clients = new Set();
const backlog = [];       // replayed through Last-Event-ID when a browser reconnects
let seq = 0;

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function broadcast(event, data) {
  const id = ++seq;
  backlog.push({ id, event, data });
  if (backlog.length > 100) backlog.shift();
  const msg = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((c) => c.write(msg));
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('payload too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, clients: clients.size });

  if (req.method === 'GET' && url.pathname === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    const last = parseInt(req.headers['last-event-id'], 10);
    if (last) backlog.filter((b) => b.id > last).forEach((b) => res.write(`id: ${b.id}\nevent: ${b.event}\ndata: ${JSON.stringify(b.data)}\n\n`));
    clients.add(res);
    const ka = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ka); clients.delete(res); });
    return;
  }

  const m = url.pathname.match(/^\/api\/webhook\/([a-z]+)$/);
  if (m) {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'use POST' });
    const channel = m[1];
    if (!CHANNELS.includes(channel)) return send(res, 404, { ok: false, error: 'unknown channel' });
    if (SECRET && req.headers['x-webhook-secret'] !== SECRET) return send(res, 401, { ok: false, error: 'wrong secret' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { ok: false, error: 'invalid JSON' }); }
    if (!body.externalId || !Array.isArray(body.items) || !body.items.length) {
      return send(res, 422, { ok: false, error: 'required: externalId and items[]' });
    }
    const items = body.items.slice(0, 50).map((i) => ({
      sku: i.sku ? String(i.sku) : '', name: i.name ? String(i.name) : '',
      qty: Math.max(1, parseInt(i.qty, 10) || 1), price: i.price != null ? Number(i.price) : null, note: i.note ? String(i.note) : '',
      // customer's chosen options, e.g. ["BBQ Sauce Level 2", "Pink Lava 12oz"]
      options: Array.isArray(i.options) ? i.options.slice(0, 20).map(String) : []
    }));
    broadcast('order', { channel, externalId: String(body.externalId), customer: body.customer ? String(body.customer) : '', items });
    return send(res, 202, { ok: true, delivered: clients.size });
  }

  // static files (restricted to the app folder)
  let file = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const full = path.join(__dirname, path.normalize(file));
  if (!full.startsWith(__dirname + path.sep) || ['server.js', 'README.md'].includes(path.basename(full))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Restaurant ERP running at http://localhost:${PORT}`));
