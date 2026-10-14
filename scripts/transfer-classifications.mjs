import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const normalized=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
const monthNumber=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value??'')?Number(value.slice(0,4))*12+Number(value.slice(5,7)):NaN;

export function transferClassifications(previous,current){
  if(!Array.isArray(previous?.transactions)||!Array.isArray(current?.transactions))throw Error('Arquivos Zuvori inválidos.');
  const prior=previous.transactions.filter(row=>row.type==='expense'&&row.originalDescription&&row.review===false&&Number.isInteger(row.installment)&&Number.isInteger(row.installments));
  const candidates=new Map();
  const needsReview=[];
  for(const row of current.transactions){
    if(row.type!=='expense'||!Number.isInteger(row.installment)||!Number.isInteger(row.installments)||row.originalDescription||row.review===false)continue;
    const possible=prior.filter(old=>{
      const gap=monthNumber(row.month)-monthNumber(old.month);
      return gap>0&&old.account===row.account&&old.installments===row.installments&&old.installment+gap===row.installment&&normalized(old.originalDescription)===normalized(row.description);
    });
    if(!possible.length)continue;
    const exact=possible.filter(old=>old.classificationStatus!=='provisional'&&(old.amount===row.amount||old.futureAmount===row.amount)&&old.last4&&row.last4&&old.last4===row.last4);
    candidates.set(row.id,exact);
    if(exact.length!==1)needsReview.push({currentId:row.id,previousIds:possible.map(old=>old.id),reason:possible.some(old=>old.classificationStatus==='provisional')?'classificação provisória ou correspondência incerta':'valor, cartão ou identificação ambígua'});
  }
  const usage=new Map();
  for(const matches of candidates.values())for(const old of matches)usage.set(old.id,(usage.get(old.id)||0)+1);
  const applied=[];
  const transactions=current.transactions.map(row=>{
    const matches=candidates.get(row.id);
    if(!matches?.length)return row;
    const old=matches[0];
    if(matches.length!==1||usage.get(old.id)!==1){
      if(!needsReview.some(item=>item.currentId===row.id))needsReview.push({currentId:row.id,previousIds:matches.map(item=>item.id),reason:'mais de uma parcela pode corresponder à compra'});
      return row;
    }
    const updated={...row,description:old.description,originalDescription:row.description,category:old.category,purpose:old.purpose,review:false};
    applied.push({currentId:row.id,previousId:old.id});
    return updated;
  });
  return {data:{...current,transactions},applied,needsReview};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=Object.fromEntries(process.argv.slice(2).flatMap((value,index,all)=>value.startsWith('--')?[[value,all[index+1]]]:[]));
  if(!args['--previous']||!args['--current']||!args['--output'])throw Error('Use --previous arquivo.json --current arquivo.json --output novo-arquivo.json');
  const previousPath=resolve(args['--previous']),currentPath=resolve(args['--current']),outputPath=resolve(args['--output']);
  if([previousPath,currentPath].includes(outputPath))throw Error('O arquivo de saída deve ser separado dos dois arquivos de entrada.');
  const reportPath=args['--report']?resolve(args['--report']):null;
  if(reportPath&&[previousPath,currentPath,outputPath].includes(reportPath))throw Error('O relatório deve ter seu próprio arquivo.');
  const previous=JSON.parse(await readFile(previousPath,'utf8'));
  const current=JSON.parse(await readFile(currentPath,'utf8'));
  const result=transferClassifications(previous,current);
  await mkdir(dirname(outputPath),{recursive:true});
  await writeFile(outputPath,JSON.stringify(result.data,null,2)+'\n','utf8');
  if(reportPath){
    await mkdir(dirname(reportPath),{recursive:true});
    await writeFile(reportPath,JSON.stringify({applied:result.applied,needsReview:result.needsReview},null,2)+'\n','utf8');
  }
  console.log(JSON.stringify({applied:result.applied.length,needsReview:result.needsReview.length}));
}
