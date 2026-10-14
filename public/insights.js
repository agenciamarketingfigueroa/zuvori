import {addMonths, project} from './finance.js';

const sum=rows=>rows.reduce((total,row)=>total+row.amount,0);
const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const isFuel=row=>row.category==='Combustível'||row.category==='Transporte'&&/\b(posto|combustivel|gasolina|etanol|diesel)\b/.test(normalized(row.description));

// These are views of existing expenses, never additional transactions.
export function spendingIndicators(transactions,month){
  const rows=transactions.filter(row=>row.type==='expense'&&row.month===month);
  const definitions=[
    ['subscriptions','Assinaturas e software','Cobranças no mês · periodicidade a confirmar',row=>row.category==='Assinaturas e software'],
    ['fuel','Combustível','Estimado por postos e descrições · confira os itens',isFuel],
    ['dining','Alimentação fora','Restaurantes, lanches, cafés e similares',row=>row.category==='Alimentação fora'],
    ['groceries','Mercado','Compras classificadas como mercado',row=>row.category==='Mercado'],
    ['mobility','Carro e deslocamentos','Transporte sem combustível · inclui manutenção',row=>row.category==='Transporte'&&!isFuel(row)],
    ['advertising','Publicidade','Custo da operação · confira verbas de clientes',row=>row.category==='Publicidade'],
  ];
  const total=sum(rows);
  return definitions.map(([id,label,note,select])=>{
    const items=rows.filter(select),amount=sum(items);
    // Existing installments are commitments, not immediately avoidable spending.
    return {id,label,note,items,amount,count:items.length,share:total?amount/total:0,flexibleAmount:sum(items.filter(row=>!row.installments))};
  });
}

export function installmentInsights(transactions,month){
  const all=transactions.filter(row=>row.type==='expense'&&row.month===month&&row.installments);
  const purchases=all.filter(row=>row.category!=='Empréstimos');
  const loans=all.filter(row=>row.category==='Empréstimos');
  const remaining=row=>row.installments-row.installment;
  const current=sum(purchases);
  const ending=purchases.filter(row=>remaining(row)===0);
  const future=purchases.reduce((total,row)=>total+remaining(row)*(row.futureAmount??row.amount),0);
  const monthsLeft=Math.max(0,...purchases.map(remaining));
  const timeline=project(purchases,month,6).map(item=>({...item,released:Math.max(0,current-item.value)}));
  return {purchases,loans,current,future,ending:sum(ending),endingCount:ending.length,loanCurrent:sum(loans),
    next:timeline[0].value,nextRelease:Math.max(0,current-timeline[0].value),timeline,
    share:sum(transactions.filter(row=>row.type==='expense'&&row.month===month))?current/sum(transactions.filter(row=>row.type==='expense'&&row.month===month)):0,
    firstFreeMonth:purchases.length?addMonths(month,monthsLeft+1):null,
    endingSoon:purchases.filter(row=>remaining(row)<=3).sort((a,b)=>remaining(a)-remaining(b)||b.amount-a.amount),
    uncertain:transactions.filter(row=>row.type==='expense'&&row.month===month&&!row.installments&&/parcela|pcl\s*\d|\d+\s*de\s*\d+/i.test(row.description)),
  };
}

export function savingScenario(indicators,plan,rates,target=0){
  const reductions=['subscriptions','dining','fuel'].map(id=>{
    const base=indicators.find(item=>item.id===id)?.flexibleAmount??0;
    const rate=Number.isFinite(rates[id])?Math.min(50,Math.max(0,rates[id])):0;
    return {id,base,rate,amount:Math.round(base*rate/100)};
  });
  const monthly=reductions.reduce((total,item)=>total+item.amount,0);
  const nextPotential=monthly+plan.nextRelease;
  return {reductions,monthly,nextPotential,
    sixMonthPotential:monthly*6+plan.timeline.reduce((total,item)=>total+item.released,0),
    // Conservative target estimate: only the chosen spending reductions.
    monthsToTarget:target>0&&monthly>0?Math.ceil(target/monthly):null};
}
