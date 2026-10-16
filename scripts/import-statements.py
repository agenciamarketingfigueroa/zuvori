"""Local extraction. PDFs and resulting data must never enter version control."""
import argparse
import json
import re
from pathlib import Path
from decimal import Decimal
import pdfplumber
from io import BytesIO

def cents(s):
    return int(Decimal(s.replace('.', '').replace(',', '.')) * 100)

def category(description):
    d=description.lower()
    groups=[
        ('Impostos e tarifas', ['iof']),
        ('Publicidade', ['facebk']),
        ('Casa e reforma', ['marmore','tintas','acabamentos','ferragens','materiais','manecao','favani']),
        ('Mercado', ['supermercados','mart minas','nacional alimentos','sacolao']),
        ('Alimentação fora', ['pokeup','burger','sterna','padaria','bolateria','lanches','lanchonete','castelo drive','tropeirao','pizzaria','sorvetes','mixpao']),
        ('Transporte', ['posto','uber','zul ']),
        ('Saúde', ['unimed','araujo','oticaguanabar']),
        ('Assinaturas e software', ['openai','google','apple.com','adobe','amazonprime','netflix','capcut','klingai']),
        ('Telefone', ['recarga','vivo ']),
        ('Seguros', ['mapfre']),
    ]
    return next((c for c,words in groups if any(w in d for w in words)), 'A classificar')

def extract(path):
    b=path.read_bytes(); start=b.find(b'%PDF')
    if start<0: raise ValueError(f'PDF inválido: {path.name}')
    with pdfplumber.open(BytesIO(b[start:])) as pdf:
        return [p.extract_text() or '' for p in pdf.pages]

def run(folder, output, config_path):
    config=json.loads(config_path.read_text(encoding='utf-8'))
    cards=config['cards']
    rows=[]
    for card in cards:
        pages=extract(folder/card['file'])
        for i,page in enumerate(pages):
            if card['id'].startswith('nubank') and i>=4:
                matches=re.finditer(r'^(\d{2}) (SET|OUT) (?:[•]{4} (\d{4}) )?(.+?) R\$ ([\d.,]+)$',page,re.M)
                for m in matches:
                    day,month,last,desc,amount=m.groups()
                    if 'Pagamento' in desc: continue
                    part=re.search(r' - Parcela (\d+)/(\d+)',desc)
                    rows.append(dict(id=f"{card['id']}-{len(rows)+1}",date=f"2026-{'09' if month=='SET' else '10'}-{day}",month='2026-10',description=desc.split(' - Parcela')[0],amount=cents(amount),account=card['id'],category=category(desc),type='expense',installment=int(part[1]) if part else None,installments=int(part[2]) if part else None,review=True,source=card['file'],page=i+1,last4=last))
            elif card['id']=='inter-mei' and i in (2,3):
                matches=re.finditer(r'^(\d{2}) de (abr|set|out)\. 2026 (.+?) - R\$ ([\d.,]+)$',page,re.M)
                for m in matches:
                    day,month,desc,amount=m.groups()
                    part=re.search(r' \(Parcela (\d+) de (\d+)\)',desc)
                    rows.append(dict(id=f"inter-mei-{len(rows)+1}",date=f"2026-{dict(abr='04',set='09',out='10')[month]}-{day}",month='2026-10',description=desc.split(' (Parcela')[0],amount=cents(amount),account=card['id'],category=category(desc),type='expense',installment=int(part[1]) if part else None,installments=int(part[2]) if part else None,review=True,source=card['file'],page=i+1,last4='0167'))
        actual=sum(r['amount'] for r in rows if r['account']==card['id'])
        if actual!=card['total']: raise ValueError(f"Conciliação {card['id']}: {actual} != {card['total']}")
        card['month']='2026-10'; card['status']='unknown'; card['snapshot']='2026-10-09'
    rows.extend(config.get('manual',[]))
    # Explicit amounts for Inter's next installments avoid rounding discrepancies.
    for r in rows:
        for correction in config.get('futureAmounts',[]):
            if all(r[key]==correction[key] for key in ('account','description','amount')):
                r['futureAmount']=correction['futureAmount']
    # Keep user-confirmed classifications when rebuilding this import.
    for row in rows:
        correction=config.get('classifications',{}).get(row['id'])
        if correction and correction.get('originalDescription')==row['description']:
            for key in ('description','originalDescription','classificationStatus','category','purpose','review'):
                if key in correction:
                    row[key]=correction[key]
    result=dict(version=1,referenceMonth='2026-10',incomeComplete=[],cards=cards,transactions=rows,budgets={},cashSnapshot=config.get('cashSnapshot'),receivables=config.get('receivables',[]),debtPlan=config.get('debtPlan'),notes=['Categorias sugeridas pelo estabelecimento; revise a finalidade pessoal ou profissional.','Mary: competência confirmada; vencimento não informado.','Mapfre: descrição sugere parcela 4/10, mas não foi incluída na projeção sem confirmação.','Pagamentos das faturas anteriores excluídos para evitar dupla contagem.'])
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'transactions':len(rows),'cards':sum(c['total'] for c in cards),'mary':sum(r['amount'] for r in rows if r['account']=='mary'),'total':sum(r['amount'] for r in rows)},ensure_ascii=True))

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('folder',type=Path); p.add_argument('--output',type=Path,default=Path('private/clients/felipe/data/finances.json')); p.add_argument('--config',type=Path,default=Path('private/clients/felipe/sources/import-config.json')); args=p.parse_args(); run(args.folder,args.output,args.config)
