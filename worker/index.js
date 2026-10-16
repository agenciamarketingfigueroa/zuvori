const cookieName = 'zuvori_session';
const sessionSeconds = 8 * 60 * 60;
const encoder = new TextEncoder();
const headers = {
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};
const publicAssets = new Set(['/index.html', '/login.js', '/login.css', '/assets/symbol.svg', '/assets/wordmark.svg', '/apple-touch-icon.png', '/assets/icon-192.png', '/assets/icon-512.png', '/manifest.webmanifest', '/robots.txt']);
const hexBytes = value => {
  if (typeof value !== 'string' || !/^(?:[a-f\d]{2}){32,}$/i.test(value)) throw Error('Chave inválida.');
  return Uint8Array.from(value.match(/../g), pair => Number.parseInt(pair, 16));
};
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unbase64url = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
const response = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...headers, ...extra } });
const json = (value, status = 200, extra = {}) => response(JSON.stringify(value), status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
const redirect = path => response(null, 303, { Location: path });
const cookie = (value, maxAge) => `${cookieName}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
const hmacKey = value => crypto.subtle.importKey('raw', hexBytes(value), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const sign = (key, message) => crypto.subtle.sign('HMAC', key, encoder.encode(message));
const safeConfig = env => {
  if (!env.ZUVORI_USERS || !env.ZUVORI_AUTH_PEPPER || !env.ZUVORI_SESSION_KEY || !env.ZUVORI_DATA || !env.ASSETS || !env.LOGIN_RATE) throw Error('Configuração privada incompleta.');
  const users = JSON.parse(env.ZUVORI_USERS);
  if (!Array.isArray(users)) throw Error('Configuração de usuários inválida.');
  return users;
};

async function sessionFor(request, env) {
  const match = request.headers.get('Cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  const token = match?.slice(cookieName.length + 1);
  if (!token || token.length > 1024 || !/^[A-Za-z\d_-]+\.[A-Za-z\d_-]+$/.test(token)) return null;
  const [payload, signature] = token.split('.');
  try {
    const key = await hmacKey(env.ZUVORI_SESSION_KEY);
    if (!await crypto.subtle.verify('HMAC', key, unbase64url(signature), encoder.encode(payload))) return null;
    const claims = JSON.parse(new TextDecoder().decode(unbase64url(payload)));
    if (!/^[a-z0-9-]+$/.test(claims.client) || !Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    const users = safeConfig(env);
    return users.some(user => user.client === claims.client) ? claims.client : null;
  } catch { return null; }
}

async function login(request, env, origin) {
  if (request.headers.get('Origin') !== origin) return json({ error: 'Origem não autorizada.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Formato inválido.' }, 415);
  if (Number(request.headers.get('Content-Length')) > 2048) return json({ error: 'Requisição muito grande.' }, 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: 'Requisição muito grande.' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Requisição inválida.' }, 400); }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || username.length > 150 || !password || password.length > 256) return json({ error: 'Usuário ou senha incorretos.' }, 401);
  const actor = `${request.headers.get('CF-Connecting-IP') || 'unknown'}:${username.toLowerCase()}`;
  const allowed = await env.LOGIN_RATE.limit({ key: actor });
  if (!allowed.success) return json({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429);
  const users = safeConfig(env);
  const user = users.find(item => item.username === username);
  if (!user) return json({ error: 'Usuário ou senha incorretos.' }, 401);
  const key = await hmacKey(env.ZUVORI_AUTH_PEPPER);
  const expected = unbase64url(user.verifier);
  if (!await crypto.subtle.verify('HMAC', key, expected, encoder.encode(`${username}\0${password}\0${user.salt}`))) return json({ error: 'Usuário ou senha incorretos.' }, 401);
  if (!/^[a-z0-9-]+$/.test(user.client)) return json({ error: 'Configuração de conta inválida.' }, 503);
  const payload = base64url(encoder.encode(JSON.stringify({ client: user.client, exp: Math.floor(Date.now() / 1000) + sessionSeconds })));
  const sessionKey = await hmacKey(env.ZUVORI_SESSION_KEY);
  const signature = base64url(new Uint8Array(await sign(sessionKey, payload)));
  return json({ ok: true, redirect: '/app.html' }, 200, { 'Set-Cookie': cookie(`${payload}.${signature}`, sessionSeconds) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    try {
      if (path === '/auth/login') return request.method === 'POST' ? login(request, env, url.origin) : response('Método não permitido.', 405);
      if (path === '/auth/logout') {
        if (request.method !== 'POST') return response('Método não permitido.', 405);
        if (request.headers.get('Origin') !== url.origin) return response('Origem não autorizada.', 403);
        return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
      }
      if (!['GET', 'HEAD'].includes(request.method)) return response('Método não permitido.', 405);
      if (publicAssets.has(path)) return protectedAsset(request, env);
      const client = await sessionFor(request, env);
      if (path === '/auth/session') return client ? json({ client, readOnly: true }) : json({ error: 'Acesso necessário.' }, 401);
      if (!client) return path === '/app.html' ? redirect('/') : response('Acesso necessário.', 401);
      if (path === '/api/data') {
        if (!env.ZUVORI_DATA) return json({ error: 'Armazenamento indisponível.' }, 503);
        const value = await env.ZUVORI_DATA.get(`client:${client}`);
        const empty = { version: 1, referenceMonth: new Date().toISOString().slice(0, 7), incomeComplete: [], cards: [], transactions: [], budgets: {}, cashSnapshot: null, receivables: [], notes: [] };
        return value === null ? json(empty) : response(request.method === 'HEAD' ? null : value, 200, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      if (path === '/index.html') return redirect('/app.html');
      return protectedAsset(request, env);
    } catch (error) {
      console.error('Zuvori Worker:', error?.message);
      return response('Servidor privado indisponível.', 503);
    }
  }
};

async function protectedAsset(request, env) {
  if (!env.ASSETS) return response('Arquivos do aplicativo indisponíveis.', 503);
  const asset = await env.ASSETS.fetch(request);
  const result = new Response(asset.body, asset);
  for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
  return result;
}
