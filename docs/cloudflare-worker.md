# Zuvori privado com Cloudflare Worker

Esta é a opção para manter o formulário de usuário e senha da Zuvori e consultar o mesmo relatório em qualquer dispositivo. O Worker verifica a credencial, cria uma sessão curta e busca apenas o arquivo do cliente autenticado no Workers KV. O repositório, o build e o GitHub Pages não recebem os dados nem os PDFs.

**Situação atual (15/10/2026):** o Worker `zuvori-private` está publicado em `zuvori.com.br`, `www.zuvori.com.br` e no endereço `workers.dev`. A credencial do Felipe está nos segredos do Worker, e a cópia do dashboard está no namespace KV `zuvori-client-data`, sob `client:felipe`. Os PDFs, fontes originais e segredos permanecem fora do Git. A Delliz continua sem credencial e sem dados. O GitHub Pages não é mais o destino DNS do domínio Zuvori.

## Preparação local

1. Exporte um backup atualizado em **Dados & preferências → Exportar backup completo** no computador principal se alterou o dashboard desde a importação inicial. Guarde o arquivo em `private/clients/felipe/data/`.
2. Prepare a cópia protegida com **Terminal → Run Task → Zuvori: preparar dados para Cloudflare**. Essa tarefa usa `private/clients/felipe/data/finances.json`. Se tiver um backup mais recente, no Windows execute `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\preparar-dados-cloud.ps1 felipe "CAMINHO_DO_BACKUP.json"`. A saída fica em `private/cloudflare/data-felipe.json`, ignorada pelo Git. Confira os valores e descrições antes do envio. O script substitui nomes de PDF por “Fatura importada” e remove números finais de cartão, páginas e notas internas.
3. Configure uma **nova senha forte e exclusiva**, com pelo menos 16 caracteres. No Windows, abra `CONFIGURAR-LOGIN-CLOUDFLARE.cmd` com dois cliques ou, no VS Code, use **Terminal → Run Task → Zuvori: configurar login na Cloudflare**. O programa pergunta separadamente o usuário, a senha nova e a confirmação. Se o cliente já estiver cadastrado, a tarefa atualiza a senha. A antiga senha de seis dígitos não deve ser usada na internet. A senha fica oculta enquanto você digita; os arquivos secretos são criados em `private/cloudflare/`, fora do Git.
4. Rode `npm test` e `npm run build`.

## Recursos Cloudflare

1. O namespace Workers KV `zuvori-client-data` já existe. Seu ID público de recurso está em `wrangler.toml`; o arquivo não contém credenciais. `wrangler.worker.example.toml` continua como modelo para outra conta.
2. Configure os segredos `ZUVORI_USERS`, `ZUVORI_AUTH_PEPPER` e `ZUVORI_SESSION_KEY` no Worker com os conteúdos de `private/cloudflare/users.json`, `auth-pepper.txt` e `session-key.txt`, respectivamente. Nunca coloque esses valores no TOML, GitHub Actions, README ou linha de comando como texto literal.
3. Faça o build e implante o Worker com os assets de `dist/`. A implantação atual foi feita com Wrangler e um token temporário limitado a `zuvori-private`; a integração automática GitHub–Cloudflare não está ativa. O Worker requer os bindings `ZUVORI_DATA`, `ASSETS` e `LOGIN_RATE`; sem eles falha fechado. `preview_urls = false` evita URLs adicionais de prévia na Cloudflare. O Go Live local continua disponível.
4. Para substituir a análise publicada, atualize a entrada `client:felipe` em **Cloudflare → Workers KV → zuvori-client-data → KV Pairs** com o conteúdo de `private/cloudflare/data-felipe.json`. A Delliz só receberá a chave `client:delliz` após configurar credencial e analisar os dados dela; não reutilize o arquivo do Felipe.
5. Os domínios `zuvori.com.br` e `www.zuvori.com.br` estão associados diretamente ao Worker. O DNS de e-mail (MX/TXT) permanece separado. Em qualquer endereço público, `/api/data` exige sessão válida.

Para as tarefas de KV e deploy, use o [Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/) da sua conta Cloudflare. Os comandos atuais são `wrangler kv namespace create`, `wrangler kv key put --path` e `wrangler deploy --config`; veja a [referência oficial de KV](https://developers.cloudflare.com/kv/reference/kv-commands/). O envio dos segredos usa [`wrangler secret put`](https://developers.cloudflare.com/workers/configuration/secrets/). Essas operações mudam recursos remotos e devem ser feitas apenas depois de revisar o arquivo preparado e a configuração.

## Atualização mensal

Faça a análise no computador principal, exporte o backup atualizado, prepare novamente `data-felipe.json`, confira os números e substitua a chave `client:felipe` no KV pelo painel da Cloudflare. Outros dispositivos consultam essa cópia em modo de leitura. Nenhuma alteração local feita em outro dispositivo modifica a análise principal. O armazenamento KV pode levar um curto tempo para propagar uma atualização. O token temporário usado na primeira implantação expira em 22/10/2026; a atualização mensal pelo painel KV usa sua sessão Cloudflare e não depende desse token.

O login usa uma senha nova, um segredo exclusivo no servidor, limite de tentativas e cookie `HttpOnly`, `Secure` e `SameSite=Strict`. O Worker não disponibiliza rota para gravar dados pelo navegador. Para encerrar todas as sessões, troque `ZUVORI_SESSION_KEY`. Os limites gratuitos e as regras de preço devem ser conferidos antes do deploy na [página de Workers](https://developers.cloudflare.com/workers/platform/pricing/) e na [página do KV](https://developers.cloudflare.com/kv/platform/pricing/).
