# Vonix Hair — C13: recuperação de pedido durante falha de frete/cupom

**Data:** 09/11/2026 · **Escopo exclusivo:** e-commerce Vonix Hair, PR #26 · **Base:** `d109722d0aff3f2232ad569bac91ebc209d1de48`.

## N52 — a indisponibilidade de frete impedia recuperar um pedido já iniciado

Antes, `createPayment` calculava o frete **antes de consultar a reserva de idempotência**. Em caso de transportadora indisponível, uma compra anteriormente iniciada não podia apresentar seu número/valor original, apesar de a proteção do banco ainda impedir cobrança duplicada. O usuário recebia uma mensagem genérica, dificultando acompanhar a tentativa.

**Correção:** quando a cotação falha, `recoverWithoutNewQuote` consulta via **GET read-only** `vonix_checkout_intents`, filtrando apenas pelo HMAC-SHA256 server-side da compra (mesmo comprador, itens físicos e endereço). Não há insert, update, nova reserva ou acesso de navegador às credenciais. Se a reserva já existe e tem número de pedido, o backend carrega o snapshot original, confere o ID, valida o total em centavos e devolve acompanhamento com token assinado. Sem snapshot, sem ID, ou com banco indisponível, **bloqueia uma nova cobrança e não inventa valor**. Sem reserva existente, a falha de frete continua sendo um erro seguro, sem criar pedido.

O SELECT de service_role já está previsto em `supabase/vonix-checkout-idempotency.sql`; **nenhuma migração SQL nova** foi criada. A consulta deverá ser verificada em Supabase staging autorizado, inclusive RLS/anon/service_role.

## N53 — serviço de entrega removido ou cupom inválido ocultava pedido já reservado

Se a cotação atual não apresenta o `serviceId` usado anteriormente, ou se o cupom muda/deixa de ser elegível, uma compra existente não deve ser reprecificada ou impedida de ser consultada. A nova rotina tenta somente a leitura do registro preexistente e, quando existe, usa o snapshot original.

Ao mesmo tempo, mantém a semântica da SQL: reservas **canceladas** e compras **concluídas há mais de 24 horas** não são tratadas como impedimento permanente à nova compra; nesses casos, o checkout exige a cotação/cupom válidos. A única operação que cria uma nova reserva continua sendo o RPC cercado `vonix_checkout_claim`, **após** validação de frete/cupom para compras novas.

## Segurança, evidências e limites

- Teste unitário garante que a recuperação usa GET autenticado com `service_role`, `select=phase,order_id,updated_at`, filtro por fingerprint HMAC e nenhum corpo contendo CPF/endereço/cartão
- Testes: queda de frete em pedido novo/existente; opção de entrega antiga removida; cupom inválido após pedido; status cancelado/concluído há 25 horas; reserva sem ID; banco indisponível; snapshot inválido
- **Vitest completo: 524/524 testes, 64 arquivos PASS**
- **TypeScript, ESLint direcionado e build: PASS**
- **SSR: 42/42 produtos ativos, Plex Vonix 404**. O primeiro SSR falhou porque a prévia local estava desligada; após iniciar Vite, repetição PASS. Não confundir falha de infraestrutura local com defeito do catálogo
- **Chrome headless** em 320/390/1366 px: navegação PDP → adicionar produto → carrinho 200; carrinho persistido em `localStorage`; zero overflow e erros de página. Um ensaio inicial em 320 px ocorreu antes da hidratação do Vite em modo desenvolvimento e não persistiu a ação; após aguardar hidratação, passou. **Não existe prova de que isso ocorra na build de produção**, mas vale QA de carregamento frio/CPU lenta
- Solicitações externas do navegador foram interceptadas; **nenhuma cobrança, evento Meta real, e-mail, ERP ou banco de produção** foi acessado
- Preservados arquivos/PRs de afiliadas sem alterações manuais, branch exclusiva de auditoria e worktree existente

## Pendências P0 não resolvidas

Appmax Pix/cartão/antifraude e `payment.paid_at` em sandbox; Supabase staging com backup/restore, RLS, role de service, SQLs C5/C8 e concorrência; Bling e estoque físico/pesos/dimensões por SKU; consentimento LGPD e revogação após pedido, WAF/rate limit distribuído, propriedade GA4 real, pedidos efetivamente pagos e métricas de conversão. Testes locais/CI **não homologam produção**. Não executar merge na main ou deploy até evidências externas e autorização dos responsáveis.

## N54 — integração de interface da main posterior ao C13: BLOQUEIO ABERTO

Após os testes do C13, a `main` avançou até `6ce6952`, incluindo o novo componente `src/components/buy-drawer.tsx`, alterações em `src/routes/checkout.tsx` e em `src/routes/produto.$slug.tsx`, além do PR oficial de afiliadas #42. `git merge-tree --write-tree HEAD origin/main` apontou conflitos reais em **checkout.tsx** e **produto.$slug.tsx**. Também foi encontrada uma alteração **não commitada em checkout.tsx** de outra sessão (repetição de cotação `quoteRetry` e formatação), não criada pelo C13.

**Decisão conservadora:** não fazer merge destrutivo, reset, stash, checkout, sobrescrita ou publicação dos arquivos locais. O C13 foi auditado sobre a base `d109722` anterior à interface nova; seus resultados **não homologam a gaveta Comprar agora nem o checkout compacto da nova main**. A integração posterior é uma pendência separada que exige conciliação dessas telas com o checkout seguro e testes responsivos/retentativas.

A aprovação de CI do commit específico do C13, se ocorrer, apenas confirma a branch testada; **não declara PR integrável com essa nova main**. Manter PR aberto, sem merge ou deploy. Preservar todas as correções de pagamentos/consentimento da auditoria e o trabalho local concorrente.
