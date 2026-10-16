import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatePayoff,validatePayoff,recoveryTargets} from '../protected/payoff.js';
import {validateData,emptyData} from '../protected/finance.js';
import {payoffView} from '../protected/payoff-view.js';

const base={bank:100000,driver:30000,bankRate:0,driverRate:0,budget:20000,driverPayment:10000};
test('proposed reductions exclude existing installments, income and work subscriptions',()=>{
  const r=(category,amount,extra={})=>({month:'2026-10',type:'expense',description:'Example',category,amount,...extra});
  const result=recoveryTargets([r('Alimentação fora',10000),r('Alimentação fora',90000,{installments:3}),r('Alimentação fora',90000,{type:'income'}),r('Transporte',10000,{description:'Posto'}),r('Transporte',50000,{description:'Radiador'}),r('Assinaturas e software',2000,{description:'Netflix'}),r('Assinaturas e software',10000,{description:'Ferramenta de trabalho'})],'2026-10');
  assert.equal(result.grossSaving,8000);
  assert.deepEqual(result.cuts.map(r=>r.base),[10000,10000,2000]);
});
test('payments honor agreement, roll over released cash, and stop at exact payoff',()=>{
  const r=simulatePayoff(base);
  assert.equal(r.months,7);assert.equal(r.paid,130000);assert.equal(r.interest,0);
  assert.equal(r.schedule[0].toDriver,10000);assert.equal(r.schedule[3].toBank,20000);
  assert.equal(r.schedule.at(-1).paid,10000);
  assert.equal(r.schedule.at(-1).bank+r.schedule.at(-1).driver,0);
});
test('interest accrues before payment, rounds to cents and reconciles',()=>{
  const r=simulatePayoff({...base,bank:10001,driver:0,bankRate:1,budget:6000,driverPayment:0});
  assert.equal(r.months,2);assert.equal(r.interest,141);assert.equal(r.paid,10142);
  assert.equal(r.schedule[0].bank,4101);
  assert.equal(r.paid,10001+r.interest);
});
test('unused bank payment rolls to agreement in the same month',()=>{
  const r=simulatePayoff({...base,bank:100,driver:30000});
  assert.equal(r.schedule[0].toBank,100);assert.equal(r.schedule[0].toDriver,19900);
  assert.equal(r.paid,30100);
});
test('unknown rates, negative money and impossible budget cannot become a forecast',()=>{
  for(const change of [{bankRate:null},{driverRate:undefined},{bank:-1},{budget:0},{driverPayment:20001},{bank:1.2},{bankRate:Infinity},{driverRate:-1}])assert.throws(()=>simulatePayoff({...base,...change}));
  assert.equal(simulatePayoff({...base,bank:100000,bankRate:20,budget:1000,driverPayment:0}).complete,false);
});
test('integer balances and payments reconcile over multiple rates and budgets',()=>{
  for(const rate of [0,0.8,2.35,8])for(const budget of [10000,40000,100000]){
    const r=simulatePayoff({...base,bankRate:rate,driverRate:0.5,budget,driverPayment:5000});
    if(r.complete)assert.equal(r.paid,base.bank+base.driver+r.interest);
    for(const month of r.schedule){assert.ok(month.paid<=budget);assert.ok(month.bank>=0&&month.driver>=0);assert.ok(Number.isSafeInteger(month.bank));}
  }
});
const plan=()=>({version:1,updatedAt:'2026-10-16',debts:[{id:'bank',name:'Banco',balance:null,note:'Saldo desconhecido',scenarios:[100000]}],operation:null});
test('backup retains uncertainty and only projects known private plan fields',()=>{
  const p=plan();p.secret='never';
  const valid=validateData({...emptyData(),debtPlan:p});
  assert.equal(valid.debtPlan.debts[0].balance,null);assert.equal(valid.debtPlan.secret,undefined);
  assert.equal(validateData(emptyData()).debtPlan,null);
  assert.throws(()=>validatePayoff({...p,updatedAt:'2026-02-30'}));
  assert.throws(()=>validatePayoff({...p,debts:[p.debts[0],p.debts[0]]}));
});
test('operation cannot import inconsistent money, months or campaign totals',()=>{
  const p=plan();p.operation={from:'2026-10-01',to:'2026-10-16',count:1,gross:1000,net:900,fees:100,adSpend:200,usdNet:0,excludedBRLNet:0,excludedUSDNet:0,metaValue:1000,metaPurchases:1,monthly:[{month:'2026-10',count:1,net:900}],products:[{name:'Product',count:1,net:900}],campaigns:[{name:'Ad',status:'active',spend:200,purchases:1,value:1000}]};
  assert.equal(validatePayoff(p).operation.net,900);
  for(const patch of [{net:899},{adSpend:199},{monthly:[{month:'2026-13',count:1,net:900}]},{products:[]}])assert.throws(()=>validatePayoff({...p,operation:{...p.operation,...patch}}));
});
test('empty clients do not inherit debt data and imported labels are escaped',()=>{
  const ui={esc:s=>String(s).replaceAll('<','&lt;'),cash:n=>String(n),panelHead:(a,b)=>a+b};
  assert.match(payoffView(emptyData(),ui,false),/Nenhum plano/);
  const p=plan();p.debts[0].name='<img src=x onerror=alert(1)>';
  assert.ok(!payoffView({debtPlan:p},ui,false).includes('<img'));
});
