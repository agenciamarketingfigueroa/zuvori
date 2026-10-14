export const categories=['Publicidade','Casa e reforma','Mercado','Alimentação fora','Transporte','Saúde','Assinaturas e software','Telefone','Impostos e tarifas','Seguros','Empréstimos','A classificar'];
export const colors=['#638aef','#ac92ef','#55bfa5','#e5ad6e','#dd7c88','#81b5ce','#c2ac76','#959ae5','#a1a9b5','#71a5a2','#bd93a4','#7f8590'];
export const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export const emptyData=()=>({version:1,referenceMonth:'2026-10',incomeComplete:[],cards:[],transactions:[],budgets:{},notes:[]});
export function summary(rows){const expenses=rows.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);const income=rows.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);return {expenses,income,balance:income-expenses,count:rows.length};}
export function group(rows,key){return Object.entries(rows.reduce((s,r)=>{s[r[key]]=(s[r[key]]||0)+r.amount;return s;},{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);}
export function addMonths(month,n){const [y,m]=month.split('-').map(Number);const date=new Date(Date.UTC(y,m-1+n,1));return date.toISOString().slice(0,7);}
export function project(rows,month,count=6){return Array.from({length:count},(_,i)=>({month:addMonths(month,i+1),value:rows.filter(r=>r.type==='expense'&&r.month===month&&r.installments&&r.installment+i+1<=r.installments).reduce((s,r)=>s+(r.futureAmount??r.amount),0)}));}
export function validateData(input){
  if(!input||input.version!==1||!Array.isArray(input.transactions)||!Array.isArray(input.cards)||!Array.isArray(input.incomeComplete)||!input.budgets||typeof input.budgets!=='object'||Array.isArray(input.budgets))throw Error('Arquivo Zuvori inválido. Importe um backup JSON exportado pelo aplicativo.');
  if(input.transactions.length>20000||input.cards.length>100)throw Error('Arquivo acima do limite deste protótipo.');
  const validMonth=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
  const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  const safeString=x=>typeof x==='string'&&x.length<=300;
  const amount=x=>Number.isSafeInteger(x)&&x>=0&&x<=1e12;
  if(!validMonth(input.referenceMonth)||input.incomeComplete.some(x=>!validMonth(x)))throw Error('Competência inválida.');
  const ids=new Set(); const cardIds=new Set();
  for(const c of input.cards){if(!safeString(c.id)||cardIds.has(c.id)||['mary','manual'].includes(c.id)||!safeString(c.name)||!validMonth(c.month)||!validDate(c.due)||!amount(c.total)||!amount(c.limit)||!amount(c.used)||!amount(c.next)||!amount(c.future))throw Error('Cartão inválido no backup.');cardIds.add(c.id);}
  for(const r of input.transactions){
    if(!safeString(r.id)||ids.has(r.id)||!safeString(r.description)||!amount(r.amount)||r.amount===0||!validMonth(r.month)||![null,undefined].includes(r.date)&&!validDate(r.date)||!['expense','income'].includes(r.type)||!safeString(r.category)||!safeString(r.account)||!['manual','mary',...cardIds].includes(r.account))throw Error('Lançamento inválido ou duplicado no arquivo.');
    if((r.installments==null)!==(r.installment==null)||r.installments!=null&&(!Number.isInteger(r.installments)||!Number.isInteger(r.installment)||r.installments<1||r.installments>600||r.installment<1||r.installment>r.installments))throw Error('Parcelamento inválido.');
    if(r.futureAmount!=null&&!amount(r.futureAmount))throw Error('Valor futuro inválido.');
    if(r.source!=null&&!safeString(r.source))throw Error('Origem inválida.');
    if(r.review!=null&&typeof r.review!=='boolean')throw Error('Revisão inválida.');
    ids.add(r.id);
  }
  if(!Number.isSafeInteger(input.transactions.reduce((total,row)=>total+row.amount,0)))throw Error('Total excede a precisão suportada.');
  for(const [month,limit] of Object.entries(input.budgets)){if(!validMonth(month)||!amount(limit))throw Error('Meta inválida.');}
  // Project only known fields, keeping imported metadata out of HTML and styles.
  return {...emptyData(),referenceMonth:input.referenceMonth,incomeComplete:input.incomeComplete,cards:input.cards.map(c=>({...c,color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:'#949aa4',status:['paid','unknown'].includes(c.status)?c.status:'unknown'})),transactions:input.transactions,budgets:input.budgets,notes:Array.isArray(input.notes)?input.notes.filter(safeString):[]};
}
export function parseMoney(s){const cleaned=String(s).trim().replace(/\s|R\$/g,'');if(!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned))throw Error('Use um valor como 1250,50, sem separador de milhar.');const [whole,decimal='']=cleaned.replace(',','.').split('.');const value=Number(whole)*100+Number(decimal.padEnd(2,'0'));if(!Number.isSafeInteger(value)||value<=0||value>1e12)throw Error('Informe um valor maior que zero.');return value;}
