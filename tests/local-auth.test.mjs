import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCredentialRecord } from '../scripts/auth.mjs';
import { createAppServer } from '../scripts/serve.mjs';

test('local preview protects app files and financial data with a server session', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zuvori-auth-'));
  const financeFile = path.join(directory, 'finances.json');
  await writeFile(financeFile, '{"private":"felipe-only"}');
  const clients = [
    { id: 'felipe', credential: await createCredentialRecord('Pessoa de Teste', 'test-only-password'), financeFile },
    { id: 'delliz', credential: await createCredentialRecord('Outra Pessoa', 'other-test-password'), financeFile: path.join(directory, 'empty.json') }
  ];
  const server = createAppServer({ clients });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, options = {}) => fetch(base + route, { redirect: 'manual', ...options });
  try {
    assert.equal((await request('/')).status, 200);
    const manifest = await request('/manifest.webmanifest');
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get('content-type'), /application\/manifest\+json/);
    assert.equal((await manifest.json()).display, 'standalone');
    const touchIcon = await request('/apple-touch-icon.png');
    assert.equal(touchIcon.status, 200);
    assert.match(touchIcon.headers.get('content-type'), /image\/png/);
    assert.equal((await request('/app.html')).status, 303);
    assert.equal((await request('/app.js')).status, 401);
    assert.equal((await request('/finance.js')).status, 401);
    assert.equal((await request('/payoff.js')).status, 401);
    assert.equal((await request('/payoff-view.js')).status, 401);
    assert.equal((await request('/auth/session')).status, 401);
    assert.equal((await request('/__local-data')).status, 401);
    assert.equal((await request('/private/finances.json')).status, 404);

    const login = (username, password, origin = base) => request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ username, password }) });
    assert.equal((await login('Pessoa de Teste', 'wrong')).status, 401);
    assert.equal((await login('Pessoa de Teste', 'test-only-password', 'http://elsewhere.test')).status, 403);
    const success = await login('Pessoa de Teste', 'test-only-password');
    assert.equal(success.status, 200);
    const cookie = success.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const cookieHeader = cookie.split(';')[0];
    assert.equal((await request('/app.html', { headers: { Cookie: cookieHeader } })).status, 200);
    assert.equal((await request('/app.js', { headers: { Cookie: cookieHeader } })).status, 200);
    assert.equal((await request('/payoff-view.js', { headers: { Cookie: cookieHeader } })).status, 200);
    assert.deepEqual(await (await request('/auth/session', { headers: { Cookie: cookieHeader } })).json(), { client: 'felipe' });
    assert.deepEqual(await (await request('/__local-data', { headers: { Cookie: cookieHeader } })).json(), { private: 'felipe-only' });
    const other = await login('Outra Pessoa', 'other-test-password');
    assert.equal(other.status, 200);
    const otherCookie = other.headers.get('set-cookie').split(';')[0];
    assert.deepEqual(await (await request('/auth/session', { headers: { Cookie: otherCookie } })).json(), { client: 'delliz' });
    assert.equal((await request('/__local-data', { headers: { Cookie: otherCookie } })).status, 404);
    assert.equal((await request('/private/clients/felipe/data/finances.json', { headers: { Cookie: otherCookie } })).status, 404);
    const logout = await request('/auth/logout', { method: 'POST', headers: { Cookie: cookieHeader, Origin: base } });
    assert.equal(logout.status, 200);
    assert.equal((await request('/__local-data', { headers: { Cookie: cookieHeader } })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
