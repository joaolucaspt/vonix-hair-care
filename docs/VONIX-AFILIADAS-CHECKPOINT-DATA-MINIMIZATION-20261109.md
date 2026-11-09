# Vonix Hair — limite de dados no painel privado de afiliadas
Data: 09/11/2026. Base: main após PR #41 (merge 58c740be4ad0e0c937461a42dcd47eac94a128cb).

## Escopo
Trabalho somente no aplicativo Vonix Haircare Showcase (Lovable 203d2f84-1058-4ca4-acc3-41a4a5d4e2b5), exclusivamente inscrições e seleção de afiliadas. Código implementado em worktree independente: C:\Users\JL\code\vonix-affiliate-admin-data-boundary-20261109. Checkout, expedição, comissões, vendas, métricas e demais projetos não foram modificados.

## Correção e garantia
- A RPC de busca do banco retorna uma estrutura privada que contém o questionário criptografado. Ela não deve determinar, sozinha, quais dados são devolvidos ao navegador.
- O backend agora valida cada candidata com um esquema explícito de campos autorizados, transformando a resposta de banco em DTO mínimo de triagem.
- Colunas futuras ou inesperadas (CPF, endereço, dados bancários, tokens, metadados do provedor de e-mail, ciphertext) não passam ao navegador, inclusive se inseridas acidentalmente no JSON da RPC.
- Propriedades da fila de notificações também são restritas a estado e momento de envio; dados privados ou IDs do provedor não são expostos.
- A listagem recusa registros malformados, totais não inteiros, negativos ou fora de limites seguros e contadores de status incompletos/incorretos. A UI recebe uma mensagem genérica de indisponibilidade, sem conteúdo do banco.
- A prévia de retenção LGPD continua somente leitura. Se a RPC devolver números ausentes, malformados ou negativos, o servidor nega a resposta em vez de inventar zeros ou exibir NaN.
- O diagnóstico operacional consulta as RPCs de estatísticas e retenção de forma independente e valida o conteúdo JSON retornado. Um HTTP 200 de endpoint ausente/incompatível já não é marcado como resposta saudável.
- Questionário continua criptografado no banco e apenas o resumo de triagem, calculado no servidor, pode chegar ao painel.

## Testes
- Fixtures sintéticas reproduzem o formato atual da RPC SQL sem acesso a candidatos reais.
- Teste de injeção intencional de campos extras no retorno de banco, inclusive campos aninhados da fila.
- Testes de dados malformados, ausência de contadores, e valores inválidos no relatório LGPD.
- Validar suíte npm test, TypeScript, lint, build e CI no PR antes de mesclar.
- Sem banco real modificado, e-mails, deploy, abertura de inscrições ou credenciais acessadas.

## Dependências operacionais preservadas
- Supabase dedicado: jewbzrbbvxyqmxqbrwrq. A ligação efetiva de segredos no servidor Lovable não está comprovada.
- AFFILIATE_RECRUITMENT_OPEN deve permanecer false/ausente até revisão de governança LGPD, credenciais seguras, proxy, backups, testes de restauração e homologação.
- Não confundir código integrado com publicação aprovada para candidaturas reais.
