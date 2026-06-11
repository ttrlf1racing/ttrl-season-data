const fs = require('fs/promises');
const http = require('http');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store'
  });
  res.end(body);
}

function resolveStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
}

async function listSeasonFiles(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const folder = url.searchParams.get('folder') || 'current-season';

  if (!['current-season', 'previous-seasons'].includes(folder)) {
    send(res, 400, JSON.stringify({ error: 'Invalid folder' }), 'application/json; charset=utf-8');
    return;
  }

  const dir = path.join(root, 'export_data', folder);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map(entry => ({
      type: 'file',
      name: entry.name,
      path: `export_data/${folder}/${entry.name}`
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  send(res, 200, JSON.stringify(files), 'application/json; charset=utf-8');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/files')) {
      await listSeasonFiles(req, res);
      return;
    }

    const filePath = resolveStaticPath(req.url);
    if (!filePath) {
      send(res, 403, 'Forbidden');
      return;
    }

    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, mimeTypes[ext] || 'application/octet-stream');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      send(res, 404, 'Not found');
      return;
    }

    console.error(err);
    send(res, 500, 'Server error');
  }
});

server.listen(port, () => {
  console.log(`TTRL season data listening on port ${port}`);
});
