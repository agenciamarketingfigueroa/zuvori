import test from 'node:test';
import assert from 'node:assert/strict';
import {spendingIndicators,installmentInsights,savingScenario} from '../protected/insights.js';

const row=(extra={})=>({id:'example',description:'Exemplo',amount:10000,type:'expense',month:'2026-12',category:'Equipamentos de trabalho',...extra});

test('spending indicators separate fuel from repairs, and ignore income and other months',()=>{
  const rows=[row({description:'POSTO FELIPE',category:'Transporte',amount:5000}),row({description:'Radiador',category:'Transporte',amount:8000}),row({description:'Uber',category:'Transporte',amount:2000}),row({category:'Assinaturas e software',amount:3000}),row({category:'Alimentação fora',amount:4000}),row({category:'Transporte',description:'Posto',type:'income',amount:99000}),row({category:'Transporte',description:'Posto',month:'2026-11',amount:99000})];
  const groups=spendingIndicators(rows,'2026-12');
  assert.equal(groups.find(x=>x.id==='fuel').amount,5000);
  assert.equal(groups.find(x=>x.id==='mobility').amount,10000);
  assert.equal(groups.find(x=>x.id==='fuel').share,5000/22000);
  assert.equal(groups.reduce((total,item)=>total+item.amount,0),22000);
});

test('purchase horizon excludes loans, honors future cents and year boundary',()=>{
  const plan=installmentInsights([row({installment:1,installments:3,amount:10002,futureAmount:10000}),row({installment:3,installments:3,amount:2000}),row({category:'Empréstimos',installment:1,installments:48,amount:50000}),row({description:'Mapfre*Pcl4de10',category:'Seguros',amount:7000})],'2026-12');
  assert.equal(plan.current,12002);
  assert.equal(plan.future,20000);
  assert.equal(plan.ending,2000);
  assert.equal(plan.nextRelease,2002);
  assert.equal(plan.firstFreeMonth,'2027-03');
  assert.equal(plan.loanCurrent,50000);
  assert.equal(plan.uncertain.length,1);
  assert.deepEqual(plan.timeline.map(x=>x.value),[10000,10000,0,0,0,0]);
});

test('savings exclude installments from cut base and accumulate release once per month',()=>{
  const rows=[row({category:'Alimentação fora',amount:10000}),row({category:'Assinaturas e software',amount:6000,installment:2,installments:3}),row({category:'Assinaturas e software',amount:2000})];
  const indicators=spendingIndicators(rows,'2026-12'),plan=installmentInsights(rows,'2026-12');
  const scenario=savingScenario(indicators,plan,{dining:20,subscriptions:50,fuel:5},10000);
  assert.equal(scenario.monthly,3000);
  assert.equal(scenario.nextPotential,3000);
  assert.equal(scenario.sixMonthPotential,3000*6+6000*5);
  assert.equal(scenario.monthsToTarget,4);
});

test('empty data and zero cuts produce no fabricated deadline or savings',()=>{
  const plan=installmentInsights([],'2026-12');
  assert.equal(plan.firstFreeMonth,null);
  assert.equal(plan.share,0);
  const scenario=savingScenario(spendingIndicators([],'2026-12'),plan,{dining:0},60000);
  assert.equal(scenario.monthly,0);
  assert.equal(scenario.monthsToTarget,null);
  assert.equal(scenario.sixMonthPotential,0);
});
