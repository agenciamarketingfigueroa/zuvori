import { mkdir, writeFile } from 'node:fs/promises';
import { createCredentialRecord } from './auth.mjs';

const clientId = process.argv[2];
if (!/^[a-z0-9-]+$/.test(clientId || '')) throw Error('Informe o identificador do cliente, por exemplo: node scripts/setup-auth.mjs delliz');
const folder = new URL(`../private/clients/${clientId}/`, import.meta.url);
const line = await new Promise((resolve, reject) => {
  let value = '';
  process.stdin.setEncoding('utf8');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on('data', chunk => {
    for (const char of chunk) {
      if (char === '\u0003') { reject(Error('Configuração cancelada.')); return; }
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
const record = await createCredentialRecord(username, password);
await mkdir(folder, { recursive: true });
await writeFile(new URL('auth.json', folder), `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
for (const name of ['data', 'sources', 'reports']) await mkdir(new URL(`${name}/`, folder), { recursive: true });
console.log('Credencial local configurada. Usuário e senha não foram gravados no código.');
