import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from '../protected/finance.js';

const client = process.argv[2];
if (!/^[a-z0-9-]+$/.test(client || '')) throw Error('Informe o cliente: node scripts/prepare-cloud-data.mjs felipe [backup.json]');
const root = fileURLToPath(new URL('../', import.meta.url));
const inputPath = process.argv[3] ? resolve(process.argv[3]) : resolve(root, `private/clients/${client}/data/finances.json`);
const outputPath = resolve(root, `private/cloudflare/data-${client}.json`);
const pick = (item, fields) => Object.fromEntries(fields.filter(field => item?.[field] !== undefined).map(field => [field, item[field]]));
const raw = JSON.parse(await readFile(inputPath, 'utf8'));
if (raw.clientId && raw.clientId !== client) throw Error('Este backup pertence a outro cliente.');
const input = validateData(raw);
const data = {
  version: 1,
  referenceMonth: input.referenceMonth,
  incomeComplete: input.incomeComplete,
  cards: input.cards.map(card => ({ ...pick(card, ['id', 'name', 'scope', 'total', 'limit', 'used', 'due', 'next', 'future', 'color', 'month', 'status']), file: 'Fatura importada' })),
  transactions: input.transactions.map(row => ({ ...pick(row, ['id', 'date', 'month', 'description', 'amount', 'account', 'category', 'type', 'installment', 'installments', 'futureAmount', 'review']), source: row.source === 'Registro manual' ? 'Registro manual' : 'Fatura importada' })),
  budgets: input.budgets,
  cashSnapshot: input.cashSnapshot && pick(input.cashSnapshot, ['amount', 'account', 'asOf']),
  receivables: input.receivables.map(item => pick(item, ['id', 'name', 'amount', 'expectedMonth', 'expectedDate', 'status'])),
  notes: []
};
validateData(data);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
console.log(`Cópia privada preparada em ${outputPath}`);
console.log(`${data.transactions.length} lançamentos, ${data.cards.length} faturas e ${data.receivables.length} recebíveis. Nenhum PDF, caminho de PDF ou credencial foi incluído.`);
