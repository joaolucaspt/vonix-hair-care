# Vonix Hair — Integração do PR #26 com atualizações paralelas da main

**Data:** 09/11/2026. Repositório: `lucassilva1175/vonix-hair-care`. Trabalho feito em cópia isolada, sem mexer em instalações, pagamentos, segredos ou banco real.

## Contexto

O PR #26 (proteção de checkout, reconciliação, idempotência durável, Bling, migrações) ficou em conflito depois que terceiros atualizaram a branch `main`, antes em `5e7d547`.

Commits paralelos incorporados:
- `0db07f984b94a219b4ad43f741ec9959f2cd3d1f`: checkout mais enxuto, frete com opções rápida/econômica, imagens comprimidas e Clarity carregado após a página.
- `e6fb7ae24909d054b3a13b20b28586f4d142c31c`: cartões de oferta com preços não cortados.
- Commits anteriores da mesma sequência incluem Meta Conversions API com `eventID` correspondente aos eventos do pixel, além de testes de seleção de frete.

## Resolução de conflito

Conflito textual real: `src/lib/checkout.functions.ts`, na seleção de frete. A versão do PR exibia todas as cotações e pressupunha que a primeira era a econômica. A versão recente da `main` usa `pickTwoShipping(quotes)` e calcula qual oferta é a mais barata. Preservamos a lógica recente de frete **com todas as verificações de preço/pagamento/idempotência do PR #26**.

Os merges de `src/routes/checkout.tsx`, `src/routeTree.gen.ts`, analytics, nova API Meta e imagens otimizadas foram automáticos. A última alteração em `src/routes/produto.$slug.tsx` também foi incorporada sem conflito.

## Segurança da API de Conversões Meta

A nova integração CAPI da `main` permitia ao navegador enviar `Purchase` diretamente à rota `/api/public/meta-event`, sem confirmação Appmax, favorecendo conversões falsas e deterioração da otimização dos anúncios. A integração foi reforçada:

- O endpoint público rejeita `Purchase` com HTTP 403; aceita somente eventos não financeiros predefinidos, com ID e URL válidos, limite de **16 KiB** e leitura com tempo máximo.
- Verificação de domínio por **origem exata**, não por prefixo de texto, para evitar `https://vonixhair.com.attacker.example`.
- O Pixel do navegador continua registrando `Purchase` quando o checkout confirma pagamento, mas não solicita `Purchase` à CAPI pelo endpoint público.
- A CAPI `Purchase` do servidor exige um objeto de pedido consultado na **API autenticada da Appmax**, com `isPaid`, snapshot local de preços e `event_id=purchase-ORDER_ID`. O worker faz o envio em caráter **best effort**, sem bloquear a expedição.
- Repetições de mensagens para a Meta usam o mesmo `event_id` para apoiar a deduplicação. **Persistência de entrega, consentimento e limitação distribuída de requisições continuam pendentes** de homologação em staging.
- Os testes verificam rejeição de `Purchase` público, spoofing de domínio, limites de payload, autorização/antifraude e valores de venda derivados do snapshot.

## Evidências

- Versão integrada com a `main` até `e6fb7ae`: **227/227 testes aprovados (35 arquivos)**, TypeScript e build PASS. Lint funcional focado em checkout/frete/Meta sem erros.
- As migrações `supabase/vonix-order-snapshots.sql`, `supabase/vonix-checkout-idempotency.sql`, `supabase/vonix-order-outbox.sql`, `supabase/vonix-bling-token-store.sql` passaram em PGlite isolado; **não foram aplicadas em Supabase staging/produção**.
- Nenhum pagamento real, chamada autenticada de ERP, compra real, deploy ou merge em `main` foi realizado nesta integração.

## Restrições para ativar produção

Permanece obrigatório configurar segredos no backend, homologar o checkout e os estados Appmax em sandbox, aplicar/testar SQL num Supabase staging autorizado, validar a integração Bling e assegurar backup/rollback e reconciliação. Até lá, não autorizar merge nem habilitar pagamentos reais.

A branch de backup preexistente continua intacta.
