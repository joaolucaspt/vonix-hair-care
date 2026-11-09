# Vonix Hair — auditoria C8: confirmação financeira confiável e funções SQL isoladas

**Data:** 09/11/2026 · **Projeto único:** `C:\Users\JL\code\vonix-hair-care` · **PR:** #26 · **Base anterior:** `8a611b8`.

## N38 — área “Meus pedidos” confiava em paid=true no navegador

**Antes:** `/conta` carregava `result: card.paid ? "paid" : null` diretamente de `sessionStorage`. Um campo adulterado poderia produzir a mensagem **“Pagamento confirmado pela Appmax” sem consulta à Appmax**. Estado local não é prova de transação financeira.

**Correção:** ao recuperar o pedido, a interface sempre inicia com status **não verificado**. O status “pago” só é apresentado após `getOrderStatus` retornar `{ok:true, paid:true}` com token de capacidade validado pelo backend e consulta à Appmax. A mudança não envia cobranças nem altera pedidos.

## N39 — recarregar checkout podia descartar pedido se a sessão dissesse paid=true

**Antes:** o checkout restaurava `PendingCard` somente quando `pending.paid` fosse falso. Um estado adulterado com `paid:true` fazia a compra pendente desaparecer da interface, expondo novamente o formulário e facilitando tentativa repetida. **A idempotência server-side ainda existe, mas a interface não pode induzir esse caminho.**

**Correção:** qualquer `PendingCard` válido é restaurado **como não verificado**; o pedido permanece em análise, sem botão para criar outro Pix/cartão. Uma resposta autenticada posterior da Appmax pode confirmar a compra. Em caso de falha do provedor, nenhuma confirmação é inventada.

Também foi introduzida reserva de consulta por `orderId` na interface de pedidos: cliques repetidos durante uma resposta pendente não disparam RPCs paralelas de acompanhamento. Isso não substitui rate limiting na borda.

## N40 — funções SQL SECURITY DEFINER usavam search_path amplo

**Antes:** as três funções privilegiadas do estado de compra (`vonix_checkout_claim`, `vonix_checkout_advance`, `vonix_checkout_finalize`) definiam `set search_path = public`. Isso amplia o risco de resolução de objetos inesperados em uma função SECURITY DEFINER.

**Correção:** as três funções usam `set search_path = ''`; as tabelas já são chamadas com qualificação `public.*`, e funções internas são resolvidas pelo catálogo do PostgreSQL. **Nenhum SQL operacional foi executado**: a alteração exige revisão, backup e aplicação autorizada em Supabase staging.

A prova reproduzível `scripts/qa-checkout-idempotency-hardened.sql` é protegida por verificação de nome do banco `vonix_synthetic` e `ROLLBACK`; cobre reserva exclusiva, recusa a token inválido, transições, recuperação sem duplicação, pedido concluído bloqueado por 24 h, novo pedido após 24 h, reabertura após cancelamento verificado, funções privadas e `search_path` restrito.

## Verificação permanente no GitHub Actions

A pipeline do **e-commerce**, `.github/workflows/vonix-ci.yml`, agora possui o job `checkout-postgres-qa`, independente dos testes Bun. Ele cria PostgreSQL 16 em `--network none` com dados em `tmpfs`, cria apenas roles sintéticas, aplica a SQL de idempotência e roda a QA que termina com `ROLLBACK`. Não utiliza tokens/segredos dos provedores, não publica portas e remove o contêiner ao sair. O workflow separado de afiliadas permanece intocado. **O job recém-adicionado ainda deve passar no GitHub do novo commit antes de ser considerado aprovado remotamente.**

## Evidência da execução C8

- **445/445 testes Vitest em 59 arquivos**, exit 0. Quatro cenários novos: `paid:true` adulterado em Meus pedidos; confirmação após resposta autorizada; bloqueio de clique simultâneo; restauração segura do checkout; pagamento só confirmado após resposta autenticada.
- **TypeScript:** exit 0; **build de produção Vite/Nitro:** exit 0; **ESLint direcionado:** exit 0.
- **Preflight SSR local:** 43/43 páginas de produto com saída válida; estoque físico não conciliado.
- **Chrome headless local, 320/390/1366 px:** sessão de cartão sintética adulterada `paid:true`/`status:"aprovado"`; HTTP 200, mensagem “Pagamento em análise”, **zero CTA para nova cobrança**, sem declaração de pagamento aprovado, sem token na página, sem overflow e sem erros de JS. Requisições externas e POSTs foram interceptados e não entregues.
- **PostgreSQL 16 isolado:** `--network none`, sem portas públicas, volume de dados em `tmpfs`, apenas pedido 1234/1235 sintético e fingerprints sem PII. Primeiro teste detectou diferença de serialização do `search_path` na assertiva; corrigida a assertiva, segunda execução **PASS**, `ROLLBACK`, contêiner removido. Nenhum pagamento, webhook ou banco de produção foi acessado.
- **Git e CI remoto:** commit e checks devem ser verificados separadamente após o push C8. Nenhum módulo de afiliadas alterado.

## Pendências anteriores não apagadas

**P0:** Appmax sandbox real (Pix, cartão, antifraude, rejeição e timeout); Supabase staging com backup/RLS/concorrência e aplicação das SQLs C5/C8; Bling homologado e estoque por SKU/peso; reconciliação financeira e suporte; LGPD/revogação tardia do Purchase Meta; WAF/rate limit distribuído. **P1:** histórico de preços comparativos, depoimentos, comunicações transacionais, Lighthouse/acessibilidade e métricas de pedidos pagos versus sessões.

**Regra:** até esses critérios serem homologados, o PR segue em revisão; testes locais e CI verde não autorizam merge ou deploy. Roteiro operacional: `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`.
