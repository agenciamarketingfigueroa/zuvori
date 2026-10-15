import {money,addMonths,parseMoney} from './finance.js';
import {spendingIndicators,installmentInsights,savingScenario} from './insights.js';
const titleMonth=month=>month.replace(/^./,letter=>letter.toLocaleUpperCase('pt-BR'));

export function spendingCards(data,month,ui){
  const {cash,esc,accountName}=ui;
  const indicators=spendingIndicators(data.transactions,month);
  return `<section class="spending-section" aria-label="Gastos que merecem atenção">
    <div class="section-title"><h2>O que pesa no seu mês</h2><span>Abra um indicador para conferir as compras</span></div>
    <div class="spending-grid">${indicators.map(item=>`<details class="spending-card">
      <summary><span class="spending-label">${item.label}<span aria-hidden="true">↗</span></span>
        <strong class="spending-value">${cash(item.amount)}</strong>
        <span class="spending-meta">${item.count} lançamentos · ${(item.share*100).toFixed(1).replace('.',',')}% das despesas</span>
        <span class="spending-note">${item.note}</span>
      </summary>
      <div class="spending-items">${item.items.length?item.items.map(row=>`<div class="spending-item"><div><strong>${esc(row.description)}</strong><small>${esc(accountName(row.account))}${row.installments?` · ${row.installment}/${row.installments}`:''}${row.review?' · categoria sugerida':''}</small></div><button class="amount-link" data-edit="${esc(row.id)}" aria-label="Editar ${esc(row.description)} de ${esc(money(row.amount))}">${cash(row.amount)} ↗</button></div>`).join(''):'<p class="sources">Nenhum gasto identificado nesta competência.</p>'}</div>
    </details>`).join('')}</div>
    <p class="chart-note">Indicadores são recortes das despesas já contabilizadas. Postos podem incluir outros produtos. Assinaturas e software podem conter planos anuais ou compras avulsas; confirme a periodicidade antes de considerar um custo mensal fixo.</p>
  </section>`;
}

export function installmentPanel(data,month,ui,detailed=false){
  const {cash,esc,monthLabel,accountName,panelHead}=ui;
  const plan=installmentInsights(data.transactions,month);
  const max=Math.max(plan.current,...plan.timeline.map(item=>item.value),1);
  return `<section class="panel installment-plan section-space">
    ${panelHead('Um caminho para sair das parcelas','Cenário: nenhuma compra parcelada nova',`<span class="pill">Compras · empréstimos separados</span>`)}
    <div class="plan-metrics">
      <div><span>Compras parceladas neste mês</span><strong>${cash(plan.current)}</strong><small>${plan.purchases.length} compras · ${(plan.share*100).toFixed(1).replace('.',',')}% das despesas</small></div>
      <div><span>Redução estimada no próximo mês</span><strong class="positive">${cash(plan.nextRelease)}</strong><small>${plan.endingCount} compras chegam à última parcela agora</small></div>
      <div><span>Compras ainda a pagar após este mês</span><strong>${cash(plan.future)}</strong><small>Soma nominal das parcelas futuras · não é quitação</small></div>
    </div>
    <div class="plan-horizon"><div><span class="panel-kicker">PRIMEIRO MÊS SEM AS PARCELAS DESTAS COMPRAS</span><h3>${plan.firstFreeMonth?esc(titleMonth(monthLabel(plan.firstFreeMonth))):'Nenhuma compra parcelada identificada'}</h3><p>${plan.purchases.length?'Estimativa pelas parcelas informadas, se não houver novas compras.':'Confira os lançamentos para completar a identificação de parcelamentos.'}</p></div><a class="button" href="#${detailed?'planning':'insights'}">${detailed?'Ver todos os compromissos':'Montar meu plano'} ↗</a></div>
    <div class="runoff-chart" role="img" aria-label="${esc(plan.timeline.map(item=>`${monthLabel(item.month)}: ${money(item.value)} em compras parceladas`).join('; '))}">${plan.timeline.map(item=>`<div><span class="money">${money(item.value)}</span><div class="runoff-track"><i style="height:${item.value/max*100}%"></i></div><small>${esc(monthLabel(item.month))}</small></div>`).join('')}</div>
    <p class="chart-note">${cash(plan.loanCurrent)} em parcelas de empréstimos neste mês ficam fora deste gráfico e da data acima. ${plan.uncertain.length?`${plan.uncertain.length} lançamento(s) sugerem parcelamento ainda não confirmado; a data pode mudar. `:''}Parcelas não informadas, novas compras e juros futuros não estão incluídos. A redução não garante dinheiro disponível: confira receitas e demais despesas.</p>
    ${detailed&&plan.endingSoon.length?`<details class="ending-details"><summary>Próximos términos · ${plan.endingSoon.length} compras até ${esc(monthLabel(addMonths(month,3)))}</summary><div class="ending-list">${plan.endingSoon.map(row=>`<div class="spending-item"><div><strong>${esc(row.description)}</strong><small>${esc(accountName(row.account))} · ${row.installment}/${row.installments} · última em ${esc(monthLabel(addMonths(month,row.installments-row.installment)))}</small></div><strong>${cash(row.amount)}</strong></div>`).join('')}</div></details>`:''}
  </section>`;
}

