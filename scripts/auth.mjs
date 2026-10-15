import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const settings = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const normalizeUser = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
const material = (username, password) => `${normalizeUser(username)}\0${password}`;

export async function createCredentialRecord(username, password) {
  if (typeof username !== 'string' || !normalizeUser(username) || typeof password !== 'string' || !password) throw Error('Credencial inválida.');
  const salt = randomBytes(32);
  const hash = await scrypt(material(username, password), salt, 64, settings);
  return { version: 1, salt: salt.toString('base64'), hash: hash.toString('base64') };
}

export async function verifyCredential(record, username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 200 || password.length > 200) return false;
  const salt = Buffer.from(record.salt, 'base64');
  const expected = Buffer.from(record.hash, 'base64');
  if (record.version !== 1 || salt.length !== 32 || expected.length !== 64) throw Error('Configuração de acesso inválida.');
  const actual = await scrypt(material(username, password), salt, 64, settings);
  return timingSafeEqual(actual, expected);
}
