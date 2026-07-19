const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const host = '0.0.0.0';
const rootDir = __dirname;
const dataFile = path.join(rootDir, 'clients-data.json');

function ensureDataFile() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '[]');
  }
}

function readClients() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeClients(clients) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(clients, null, 2));
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/clients') {
    sendJson(res, 200, readClients());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/clients') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const clients = readClients();
        clients.push({
          ...payload,
          submittedAt: payload.submittedAt || new Date().toISOString()
        });
        writeClients(clients);
        sendJson(res, 200, { success: true, clients });
      } catch (error) {
        sendJson(res, 400, { success: false, message: 'Invalid payload' });
      }
    });
    return;
  }

  let requestedPath = url.pathname;
  if (requestedPath === '/') {
    requestedPath = '/index.html';
  }

  const safePath = path.normalize(requestedPath).replace(/^\.+/, '');
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.exists(filePath, exists => {
    if (exists && fs.statSync(filePath).isFile()) {
      serveFile(res, filePath);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Also reachable at http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
});
