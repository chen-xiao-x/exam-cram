// Minimal debug log collector - /event POST, /logs GET, /health GET
const http = require('http');
const fs = require('fs');
const path = require('path');
const outdir = path.join(__dirname, '.dbg');
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });
const logFile = path.join(outdir, 'kp-import-noop.ndjson');
if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '');
const PORT = parseInt(process.env.PORT || '7777', 10);
const events = [];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const CORS = () => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); };
  CORS();
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (u.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, count: events.length })); }
  if (u.pathname === '/event' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const ev = JSON.parse(body || '{}');
        ev._receivedAt = new Date().toISOString();
        events.push(ev);
        fs.appendFileSync(logFile, JSON.stringify(ev) + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  if (u.pathname === '/logs' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ count: events.length, events: events.slice(-200) }));
  }
  if (u.pathname === '/logs' && req.method === 'DELETE') {
    events.length = 0;
    fs.writeFileSync(logFile, '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('debug server on http://127.0.0.1:' + PORT);
  console.log('log file: ' + logFile);
  // 写 env 文件让前端用
  fs.writeFileSync(path.join(outdir, 'kp-import-noop.env'), 'DEBUG_SERVER_URL=http://127.0.0.1:' + PORT + '/event\n');
});
