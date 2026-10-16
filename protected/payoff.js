// Money is stored in integer cents. Unknown balances and rates stay unknown.
const amount = x => Number.isSafeInteger(x) && x >= 0 && x <= 1e12;
const text = x => typeof x === 'string' && x.length <= 300;
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));
export function validatePayoff(p) {
  if (p == null) return null;
  const invalid = () => { throw Error('Plano de quitação inválido.'); };
  if (p.version !== 1 || !date(p.updatedAt) || !Array.isArray(p.debts) || p.debts.length > 20) invalid();
  const ids = new Set();
  const debts = p.debts.map(d => {
    if (!text(d.id) || !d.id || ids.has(d.id) || !text(d.name) || !text(d.note) || (d.balance !== null && !amount(d.balance)) || !Array.isArray(d.scenarios) || d.scenarios.length > 10 || d.scenarios.some(x => !amount(x))) invalid();
    ids.add(d.id);
    return pick(d, ['id','name','balance','note','scenarios']);
  });
  let operation = null;
  if (p.operation != null) {
    const o = p.operation;
    const keys = ['count','gross','net','fees','adSpend','usdNet','excludedBRLNet','excludedUSDNet','metaValue','metaPurchases'];
    if (!date(o.from) || !date(o.to) || o.to < o.from || keys.some(k => !amount(o[k])) || o.net + o.fees !== o.gross) invalid();
    const list = (key, fields, numbers) => {
      if (!Array.isArray(o[key]) || o[key].length > 200) invalid();
      return o[key].map(r => {
        if (fields.some(k => !text(r[k])) || numbers.some(k => !amount(r[k]))) invalid();
        return pick(r, [...fields,...numbers]);
      });
    };
    operation = {...pick(o,['from','to',...keys]),
      monthly:list('monthly',['month'],['count','net']),
      products:list('products',['name'],['count','net']),
      campaigns:list('campaigns',['name','status'],['spend','purchases','value'])};
    if (operation.monthly.some(r => !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) || operation.monthly.reduce((s,r)=>s+r.net,0)!==o.net || operation.products.reduce((s,r)=>s+r.net,0)!==o.net || operation.campaigns.reduce((s,r)=>s+r.spend,0)!==o.adSpend) invalid();
  }
  let recovery=null;
  if(p.recovery!=null){if(!amount(p.recovery.currentSpare)||!amount(p.recovery.monthlyGoal))invalid();recovery=pick(p.recovery,['currentSpare','monthlyGoal']);}
  return {version:1,updatedAt:p.updatedAt,debts,operation,recovery};
}

export function recoveryTargets(transactions,month){
  const rows=transactions.filter(r=>r.type==='expense'&&r.month===month&&!r.installments);
  const sum=rr=>rr.reduce((s,r)=>s+r.amount,0);
  const dining=sum(rows.filter(r=>r.category==='Alimentação fora'));
  const fuel=sum(rows.filter(r=>r.category==='Transporte'&&/posto|combust[ií]vel/i.test(r.description)));
  const streaming=rows.filter(r=>r.category==='Assinaturas e software'&&/netflix|amazonprime/i.test(r.description));
  const cuts=[{name:'Alimentação fora',base:dining,cut:Math.round(dining*.5),action:'Reduzir 50%: planejar refeições e limitar lanches e delivery. Descontar o custo extra de comer em casa.'},
    {name:'Combustível',base:fuel,cut:Math.round(fuel*.1),action:'Testar redução de 10% agrupando trajetos. Preservar os deslocamentos necessários ao trabalho.'},
    {name:'Streaming de uso pessoal',base:sum(streaming),cut:sum(streaming),action:'Revisar Netflix e Prime para pausa temporária, se forem recorrentes e dispensáveis. Confirmar renovação e eventual multa.'}];
  return {cuts,grossSaving:sum(cuts.map(r=>({amount:r.cut}))),streaming};
}

// Constant-rate scenario, end-of-month payments, no new purchases or fees.
// Driver allocation is honored first; released payments roll to the other debt.
export function simulatePayoff({bank,driver,bankRate,driverRate,budget,driverPayment}) {
  if (![bank,driver,budget,driverPayment].every(amount) || budget <= 0 || driverPayment > budget || ![bankRate,driverRate].every(r => typeof r === 'number' && Number.isFinite(r) && r >= 0 && r <= 100)) throw Error('Confira os saldos, taxas e pagamentos. A reserva para o acordo deve caber no orçamento.');
  const initial = bank + driver, schedule = [];
  let totalPaid = 0, totalInterest = 0;
  if (!initial) return {paid:0,interest:0,months:0,schedule,complete:true};
  for (let month=1;month<=600;month++) {
    const interestBank=Math.round(bank*bankRate/100), interestDriver=Math.round(driver*driverRate/100);
    bank+=interestBank;driver+=interestDriver;totalInterest+=interestBank+interestDriver;
    if (![bank,driver,totalInterest].every(Number.isSafeInteger) || bank+driver>1e14) break;
    let toDriver=Math.min(driver,driverPayment);
    const toBank=Math.min(bank,budget-toDriver);
    toDriver+=Math.min(driver-toDriver,budget-toDriver-toBank);
    bank-=toBank;driver-=toDriver;totalPaid+=toBank+toDriver;
    schedule.push({month,bank,driver,interest:interestBank+interestDriver,paid:toBank+toDriver,toBank,toDriver});
    if (!bank && !driver) return {paid:totalPaid,interest:totalInterest,months:month,schedule,complete:true};
  }
  return {paid:totalPaid,interest:totalInterest,months:null,schedule,complete:false};
}
