import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../services/domain/errors.js';
import { createRouter } from './router.js';

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
const MAX_JSON_BYTES = 1024 * 1024;
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};
const ERROR_STATUSES = {
  BAD_JSON: 400,
  INVALID_STATE: 409,
  INVALID_TRANSITION: 409,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  SOLD_OUT: 409,
  VALIDATION: 400,
};

function sendJson(response, status, value, method) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(method === 'HEAD' ? undefined : body);
}

function sendError(response, status, code, message, method) {
  sendJson(response, status, { error: { code, message } }, method);
}

async function readJsonBody(request) {
  if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
    return undefined;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) {
      throw new DomainError('PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
    chunks.push(chunk);
  }

  if (size === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DomainError('BAD_JSON', 'Request body must contain valid JSON');
  }
}

function isWithinDirectory(directory, filePath) {
  const relativePath = path.relative(directory, filePath);
  return relativePath === ''
    || (relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath));
}

async function serveStatic(publicDir, url, request, response) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    sendError(response, 404, 'NOT_FOUND', 'File not found', request.method);
    return;
  }

  const relativeRequestPath = decodedPath === '/'
    ? 'index.html'
    : decodedPath.replace(/^[/\\]+/, '');
  const candidatePath = path.resolve(publicDir, relativeRequestPath);
  if (!isWithinDirectory(publicDir, candidatePath)) {
    sendError(response, 404, 'NOT_FOUND', 'File not found', request.method);
    return;
  }

  try {
    const realPublicDir = await realpath(publicDir);
    const realFilePath = await realpath(candidatePath);
    if (!isWithinDirectory(realPublicDir, realFilePath) || !(await stat(realFilePath)).isFile()) {
      sendError(response, 404, 'NOT_FOUND', 'File not found', request.method);
      return;
    }

    const body = await readFile(realFilePath);
    response.writeHead(200, {
      'content-length': body.length,
      'content-type': CONTENT_TYPES[path.extname(realFilePath).toLowerCase()] ?? 'application/octet-stream',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    sendError(response, 404, 'NOT_FOUND', 'File not found', request.method);
  }
}

export function createApp({ publicDir = DEFAULT_PUBLIC_DIR, router = createRouter() } = {}) {
  router.add('GET', '/health', () => ({ status: 'ok' }));
  const resolvedPublicDir = path.resolve(publicDir);

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const body = await readJsonBody(request);
      const route = router.match(request.method, url.pathname);

      if (route) {
        const result = await route.handler({ request, params: route.params, body, url });
        if (result === undefined) {
          response.writeHead(204);
          response.end();
        } else {
          sendJson(response, 200, result, request.method);
        }
        return;
      }

      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        sendError(response, 404, 'NOT_FOUND', 'API route not found', request.method);
        return;
      }

      if (request.method === 'GET' || request.method === 'HEAD') {
        await serveStatic(resolvedPublicDir, url, request, response);
        return;
      }

      sendError(response, 404, 'NOT_FOUND', 'Route not found', request.method);
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }

      if (error instanceof DomainError) {
        sendError(response, ERROR_STATUSES[error.code] ?? 400, error.code, error.message, request.method);
        return;
      }

      sendError(response, 500, 'INTERNAL_ERROR', 'An unexpected error occurred', request.method);
    }
  });
}