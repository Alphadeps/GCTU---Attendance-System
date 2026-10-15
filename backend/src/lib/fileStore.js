const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');

/**
 * File storage backed by the database (StoredFile table).
 *
 * The hosting disk (Render) is wiped on every restart and deploy, so files written to
 * public/uploads disappeared. Files are now stored in Postgres and served from
 * /api/files/<id>/<filename>. Old rows that still hold a /uploads/... URL are read from
 * disk as a fallback, so nothing that already works breaks.
 */

const FILE_URL_PREFIX = '/api/files/';
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function safeName(name) {
  const cleaned = String(name || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return (cleaned || 'file').slice(0, 120);
}

/** Save a buffer and return { id, url } where url is what to store in the DB / send to the client. */
async function saveFile({ buffer, filename, mimeType }) {
  const name = safeName(filename);
  const file = await prisma.storedFile.create({
    data: {
      filename: name,
      mimeType: mimeType || 'application/octet-stream',
      size: buffer.length,
      data: buffer
    },
    select: { id: true }
  });
  return { id: file.id, url: `${FILE_URL_PREFIX}${file.id}/${encodeURIComponent(name)}` };
}

function idFromUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(FILE_URL_PREFIX)) return null;
  const id = url.slice(FILE_URL_PREFIX.length).split('/')[0];
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/** Read a stored file by its URL. Returns a Buffer, or null if it no longer exists. */
async function readFileByUrl(url) {
  const id = idFromUrl(url);
  if (id) {
    const file = await prisma.storedFile.findUnique({ where: { id }, select: { data: true } });
    return file ? Buffer.from(file.data) : null;
  }
  // Legacy /uploads/... path on local disk (may be gone after a restart)
  if (typeof url === 'string' && url.startsWith('/uploads/')) {
    const filePath = path.join(PUBLIC_DIR, url);
    if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath)) return fs.readFileSync(filePath);
  }
  return null;
}

/** Replace the contents of an existing stored file (e.g. a regenerated report). */
async function overwriteFileByUrl(url, buffer) {
  const id = idFromUrl(url);
  if (!id) return false;
  const result = await prisma.storedFile.updateMany({ where: { id }, data: { data: buffer, size: buffer.length } });
  return result.count > 0;
}

/** Delete a stored file by URL (no-op for legacy or unknown URLs). */
async function deleteFileByUrl(url) {
  const id = idFromUrl(url);
  if (id) await prisma.storedFile.deleteMany({ where: { id } });
}

/** Express handler: GET /api/files/:id/:name? */
async function serveFile(req, res) {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'File not found' });
    const file = await prisma.storedFile.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Never let an uploaded file run as a web page on our domain
    const inlineSafe = /^image\/(png|jpe?g|gif|webp)$/.test(file.mimeType) || file.mimeType === 'application/pdf';
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // The frontend runs on a different domain; let it display these files (helmet defaults to same-origin)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Disposition', `${inlineSafe ? 'inline' : 'attachment'}; filename="${file.filename}"`);
    res.end(Buffer.from(file.data));
  } catch (err) {
    console.error('Serve file error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { saveFile, readFileByUrl, overwriteFileByUrl, deleteFileByUrl, serveFile, idFromUrl, FILE_URL_PREFIX };