export function extendedInsights(data,month,ui){
  const {cash,esc,monthLabel,accountName,panelHead}=ui;
  const indicators=spendingIndicators(data.transactions,month);
  const plan=installmentInsights(data.transactions,month);
  const byId=id=>indicators.find(item=>item.id===id);
  const cards=data.cards.filter(card=>card.month===month&&card.status!=='paid');
  const baseRates={subscriptions:15,dining:20,fuel:5};
  const scenario=savingScenario(indicators,plan,baseRates);
  const dining=byId('dining'),fuel=byId('fuel'),subs=byId('subscriptions');
  const apple=subs.items.filter(row=>/apple/i.test(row.description));
  const actions=[
    ['01 / INTERROMPA O CICLO','Experimente 30 dias sem novas parcelas.',`Antes de uma compra não essencial, anote o preço total e espere 48 horas. ${cash(plan.current)} já comprometidos neste mês ajudam a mostrar o peso acumulado de parcelas pequenas.`],
    ['02 / PRESERVE O QUE TERMINA','Dê um destino ao espaço que surgir.',`A redução estimada para ${esc(monthLabel(addMonths(month,1)))} é de ${cash(plan.nextRelease)}. Quando o orçamento completo permitir, reserve esse espaço para compras à vista ou imprevistos. Evite substituir cada parcela encerrada por outra.`],
    ['03 / REVISE AS RENOVAÇÕES','Mantenha os serviços que você usa.',`${cash(subs.amount)} em assinaturas e software nesta competência. Confira renovação e periodicidade de cada plano. ${apple.length?`Há ${apple.length} cobrança(s) Apple, somando ${cash(apple.reduce((total,row)=>total+row.amount,0))}; confirme os produtos antes de concluir que são duplicados.`:'Revise planos sem uso e ferramentas que fazem a mesma tarefa.'} Preserve serviços essenciais ao trabalho.`],
    ['04 / ESCOLHA UM LIMITE','Planeje alimentação fora por semana.',`${cash(dining.amount)} em ${dining.count} lançamentos${dining.count?`, média de ${cash(Math.round(dining.amount/dining.count))} por lançamento`:''}. Como ponto de partida, gastar 20% menos em um mês semelhante liberaria ${cash(Math.round(dining.flexibleAmount*.2))} sobre as compras sem parcelas desta categoria. Defina um limite que caiba na rotina.`],
    ['05 / ORGANIZE OS TRAJETOS','Observe combustível e deslocamentos juntos.',`${cash(fuel.amount)} estimados em combustível e ${cash(byId('mobility').amount)} nos demais gastos de transporte. Agrupe trajetos quando possível e acompanhe o total gasto; a fatura não informa litros nem quilômetros para avaliar consumo.`],
    ['06 / COMPRE COM DINHEIRO RESERVADO','Troque a parcela por uma meta de compra.',`Use a simulação acima para escolher quanto tentar reservar. Ao atingir o preço total, confira novamente o caixa antes de comprar. Para antecipar parcelas, consulte o valor e o desconto oferecidos pelo banco; a soma futura de ${cash(plan.future)} não é uma oferta de quitação.`],
  ];
  return `${installmentPanel(data,month,ui,true)}
    <section class="panel section-space savings-panel">${panelHead('Sua próxima compra, à vista','Ajuste os cortes e veja um cenário de reserva · sem juros ou rendimentos',`<span class="pill">Simulação</span>`)}
      <div class="savings-layout"><div class="savings-controls">${['subscriptions','dining','fuel'].map(id=>{const item=byId(id);return `<div class="saving-control"><label for="cut-${id}">${item.label}<strong id="cut-label-${id}">${baseRates[id]}%</strong></label><input type="range" id="cut-${id}" min="0" max="50" step="5" value="${baseRates[id]}" aria-label="Redução em ${item.label.toLowerCase()}"><small>Base sem parcelas: ${cash(item.flexibleAmount)} · corte de <span id="cut-value-${id}">${cash(scenario.reductions.find(item=>item.id===id).amount)}</span></small></div>`;}).join('')}
      <label class="purchase-target" for="purchase-target">Quanto custa sua próxima compra à vista?<input id="purchase-target" inputmode="decimal" placeholder="Ex.: 600,00" aria-describedby="purchase-target-help"><small id="purchase-target-help">Use o preço total em reais, sem separador de milhar.</small></label><p class="error" id="target-error" role="status"></p>
      </div><div class="saving-results" aria-live="polite" aria-atomic="true"><div class="simulation-value"><span>Economia mensal simulada pelos cortes</span><strong class="positive" id="monthly-saving">${cash(scenario.monthly)}</strong><small>Se os gastos se repetirem em nível semelhante e você conseguir reduzi-los.</small></div><div class="detail-row"><span>Cortes + redução das parcelas no próximo mês</span><strong id="next-saving">${cash(scenario.nextPotential)}</strong></div><div class="detail-row"><span>Potencial acumulado em seis meses</span><strong id="six-saving">${cash(scenario.sixMonthPotential)}</strong></div><p class="target-result" id="target-result">Informe o preço para estimar o tempo de reserva.</p><p class="chart-note">O prazo da compra usa somente os cortes escolhidos. O acumulado de seis meses também inclui o espaço liberado mês a mês pelas parcelas encerradas, comparado ao mês atual. Não altera lançamentos nem presume sobra de caixa.</p></div></div>
      <p class="chart-note">Receitas ainda precisam estar completas para validar sua capacidade de guardar. Cobranças parceladas ficam fora da base de cortes, evitando contar o mesmo valor duas vezes. Combustível é estimado pelas descrições; periodicidade das assinaturas a confirmar.</p>
    </section>
    <div class="section-title"><h2>Seis passos para reduzir os compromissos</h2><span>Comece pelo que cabe na sua rotina</span></div><div class="grid-equal">${actions.map(([number,title,body])=>`<article class="panel insight-feature"><span class="insight-number">${number}</span><h2>${title}</h2><p>${body}</p></article>`).join('')}</div>
    <div class="grid-equal"><section class="panel">${panelHead('Faturas e caixa antes de qualquer corte','Pagamento marcado por você no aplicativo')}<p class="sources">${cards.length?`${cash(cards.reduce((total,card)=>total+card.total,0))} em faturas com pagamento a confirmar: ${cards.map(card=>`${esc(accountName(card.id))} (${esc(card.due.split('-').reverse().join('/'))})`).join(', ')}.`:'Nenhuma fatura com pagamento pendente de confirmação nesta competência.'} Confira os vencimentos e o caixa antes de destinar dinheiro para compras novas.</p><a class="text-link" href="#cards">Conferir faturas ↗</a></section><section class="panel">${panelHead('Proteja a operação','Despesas pessoais e profissionais podem usar o mesmo cartão')}<p class="sources">${cash(byId('advertising').amount)} em publicidade. Confira verbas de clientes e custos essenciais antes de cortar. Valores já reembolsados e incluídos no saldo informado não devem ser somados novamente ao caixa.</p></section></div>
    ${spendingCards(data,month,ui)}
    <p class="sources">Cenários calculados com os lançamentos da competência selecionada. Categorias sugeridas e parcelas não identificadas podem mudar a análise. Referência educativa para orçamento e consumo planejado: <a href="https://www.bcb.gov.br/pre/pef/port/caderno_cidadania_financeira.pdf" target="_blank" rel="noreferrer">Banco Central — Caderno de Educação Financeira</a>.</p>`;
}

