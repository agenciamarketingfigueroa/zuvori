import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import worker from '../worker/index.js';

test('Worker keeps financial data behind a server-checked session and separates clients', async () => {
  const pepper = randomBytes(32).toString('hex');
  const sessionKey = randomBytes(32).toString('hex');
  const password = 'senha-longa-de-teste-para-o-worker';
  const makeUser = (client, username) => {
    const salt = randomBytes(24).toString('base64url');
    const verifier = createHmac('sha256', Buffer.from(pepper, 'hex')).update(`${username}\0${password}\0${salt}`).digest('base64url');
    return { client, username, salt, verifier };
  };
  const keys = [];
  const env = {
    ZUVORI_USERS: JSON.stringify([makeUser('felipe', 'Felipe'), makeUser('delliz', 'Delliz')]),
    ZUVORI_AUTH_PEPPER: pepper,
    ZUVORI_SESSION_KEY: sessionKey,
    ZUVORI_DATA: { get: async key => { keys.push(key); return key === 'client:felipe' ? '{"owner":"felipe"}' : null; } },
    LOGIN_RATE: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: async request => new Response(new URL(request.url).pathname) }
  };
  const get = (path, cookie) => worker.fetch(new Request(`https://app.zuvori.com.br${path}`, { headers: cookie ? { Cookie: cookie } : {} }), env);
  const signIn = (username, enteredPassword) => worker.fetch(new Request('https://app.zuvori.com.br/auth/login', {
    method: 'POST', headers: { Origin: 'https://app.zuvori.com.br', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
    body: JSON.stringify({ username, password: enteredPassword })
  }), env);

  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/app.html')).status, 303);
  assert.equal((await get('/app.js')).status, 401);
  assert.equal((await get('/auth/session')).status, 401);
  assert.equal((await get('/api/data')).status, 401);
  assert.deepEqual(keys, []);
  assert.equal((await signIn('Felipe', 'errada')).status, 401);
  const login = await signIn('Felipe', password);
  assert.equal(login.status, 200);
  const cookie = login.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  const browserCookie = cookie.split(';')[0];
  assert.deepEqual(await (await get('/auth/session', browserCookie)).json(), { client: 'felipe', readOnly: true });
  assert.equal(await (await get('/api/data', browserCookie)).text(), '{"owner":"felipe"}');
  assert.equal((await get('/api/data', `${browserCookie}broken`)).status, 401);
  const delliz = await signIn('Delliz', password);
  assert.equal(delliz.status, 200);
  const empty = await (await get('/api/data', delliz.headers.get('Set-Cookie').split(';')[0])).json();
  assert.deepEqual(empty.transactions, []);
  assert.deepEqual(keys, ['client:felipe', 'client:delliz']);
});
