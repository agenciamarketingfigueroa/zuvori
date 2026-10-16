# Validação da primeira versão

- Vinte e um testes automatizados aprovados: centavos, receita/despesa, recebíveis separados da receita realizada, projeções, virada de ano, backups inválidos, autenticação do Worker e proteção JWT da alternativa com Access.
- Os lançamentos dos três PDFs conciliados exatamente com os totais de suas faturas. Documentos originais preservados.
- Conferência visual de páginas dos PDFs do Inter e Nubank MEI. Dados de identificação e boleto não foram incluídos no JSON do aplicativo.
- Chrome: cadastro e edição de receita, cálculo do resultado parcial, busca, exclusão do lançamento de teste, meta de despesas, conciliação dos cartões, marcação local de pagamento e alteração do simulador conferidos em uma origem local separada.
- Temas claro e escuro inspecionados. Layout móvel conferido em viewport de 390 × 844, sem overflow horizontal no dashboard; menu móvel funcionando.
- Build estático não contém a pasta privada. JSON, PDFs, imagens de QA e configuração da importação ignorados pelo Git.

## Limites da conferência

O seletor de arquivos da automação do Chrome não permite enviar arquivos locais sem ampliar a permissão da extensão. Essa permissão não foi alterada. O fluxo de importação foi implementado e a validação do JSON foi testada, mas o envio pelo seletor precisa de um teste manual. A automação também não confirmou o arquivo final do download de backup; o aplicativo solicitou o download sem erro no console. Testar importação e exportação manualmente antes de depender delas como único backup.

A configuração Cloudflare também foi testada isoladamente, incluindo token válido, expiração, audiência e assinatura. Em 15/10/2026, o Worker foi implantado: o login real abriu o dashboard com 104 lançamentos na URL `workers.dev`; sem sessão, `/api/data` foi recusada em `workers.dev`, `zuvori.com.br` e `www.zuvori.com.br`. Os dois domínios abriram a tela de login da Zuvori. O login com senha nos domínios personalizados ainda depende de uma conferência manual no navegador do usuário.