export function bindExtendedSimulator(data,month,ui){
  const indicators=spendingIndicators(data.transactions,month),plan=installmentInsights(data.transactions,month);
  const update=()=>{
    const rates=Object.fromEntries(['subscriptions','dining','fuel'].map(id=>[id,Number(document.querySelector(`#cut-${id}`).value)]));
    const raw=document.querySelector('#purchase-target').value.trim();
    let target=0;
    document.querySelector('#target-error').textContent='';
    try{if(raw)target=parseMoney(raw);}catch(error){document.querySelector('#target-error').textContent=error.message;}
    const scenario=savingScenario(indicators,plan,rates,target);
    for(const item of scenario.reductions){document.querySelector(`#cut-label-${item.id}`).textContent=`${item.rate}%`;document.querySelector(`#cut-value-${item.id}`).innerHTML=ui.cash(item.amount);}
    document.querySelector('#monthly-saving').innerHTML=ui.cash(scenario.monthly);
    document.querySelector('#next-saving').innerHTML=ui.cash(scenario.nextPotential);
    document.querySelector('#six-saving').innerHTML=ui.cash(scenario.sixMonthPotential);
    document.querySelector('#target-result').innerHTML=target?(scenario.monthsToTarget?`Para reservar ${ui.cash(target)}: <strong>${scenario.monthsToTarget} ${scenario.monthsToTarget===1?'mês':'meses'}</strong> com os cortes escolhidos.`:'Com cortes de R$ 0,00, não há prazo de reserva estimado.'):raw?'Confira o preço informado.':'Informe o preço para estimar o tempo de reserva.';
  };
  document.querySelectorAll('.savings-controls input').forEach(input=>input.addEventListener('input',update));
}
