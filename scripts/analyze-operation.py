"""Read exports locally; save only aggregates under the selected private client.

Usage: python scripts/analyze-operation.py CLIENT HOTMART_EXPORT META_EXPORT
Requires openpyxl. Originals are preserved in private/clients/CLIENT/sources/.
"""
import argparse
import io
import json
import re
import shutil
from collections import Counter
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import openpyxl

def cents(value):
    return int((Decimal(str(value or 0)) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

def workbook_rows(path):
    # Some Hotmart XLS downloads are actually XLSX ZIP containers.
    workbook = openpyxl.load_workbook(io.BytesIO(path.read_bytes()), data_only=True)
    if len(workbook.worksheets) != 1:
        raise ValueError('Confira as abas antes de escolher os dados.')
    return list(workbook.active.values)

def analyze(client, sales_path, ads_path):
    if not re.fullmatch(r'[a-z0-9-]+', client):
        raise ValueError('Cliente inválido.')
    sales, ads = workbook_rows(sales_path), workbook_rows(ads_path)
    expected_sales = {0:'Código da transação',1:'Status da transação',2:'Data da transação',6:'Produto',15:'Moeda de recebimento',16:'Faturamento bruto (sem impostos)',19:'Faturamento líquido do(a) Produtor(a)',23:'Taxa de processamento'}
    expected_ads = {0:'Início dos relatórios',1:'Encerramento dos relatórios',2:'Nome da campanha',6:'Valor gasto (BRL)',10:'Valor de conversão da compra',22:'Compras'}
    for headers, expected in [(sales[0],expected_sales),(ads[0],expected_ads)]:
        for index, label in expected.items():
            if headers[index] != label:
                raise ValueError(f'Coluna inesperada: {label}. Revise o formato da exportação.')
    sales,ads=sales[1:],ads[1:]
    if len({r[0] for r in sales}) != len(sales):
        raise ValueError('Há transações duplicadas: concilie antes de somar.')
    periods={(str(r[0]),str(r[1])) for r in ads}
    if len(periods)!=1 or any(not r[2] for r in ads):
        raise ValueError('Confira períodos e possíveis linhas de total no arquivo Meta.')
    start,end=next(iter(periods))
    parsed=lambda r: datetime.strptime(r[2],'%d/%m/%Y %H:%M:%S').strftime('%Y-%m-%d')
    if any(not start<=parsed(r)<=end for r in sales):
        raise ValueError('Os períodos dos arquivos não coincidem.')
    if any(r[15] not in ('BRL','USD') or r[18]!='Produtor' for r in sales):
        raise ValueError('Há outras moedas ou papéis de venda: ajuste o recorte antes de somar.')
    paid=[r for r in sales if r[1] in ('Aprovado','Completo')]
    focus=[r for r in paid if r[6].startswith(('Pack ', 'O Código', 'Guia de Bolso'))]
    brl=[r for r in focus if r[15]=='BRL']
    other=[r for r in paid if r not in focus]
    net=lambda rr:sum(cents(r[19]) for r in rr)
    operation=dict(
        from_=start,to=end,count=len(brl),gross=sum(cents(r[16]) for r in brl),net=net(brl),
        fees=sum(sum(cents(r[i]) for i in [23,24,25]) for r in brl),
        adSpend=sum(cents(r[6]) for r in ads),usdNet=net([r for r in focus if r[15]=='USD']),
        excludedBRLNet=net([r for r in other if r[15]=='BRL']),excludedUSDNet=net([r for r in other if r[15]=='USD']),
        metaValue=sum(cents(r[10]) for r in ads),metaPurchases=sum(int(r[22] or 0) for r in ads),
        monthly=[dict(month=m,count=len([r for r in brl if parsed(r).startswith(m)]),net=net([r for r in brl if parsed(r).startswith(m)])) for m in sorted({parsed(r)[:7] for r in brl})],
        products=[dict(name=p,count=len([r for r in brl if r[6]==p]),net=net([r for r in brl if r[6]==p])) for p in sorted({r[6] for r in brl})],
        campaigns=[dict(name=r[2],status=r[3],spend=cents(r[6]),purchases=int(r[22] or 0),value=cents(r[10])) for r in ads]
    )
    operation['from']=operation.pop('from_')
    if operation['gross']-operation['fees']!=operation['net']:
        raise ValueError('Receita, taxas e líquido não conciliam no recorte. Revise deduções.')
    root=Path(__file__).resolve().parent.parent/'private'/'clients'/client
    (root/'sources').mkdir(parents=True,exist_ok=True)
    (root/'reports').mkdir(exist_ok=True)
    for p in [sales_path,ads_path]:
        destination=root/'sources'/p.name
        if p.resolve()!=destination.resolve():
            if destination.exists() and destination.read_bytes()!=p.read_bytes():
                raise ValueError('Já existe um original diferente com esse nome.')
            shutil.copy2(p,destination)
    audit={'salesRows':len(sales),'uniqueTransactions':len(sales),'statuses':dict(Counter(r[1] for r in sales)),'adsRows':len(ads),'salesRange':'Report!A1:BK'+str(len(sales)+1),'adsRange':'Worksheet!A1:AC'+str(len(ads)+1),'scope':'Recorte por nome: Pack / O Código / Guia de Bolso. Relação com campanhas inferida, não conciliada por ID.','operation':operation}
    output=root/'reports'/'operation-analysis.json'
    output.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'report':str(output),'transactionsBRL':len(brl),'netBRL':operation['net'],'adSpendBRL':operation['adSpend'],'contributionBRL':operation['net']-operation['adSpend']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('client');parser.add_argument('sales',type=Path);parser.add_argument('ads',type=Path)
    args=parser.parse_args();analyze(args.client,args.sales,args.ads)
