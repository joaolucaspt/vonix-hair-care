# Vonix Hair — Continuidade sistêmica em Workloop (pós-PR43)

Data: 09/11/2026. Run Autonomous Workloop: `aebb9401-b82c-4e79-86c5-2f94de8f07e7` (definição `b6775bf9-e485-4c51-b6ae-e335b89acedc`).

## Identidade e isolamento
- **Somente** formulário de cinco etapas, triagem administrativa, segurança do cadastro e notificações de decisões do aplicativo Vonix Haircare Showcase.
- Repositório original: `lucassilva1175/vonix-hair-care`, Lovable project `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Worktree exclusiva: `C:\Users\JL\code\vonix-affiliate-workloop-systemwide-20261109`, branch `feat/vonix-affiliate-systemwide-workloop-20261109`.
- Base inicial `e70dbe85f7e6b9419996f5edcef94745ec7fa640`, PR #43.
- Checkout, pagamentos, produtos, app de métricas/comissões e outras worktrees são de outro escopo. Sem leitura de .env ou segredos, sem dados de candidatas, sem deploy, e sem ativar inscrições, e-mails ou qualquer banco real.

## Defeitos diagnosticados por testes sintéticos
1. A página pública carregava a situação de abertura apenas uma vez; uma prévia poderia tornar-se submissão real se o programa abrisse, e a passagem para modo fechado poderia desmontar um formulário em edição. Testes de atualização de estado e rascunho reproduziam o problema.
2. Ao alternar filtros no painel administrativo, cartões contendo dados da consulta anterior permaneciam montados enquanto a nova consulta carregava. Teste com resposta atrasada reproduzia o comportamento.
3. Links externos de Instagram/TikTok com `?query`, `#hash` e porta não padrão eram aceitos no schema público, mas recusados pela própria UI administrativa.
4. A reserva da fila de notificações não era validada antes de chamar Resend; retorno SQL inconsistente poderia selecionar destinatário incorreto ou extrair apenas a primeira notificação de uma resposta múltipla. Testes reproduziram a falta de bloqueio.

## Correções implementadas
- Atualização de disponibilidade ao focar/reativar a aba com versões para ignorar respostas atrasadas, mantendo o cadastro fechado por padrão.
- Prévia preservada como **simulação** mesmo que a abertura seja alterada no servidor; transição explícita para inscrição real recomeça com formulário novo.
- Se o programa fecha durante um cadastro já iniciado, preserva-se apenas a memória do rascunho e o envio fica indisponível, até a reabertura.
- Ocultação dos cartões anteriores enquanto uma pesquisa/filtro do painel está pendente; sessão administrativa já protegida pelos ciclos anteriores.
- Validação consistente de URL HTTPS de perfil social, sem usuário/senha, parâmetros, fragmentos ou porta não padrão.
- Resultado da reserva de e-mails validado por schema estrito quanto ao formato, campos e cardinalidade; nenhuma chamada ao provedor se a reserva é malformada.

## Evidências e limites
- Os testes de regressão foram escritos primeiro e falharam na base anterior; após as correções **71/71 testes focados passaram em 4 arquivos**, incluindo a corrida de requisições fora de ordem.
- Suíte completa local: **252/252 testes aprovados em 32 arquivos**. TypeScript, ESLint, build e diff-check sem erros.
- Chrome headless local: fluxo de cinco etapas em resoluções 390px e 1280px, formulário em prévia, confirmação de privacidade em outra aba sem perda de rascunho, nenhuma requisição de escrita e nenhum erro JavaScript.
- Confirmar CI de PR e CI da main depois da integração; a execução local não substitui a validação independente.
- A simulação nunca deve criar candidaturas nem registrar mensagens reais.
- Dependências ainda não resolvidas: credenciais de servidor Lovable para Supabase dedicado `jewbzrbbvxyqmxqbrwrq`, homologação de proxy, backup/restauração, LGPD, MFA e autorização operacional. `AFFILIATE_RECRUITMENT_OPEN` não será ativado.
