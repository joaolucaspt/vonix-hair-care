# Vonix Haircare Showcase — continuidade segura após o PR #47

Data: 09/11/2026 (America/Sao_Paulo). Workloop `1203ab6e-30d1-4a53-8f2e-43244da510fc`, execução `239b55ce-f403-46e7-bae0-a8eb9179da6c`.

## Identidade e isolamento
- Apenas inscrições de cinco etapas, triagem e notificações das candidatas da **Vonix Haircare Showcase** — repositório `lucassilva1175/vonix-hair-care`; projeto Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Worktree isolada `C:\Users\JL\code\vonix-affiliate-workloop-resilience-20261109`, branch `feat/vonix-affiliate-resilience-workloop-20261109`, base inicial `266763f07ea58d46fddc1c31553a0e8831a2cdc7` (PR #47).
- Não tocar nas outras worktrees, e-commerce, checkout, pagamentos, comissões, app separado de métricas, cupons operacionais ou expedição. Não ler `.env`, segredos, informações de candidatas reais ou banco persistente; não habilitar inscrições, mensagens reais ou deploy.

## Falhas reproduzidas
1. **Falso recebimento de candidatura:** `createAffiliateApplication` retornava sucesso para qualquer HTTP 409, incluindo violação de integridade não relacionada a e-mail duplicado. O teste sintético com códigos SQL `23503`, `23514`, `PGRST204` e 409 sem código falhava antes da correção.
2. **Comunicação administrativa imprecisa:** ao aprovar/recusar, o painel não distinguia ausência de configuração do e-mail, fila pendente, erro/resultado incerto e aceitação pelo provedor. Declarava envio concluído mesmo quando não havia prova de entrega. Testes de interface falhavam antes do patch.

## Correções implementadas
- Apenas erro HTTP 409 com SQLSTATE `23505` representa duplicidade e recebe resposta pública indistinguível do sucesso para reduzir enumeração; qualquer outro conflito gera falha genérica sem exibir corpo SQL.
- O backend de aprovação/recusa retorna a situação precisa da notificação: `accepted`, `queued`, `review`, `unconfigured`. A decisão atômica não é revertida por erro de e-mail.
- O painel usa textos coerentes: **aceita pelo provedor; entrega não confirmada**, **registrada na fila**, **conferir/conciliar antes de tentar novamente**, ou **provedor não configurado**. A lista de notificações também evita o termo enganoso "e-mail enviado" quando só houve aceitação.
- Mantidas as proteções anteriores: sessão assinada HttpOnly/MFA, origem, RLS, separação de banco, criptografia de PII e estado inicial das inscrições fechado.

## Evidências
- Regra de não duplicidade e avisos de notificação demonstrados com regressões que falhavam antes do patch, usando somente `fetch` mockado e candidata de teste.
- **69 testes focados em três arquivos aprovados**, TypeScript e ESLint direcionado aprovados, após ajustes.
- **Suíte completa:** 271/271 testes em 32 arquivos, `npx tsc --noEmit`, ESLint dos arquivos alterados, build Vite/Nitro e `git diff --check` aprovados (exit 0).
- **Chrome local:** 390px e 1280px, formulário de cinco etapas somente em prévia, política em nova aba, descarte/cancelamento de rascunho, OTP com seis dígitos, sem POST local nem erros JavaScript.
- CI do PR e da `main` no GitHub serão verificados antes de declarar integração concluída.
- Não houve acesso ou alteração em registro real, env de produção, pagamentos, e-mails reais, Supabase operacional ou deploy.

## Bloqueios operacionais
- Ainda falta comprovar vínculo de credenciais privadas do Supabase dedicado `jewbzrbbvxyqmxqbrwrq` ao runtime do Lovable.
- Aprovações LGPD, proxy confiável, MFA operacional e backup/restauração continuam pendentes.
- `AFFILIATE_RECRUITMENT_OPEN` permanece desabilitado. PR verde não significa lançamento.
