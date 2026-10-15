import http from 'node:http';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { verifyCredential } from './auth.mjs';

const publicRoot = new URL('../public/', import.meta.url);
const protectedRoot = new URL('../protected/', import.meta.url);
const clientsRoot = new URL('../private/clients/', import.meta.url);
const publicFiles = new Set(['index.html', 'login.css', 'login.js', 'assets/symbol.svg', 'assets/wordmark.svg']);
const protectedFiles = new Set(['app.html', 'app.js', 'finance.js', 'insights.js', 'insights-view.js', 'style.css']);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const sessionName = 'zuvori_session';
const sessionDuration = 8 * 60 * 60 * 1000;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" };
const send = (res, status, body, extra = {}) => res.writeHead(status, { ...headers, ...extra }).end(body);
const json = (res, status, value, extra = {}) => send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8', ...extra });
const cookieFor = (value, maxAge) => `${sessionName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

export async function loadClients(root = clientsRoot) {
  const entries = await readdir(root, { withFileTypes: true });
  const clients = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-z0-9-]+$/.test(entry.name)) continue;
    const folder = new URL(`${entry.name}/`, root);
    let credential;
    try { credential = JSON.parse(await readFile(new URL('auth.json', folder), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    clients.push({ id: entry.name, credential, financeFile: new URL('data/finances.json', folder) });
  }
  if (!clients.length) throw Error('Nenhum cliente com credencial configurada em private/clients/.');
  return clients;
}

export function createAppServer({ clients, previewPort = 5500 }) {
  if (!Array.isArray(clients) || !clients.length || clients.some(client => !/^[a-z0-9-]+$/.test(client.id))) throw Error('Clientes locais inválidos.');
  const sessions = new Map();
  const failures = new Map();
  const sessionFor = req => {
    const raw = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionName}=`))?.slice(sessionName.length + 1);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    const key = sha256(raw);
    const session = sessions.get(key);
    if (!session) return null;
    if (session.expires <= Date.now()) { sessions.delete(key); return null; }
    return session.client;
  };

  return http.createServer(async (req, res) => {
    try {
      const allowedHosts = new Set([`127.0.0.1:${req.socket.localPort}`, `localhost:${req.socket.localPort}`, `127.0.0.1:${previewPort}`, `localhost:${previewPort}`]);
      const allowedOrigins = new Set([...allowedHosts].map(host => `http://${host}`));
      if (!allowedHosts.has(req.headers.host)) return send(res, 403, 'Host não autorizado.');
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
      if (req.method === 'POST') {
        if (!allowedOrigins.has(req.headers.origin)) return json(res, 403, { error: 'Origem não autorizada.' });
        if (pathname === '/auth/logout') {
          const raw = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionName}=`))?.slice(sessionName.length + 1);
          if (raw) sessions.delete(sha256(raw));
          return json(res, 200, { ok: true }, { 'Set-Cookie': cookieFor('', 0) });
        }
        if (pathname !== '/auth/login') return json(res, 404, { error: 'Não encontrado.' });
        const peer = req.socket.remoteAddress || 'local';
        const attempt = failures.get(peer);
        if (attempt?.until > Date.now()) return json(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Formato inválido.' });
        let size = 0;
        const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 1024) return json(res, 413, { error: 'Requisição muito grande.' }); chunks.push(chunk); }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { error: 'Requisição inválida.' }); }
        let client = null;
        for (const candidate of clients) {
          if (await verifyCredential(candidate.credential, body.username, body.password)) { client = candidate; break; }
        }
        if (!client) {
          const count = attempt && Date.now() - attempt.first < 60_000 ? attempt.count + 1 : 1;
          failures.set(peer, { count, first: count === 1 ? Date.now() : attempt.first, until: count >= 5 ? Date.now() + 60_000 : 0 });
          return json(res, 401, { error: 'Usuário ou senha incorretos.' });
        }
        failures.delete(peer);
        const token = randomBytes(32).toString('hex');
        sessions.set(sha256(token), { client, expires: Date.now() + sessionDuration });
        return json(res, 200, { ok: true, redirect: '/app.html' }, { 'Set-Cookie': cookieFor(token, sessionDuration / 1000) });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método não permitido.');
      const client = sessionFor(req);
      if (pathname === '/auth/session') {
        if (!client) return json(res, 401, { error: 'Acesso necessário.' });
        return json(res, 200, { client: client.id });
      }
      if (pathname === '/__local-data') {
        if (!client) return json(res, 401, { error: 'Acesso necessário.' });
        let data;
        try { data = await readFile(client.financeFile); }
        catch (error) { if (error.code === 'ENOENT') return json(res, 404, { error: 'Nenhuma base inicial para este cliente.' }); throw error; }
        return send(res, 200, req.method === 'HEAD' ? '' : data, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      const name = pathname.slice(1);
      const isPublic = publicFiles.has(name);
      if (!isPublic && !protectedFiles.has(name)) return send(res, 404, 'Não encontrado.');
      if (!isPublic && !client) {
        if (name === 'app.html') return send(res, 303, '', { Location: '/' });
        return send(res, 401, 'Acesso necessário.');
      }
      if (name === 'index.html' && client) return send(res, 303, '', { Location: '/app.html' });
      const base = isPublic ? publicRoot : protectedRoot;
      const data = await readFile(new URL(name, base));
      const extension = name.slice(name.lastIndexOf('.'));
      send(res, 200, req.method === 'HEAD' ? '' : data, { 'Content-Type': contentTypes[extension] || 'application/octet-stream' });
    } catch (error) {
      console.error('Zuvori local:', error.message);
      send(res, 500, 'Erro ao abrir o Zuvori.');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Porta inválida.');
  const clients = await loadClients();
  createAppServer({ clients }).listen(port, '127.0.0.1', () => console.log(`Zuvori protegido: http://127.0.0.1:${port}`));
}
