import { it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../app.js';
import { createRouter } from '../router.js';
import { startServer } from '../../server.js';

it('serves health and public files, returns JSON errors, and blocks paths outside public', async (testContext) => {
  const temporaryDir = await mkdtemp(path.join(tmpdir(), 'ticketing-http-'));
  const publicDir = path.join(temporaryDir, 'public');
  await mkdir(publicDir);
  await writeFile(path.join(publicDir, 'index.html'), '<h1>Ticketing</h1>');
  await writeFile(path.join(temporaryDir, 'secret.txt'), 'not public');

  const router = createRouter()
    .add('POST', '/api/events', ({ body }) => ({ received: body }))
    .add('GET', '/api/failure', () => {
      throw new Error('secret stack details');
    });
  const server = createApp({ publicDir, router });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  testContext.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(temporaryDir, { recursive: true, force: true });
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const jsonResponse = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Demo' }),
  });
  assert.deepEqual(await jsonResponse.json(), { received: { title: 'Demo' } });

  const staticResponse = await fetch(`${baseUrl}/`);
  assert.equal(await staticResponse.text(), '<h1>Ticketing</h1>');

  const badJsonResponse = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(badJsonResponse.status, 400);
  const badJson = await badJsonResponse.json();
  assert.deepEqual(Object.keys(badJson), ['error']);
  assert.deepEqual(Object.keys(badJson.error), ['code', 'message']);
  assert.equal(badJson.error.code, 'BAD_JSON');

  const missingApiResponse = await fetch(`${baseUrl}/api/missing`);
  assert.equal(missingApiResponse.status, 404);
  assert.deepEqual(await missingApiResponse.json(), {
    error: { code: 'NOT_FOUND', message: 'API route not found' },
  });

  const failureResponse = await fetch(`${baseUrl}/api/failure`);
  const failure = await failureResponse.json();
  assert.equal(failureResponse.status, 500);
  assert.deepEqual(failure, {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
  assert.equal(JSON.stringify(failure).includes('secret stack'), false);

  const traversalResponse = await fetch(`${baseUrl}/%2e%2e%2fsecret.txt`);
  assert.equal(traversalResponse.status, 404);
  assert.deepEqual(await traversalResponse.json(), {
    error: { code: 'NOT_FOUND', message: 'File not found' },
  });
});

it('starts through the server entry point and answers a real health request', async () => {
  const server = startServer(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});