# zuvori.

Aplicativo financeiro pessoal em HTML, CSS e JavaScript. Identidade neutra, temas claro e escuro e gráficos locais sem dependências externas. Etapa atual: protótipo interno, sem publicação.

## Rodar localmente

Com Node.js 22 ou mais recente:

```sh
npm run dev
```

Abra **http://127.0.0.1:4173**. No Windows, também é possível executar `iniciar-zuvori.ps1`; ele procura Node no PATH ou no runtime local do Codex. O servidor escuta somente no próprio computador.

Na primeira abertura, o servidor de desenvolvimento disponibiliza `private/finances.json`, se existir, e o app importa o arquivo para o navegador. Nas próximas aberturas, prevalecem as alterações em localStorage. Para carregar um arquivo atualizado, use **Dados & preferências → Importar arquivo**. A importação substitui a base atual mediante confirmação, não faz mesclagem automática.

## O que está pronto

- Visão geral, lançamentos com busca e filtros, cartões, categorias, planejamento e insights.
- Receitas e despesas editáveis, competência separada da data da compra, parcelas e categorias revisáveis.
- Gráficos de categorias, contas, composição das despesas e projeção de parcelas.
- Indicadores de assinaturas e software, combustível estimado, alimentação fora, mercado, outros transportes e publicidade; cada bloco abre os lançamentos que compõem o valor.
- Plano para reduzir compras parceladas: compromisso atual, redução projetada, primeiro mês livre das compras já lançadas e simulação de reserva para comprar à vista.
- Meta mensal, simulação de redução em categorias selecionadas e confirmação local de pagamento.
- Exportação e importação JSON, exportação CSV dos filtros ativos, tema persistente e ocultação visual dos valores.
- Layout responsivo, navegação por teclado, estados vazios e fontes de cada lançamento.

## Dados financeiros

`private/`, `tmp/`, os PDFs, backups e imagens de QA são locais e ignorados pelo Git. O build copia apenas `public/`. Não coloque documentos ou backups nessa pasta.

Os dados são armazenados no navegador sem criptografia e **não sincronizam entre dispositivos**. Esta versão local não possui autenticação. A proteção da futura hospedagem é descrita em [docs/cloudflare.md](docs/cloudflare.md). Ocultar valores só desfoca a interface.

O extrator utilizado nesta primeira importação é específico aos modelos de fatura fornecidos. Precisa de Python com `pdfplumber`:

```sh
python scripts/import-statements.py "CAMINHO_DAS_FATURAS" --output private/finances.json
```

Ele recupera o cabeçalho PDF quando há bytes inválidos antes dele e exige conciliação exata de cada fatura antes de gravar a base. Os valores esperados das faturas, parcelas da Mary e ajustes de centavos ficam em `private/import-config.json`, também ignorado pelo Git (opção `--config`). Para outros meses ou modelos, revise o extrator e concilie os documentos antes de importar.

### Reconhecer compras nas próximas faturas

Guarde o JSON classificado do mês anterior e importe o mês novo em **outro arquivo**, após adaptar o extrator e conferir os totais das novas faturas. Então execute:

```sh
node scripts/transfer-classifications.mjs --previous private/finances.json --current private/novo-mes.json --output private/novo-mes-revisado.json --report private/pendencias-novo-mes.json
```

O arquivo revisado reaproveita nomes, categorias e finalidades apenas quando encontra uma parcela posterior da mesma compra, com a descrição original do banco, conta, final do cartão e valor compatíveis. Os números das parcelas devem avançar conforme os meses transcorridos. Classificações provisórias, correspondências duplicadas e valores divergentes aparecem no relatório de pendências para conferência. Compras sem correspondência permanecem sem identificação. O arquivo anterior não é sobrescrito; importe o revisado no aplicativo depois de conferir as pendências.

### Critérios de cálculo

Valores em centavos inteiros. Despesas pela competência da fatura, não pelo mês da compra. Pagamentos de faturas anteriores excluídos, evitando dupla contagem. Receitas não informadas permanecem desconhecidas: não são presumidas como zero. Resultado registrado é receitas menos despesas, não saldo bancário.

O saldo informado de uma conta é uma posição sem data confirmada até que ela seja fornecida. Valores a receber são previsões por competência e ficam separados das receitas realizadas; só entram no resultado quando o recebimento for confirmado e registrado como receita. Os dados privados de saldo e recebíveis são preservados na configuração local da importação e incluídos no backup do aplicativo.

Projeção inclui apenas parcelamentos explícitos da competência selecionada. Não inclui novas compras, assinaturas recorrentes, despesas não enviadas ou juros futuros. Para Inter, valores futuros explicitados na fatura ajustam diferenças de centavos; para as demais parcelas, o valor atual é usado como estimativa. Mapfre exige confirmação antes de entrar na projeção. Não confundir soma nominal de parcelas com saldo para quitação antecipada.

O painel de compras parceladas separa parcelas de empréstimos e mostra apenas compras com parcelamento informado. O simulador usa reduções escolhidas nas despesas sem parcelas de alimentação fora, assinaturas e combustível; o prazo de reserva usa somente essas reduções. O potencial de seis meses soma esse cenário com o espaço que cada parcela deixaria de ocupar, comparado ao mês atual, sem presumir receitas ou caixa disponível. Combustível é estimado por descrições de postos e pode incluir outros produtos. “Assinaturas e software” representa cobranças no mês; a periodicidade de cada serviço ainda deve ser confirmada.

Categorias são sugestões pelo estabelecimento, não informação oficial do banco. Não se assume que todo gasto num cartão MEI seja profissional. Os limites refletem a emissão da fatura.

## Verificação e build

```sh
npm test
npm run build
```

Os testes cobrem centavos, projeções, virada de ano, validação de backups e bloqueio/validação de JWT na futura hospedagem. `dist/` contém apenas o aplicativo estático. Para Cloudflare Pages, mantenha também `functions/` na raiz do repositório para compilar o middleware de autenticação.

## Marca

Wordmark em `public/assets/wordmark.svg` e símbolo em `public/assets/symbol.svg`. A marca usa preto, cinza e branco. Cores dos gráficos são semânticas e independentes da identidade. Sem fontes remotas, rastreadores ou requisições a bancos.
