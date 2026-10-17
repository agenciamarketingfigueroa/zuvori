# zuvori.

Aplicativo financeiro pessoal em HTML, CSS e JavaScript. Identidade neutra, temas claro e escuro e gráficos locais sem dependências externas. A versão de consulta está publicada em [zuvori.com.br](https://zuvori.com.br/) com autenticação no Cloudflare Worker.

## Rodar localmente

Com Node.js 22 ou mais recente, configure uma credencial local uma vez (substitua `felipe` pelo identificador do cliente):

```sh
node scripts/setup-auth.mjs felipe
```

Quando o script mostrar o prompt no terminal, digite uma linha JSON como `{"username":"seu-usuario","password":"sua-senha"}` e pressione Enter. A entrada fica oculta. A credencial fica em `private/`, que não é incluída no Git. Depois, inicie o servidor:

```sh
npm run dev
```

Abra **http://127.0.0.1:4173** e entre com a credencial pessoal configurada. O painel em `/app.html`, seus scripts e a base financeira do cliente só são servidos depois do login. A sessão dura até oito horas ou até clicar em **Sair**. No Windows, `iniciar-zuvori.ps1` procura Node no PATH ou no runtime local do Codex. O servidor escuta somente no próprio computador e não inicia sem ao menos um cliente com `auth.json`.

### Prévia pelo Go Live do VS Code

1. Em **Terminal → Run Task**, inicie **Zuvori: servidor protegido** e deixe esse terminal aberto. No macOS e Linux, a tarefa usa `npm run dev`; no Windows, usa `iniciar-zuvori.ps1`.
2. Clique em **Go Live**. Abra **http://127.0.0.1:5500/**.

As configurações em `.vscode/settings.json` encaminham o Go Live para o servidor protegido na porta 4173. A raiz está limitada a `public/`; os arquivos do painel ficam em `protected/`. Se o servidor protegido estiver parado, o Go Live não abre o painel. Não remova o proxy nem mude a raiz para a pasta do repositório ao usar dados pessoais.

Na primeira abertura, o servidor de desenvolvimento disponibiliza `private/clients/<cliente>/data/finances.json`, se existir, e o app importa o arquivo para o navegador. Nas próximas aberturas, prevalecem as alterações no armazenamento local daquele cliente. Para carregar um arquivo atualizado, use **Dados & preferências → Importar arquivo**. A importação substitui a base atual mediante confirmação, não faz mesclagem automática.

## Pastas dos clientes

```text
private/clients/
  felipe/
    auth.json                 # hash da credencial local
    data/finances.json        # base inicial
    sources/                 # configuração e materiais de origem
    reports/                 # revisões, conferências e QA
  delliz/
    data/                    # vazia por enquanto
    sources/
    reports/
```

A pasta da Delliz está preparada, vazia e **sem credencial**; por enquanto ela não consegue entrar. Quando a credencial dela for configurada em `private/clients/delliz/auth.json`, o servidor associará a sessão apenas à pasta `delliz`. A base do Felipe não é usada como exemplo para ela. O aplicativo usa chaves diferentes por cliente para evitar mistura acidental na interface, inclusive no mesmo navegador. Dados antigos do navegador são migrados somente para Felipe. **O armazenamento do mesmo perfil de navegador não é uma barreira de segurança entre clientes**: para testes por pessoas diferentes no mesmo computador, use perfis de navegador separados.

Backups exportados levam o nome do cliente. A importação rejeita um backup identificado como outro cliente; backups antigos sem identificação só são aceitos na conta Felipe. Downloads ainda vão para a pasta configurada no navegador: guarde cada arquivo baixado em `private/clients/<cliente>/reports/` ou `data/`, conforme o caso. Os cálculos gerais usam os lançamentos de cada cliente; indicadores específicos da realidade da Delliz serão definidos quando ela fornecer os dados.

## O que está pronto

- Visão geral, lançamentos com busca e filtros, cartões, categorias, planejamento e insights.
- Receitas e despesas editáveis, competência separada da data da compra, parcelas e categorias revisáveis.
- Gráficos de categorias, contas, composição das despesas e projeção de parcelas.
- Indicadores de assinaturas e software, combustível estimado, alimentação fora, mercado, outros transportes e publicidade; cada bloco abre os lançamentos que compõem o valor.
- Plano para reduzir compras parceladas: compromisso atual, redução projetada, primeiro mês livre das compras já lançadas e simulação de reserva para comprar à vista.
- Meta mensal, simulação de redução em categorias selecionadas e confirmação local de pagamento.
- Exportação e importação JSON, exportação CSV dos filtros ativos, tema persistente e ocultação visual dos valores.
- Layout responsivo, navegação por teclado, estados vazios e fontes de cada lançamento.
- Seção independente **Plano de quitação**, com etapas para reduzir gastos, análise agregada da operação e simulador de duas dívidas. Os saldos deste plano não aparecem na visão geral.

### Preparar e revisar o plano de quitação

O campo opcional `debtPlan` fica na base privada de cada cliente. Clientes sem plano continuam vazios. Saldos desconhecidos permanecem `null`; cenários não são tratados como dívidas confirmadas. O simulador usa centavos inteiros, juros mensais constantes e pagamento ao fim do mês. Não inclui tarifas, novas compras, carências ou o limite legal do rotativo; serve para explorar hipóteses de renegociação, sem substituir o cronograma do contrato. As simulações não alteram dados nem persistem na consulta remota.

Para analisar as exportações Hotmart e Meta no formato suportado, use Python com `openpyxl`:

```sh
python scripts/analyze-operation.py CLIENTE CAMINHO_HOTMART CAMINHO_META
```

O script confere cabeçalhos, duplicatas, papéis, moedas, períodos e conciliação. Preserva originais em `private/clients/CLIENTE/sources/` e salva agregados em `reports/operation-analysis.json`. O recorte de produtos é explícito no script e deve ser revisado para operações diferentes. BRL e USD não são somados; líquido da plataforma menos mídia não equivale a lucro final nem saldo disponível. Só agregados revisados devem ser incorporados a `debtPlan.operation` e enviados ao KV.

No Go Live, **Plano de quitação → Carregar análise preparada** (ou **Atualizar análise local**) lê a base privada do cliente autenticado. A interface solicita confirmação e baixa um backup anterior antes de substituir os dados locais. Alterações feitas no navegador após a preparação precisam ser conciliadas; não há mesclagem automática. Na versão remota, a atualização depende de publicar o código e atualizar a cópia privada no KV.

## Acesso remoto protegido

O Worker com login da Zuvori atende `zuvori.com.br` e `www.zuvori.com.br`. A cópia da análise do Felipe fica no Cloudflare KV e pode ser consultada após login em qualquer dispositivo. Os dados enviados ao KV ficam fora do repositório; a versão remota é somente leitura. A conta Delliz está vazia e sem credencial. Para atualizar a análise publicada, consulte [docs/cloudflare-worker.md](docs/cloudflare-worker.md).

## Dados financeiros

`private/`, `tmp/`, os PDFs, backups e imagens de QA são locais e ignorados pelo Git. Cada credencial fica em `private/clients/<cliente>/auth.json` como hash com salt; usuários e senhas não estão no código. O build copia `public/` e `protected/`, sem dados financeiros ou credenciais. Não coloque documentos ou backups nessas pastas públicas do build.

O login também protege a prévia servida pelo servidor local. Edições locais são armazenadas no `localStorage` do navegador sem criptografia e não atualizam automaticamente a cópia publicada no KV; quem tem acesso ao computador, ao perfil do navegador ou aos arquivos locais pode lê-las fora do aplicativo. A versão remota e o procedimento de atualização estão em [docs/cloudflare-worker.md](docs/cloudflare-worker.md). Ocultar valores só desfoca a interface.

O extrator utilizado nesta primeira importação é específico aos modelos de fatura fornecidos. Precisa de Python com `pdfplumber`:

```sh
python scripts/import-statements.py "CAMINHO_DAS_FATURAS" --output private/clients/felipe/data/finances.json
```

Ele recupera o cabeçalho PDF quando há bytes inválidos antes dele e exige conciliação exata de cada fatura antes de gravar a base. Os valores esperados das faturas, parcelas da Mary e ajustes de centavos ficam em `private/clients/felipe/sources/import-config.json`, também ignorado pelo Git (opção `--config`). Este extrator é específico dos documentos do Felipe; para a Delliz ou outros modelos, revise o extrator e concilie os documentos antes de importar.

### Reconhecer compras nas próximas faturas

Guarde o JSON classificado do mês anterior e importe o mês novo em **outro arquivo**, após adaptar o extrator e conferir os totais das novas faturas. Então execute:

```sh
node scripts/transfer-classifications.mjs --previous private/clients/felipe/data/finances.json --current private/clients/felipe/data/novo-mes.json --output private/clients/felipe/data/novo-mes-revisado.json --report private/clients/felipe/reports/pendencias-novo-mes.json
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

Os testes cobrem centavos, projeções, virada de ano, validação de backups e autenticação. `dist/` contém apenas o aplicativo estático. O Worker em `worker/` aplica a proteção no domínio publicado; `wrangler.toml` registra os bindings e o endereço `workers.dev`. Os domínios personalizados são gerenciados no painel da Cloudflare.

## Marca

Wordmark em `public/assets/wordmark.svg` e símbolo em `public/assets/symbol.svg`. A marca usa preto, cinza e branco. Cores dos gráficos são semânticas e independentes da identidade. Sem fontes remotas, rastreadores ou requisições a bancos.
