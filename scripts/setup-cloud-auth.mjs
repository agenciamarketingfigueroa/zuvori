import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const client = process.argv[2];
if (!/^[a-z0-9-]+$/.test(client || '')) throw Error('Informe o cliente: node scripts/setup-cloud-auth.mjs felipe');
const directory = new URL('../private/cloudflare/', import.meta.url);
const usersPath = new URL('users.json', directory);
const pepperPath = new URL('auth-pepper.txt', directory);
const sessionPath = new URL('session-key.txt', directory);

async function readOrCreateSecret(path) {
  try { return (await readFile(path, 'utf8')).trim(); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const value = randomBytes(32).toString('hex');
    await writeFile(path, value, { flag: 'wx', mode: 0o600 });
    return value;
  }
}

if (!process.argv.includes('--stdin-json')) process.stdout.write('Digite uma linha JSON com username e uma NOVA password de pelo menos 16 caracteres. A entrada ficará oculta.\n');
const line = await new Promise((resolve, reject) => {
  let value = '';
  process.stdin.setEncoding('utf8');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on('data', chunk => {
    for (const char of chunk) {
      if (char === '\u0003') { if (process.stdin.isTTY) process.stdin.setRawMode(false); reject(Error('Cancelado.')); return; }
      if (char === '\u007f' || char === '\b') { value = value.slice(0, -1); continue; }
      if (char === '\r' || char === '\n') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(value);
        return;
      }
      value += char;
    }
  });
});
const { username, password } = JSON.parse(line);
if (typeof username !== 'string' || !username.trim() || username.length > 150 || typeof password !== 'string' || password.length < 16 || password.length > 256) throw Error('Usuário inválido ou senha fora do intervalo de 16 a 256 caracteres.');
let users = [];
try { users = JSON.parse(await readFile(usersPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!Array.isArray(users)) throw Error('Arquivo de usuários inválido.');
const existingIndex = users.findIndex(user => user.client === client);
if (users.some((user, index) => index !== existingIndex && user.username === username.trim())) throw Error('Este usuário já pertence a outro cliente.');
await mkdir(directory, { recursive: true });
const pepper = await readOrCreateSecret(pepperPath);
await readOrCreateSecret(sessionPath);
const salt = randomBytes(24).toString('base64url');
const verifier = createHmac('sha256', Buffer.from(pepper, 'hex')).update(`${username.trim()}\0${password}\0${salt}`).digest('base64url');
const record = { client, username: username.trim(), salt, verifier };
if (existingIndex >= 0) users[existingIndex] = record;
else users.push(record);
await writeFile(usersPath, `${JSON.stringify(users, null, 2)}\n`, { mode: 0o600 });
console.log(`Credencial para o Worker ${existingIndex >= 0 ? 'atualizada' : 'preparada'} em private/cloudflare/. Nenhuma senha foi gravada em texto puro.`);
