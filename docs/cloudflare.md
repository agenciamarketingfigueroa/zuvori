# Alternativa de publicação com Cloudflare Access

O Worker com login visual da Zuvori e dados privados já está publicado. A configuração ativa está em [cloudflare-worker.md](cloudflare-worker.md). O restante desta página registra a alternativa com Cloudflare Access e não descreve a implantação atual.

As instruções abaixo não foram aplicadas à implantação atual.

A página inicial em `/` autentica no servidor local e no Worker publicado. A credencial em texto não está no build nem no repositório. O Worker atual usa um verificador de senha guardado como segredo na Cloudflare.

Cloudflare Access pode proteger **todas** as rotas hospedadas, mas mostrará a tela de login dele antes da Zuvori. O formulário de usuário e senha já funciona na implantação atual com Worker e KV. O roteiro a seguir serviria apenas para uma implantação alternativa com Pages e Access.

1. Criar um projeto **Cloudflare Pages** conectado ao repositório GitHub. Usar `npm run build`, diretório de saída `dist` e raiz do projeto atual. As Functions em `functions/` precisam ser compiladas junto; não fazer upload só dos arquivos estáticos para uma hospedagem desprotegida.
2. Definir um domínio ou subdomínio e criar uma aplicação **Cloudflare Access** para todo o hostname. Autorizar somente o e-mail desejado, com código de uso único ou provedor de identidade. Não usar política de bypass.
3. Definir `ACCESS_TEAM_DOMAIN=https://SEU-TIME.cloudflareaccess.com` e `ACCESS_AUD` (AUD da aplicação Access) nas variáveis do projeto, tanto produção quanto previews quando aplicável. São identificadores de configuração, não senhas.
4. Proteger também os endereços `pages.dev` e previews ou redirecioná-los para o domínio protegido. O middleware é uma segunda barreira: sem configuração responde 503; sem JWT válido responde 403, inclusive para arquivos estáticos.
5. Validar, em janela anônima, que visitante sem autorização não recebe HTML nem assets e que apenas o e-mail autorizado entra. Confirmar fluxo de logout/expiração antes de usar como ambiente privado. A proteção real depende da configuração da conta Cloudflare, não apenas deste código.
6. No navegador autorizado, importar o backup privado pelo aplicativo. Dados financeiros continuam locais; nenhum PDF ou JSON financeiro é enviado no build. Sincronização, recuperação de conta e armazenamento multiusuário ficam para uma etapa com backend próprio.

O middleware valida a assinatura RS256, emissor, audiência e validade do JWT usando as chaves públicas da organização. Respostas não são armazenadas em cache. Configurações ausentes não liberam acesso.

Referências oficiais: [Cloudflare Pages — domínios](https://developers.cloudflare.com/pages/configuration/custom-domains/), [criar aplicação Access](https://developers.cloudflare.com/learning-paths/clientless-access/access-application/create-access-app/) e [validar JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
