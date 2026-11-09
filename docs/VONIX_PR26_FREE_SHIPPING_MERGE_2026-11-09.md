# Vonix Hair — merge seguro da política atual de frete grátis

Data: 09/11/2026. Repositório exclusivo: `lucassilva1175/vonix-hair-care`.

## Continuidade exata

- PR original: https://github.com/lucassilva1175/vonix-hair-care/pull/26
- Ponto de partida: `e015388`, que já contém proteção contra cobranças duplicadas, integração com a `main` anterior, CAPI Purchase confirmada pela Appmax e deduplicação persistente no banco.
- Novo commit da `main` recebido em paralelo: `06e3532` ("Frete gratis: mostra so a opcao gratis no checkout").
- Merge elaborado em worktree isolada `integration/vonix-pr26-capi-dedupe-20261109`. A branch original e o backup foram mantidos.

## Conflito textual e resolução

O conflito ocorreu apenas na função `shippingOptions` em `src/lib/checkout.functions.ts`, após a seleção `pickTwoShipping`. Preservamos a nova regra de produto: **quando o benefício de frete grátis existe, apresentar somente o serviço de menor preço com custo R$ 0**; quando não existe, preservar as opções rápida/econômica. A seleção continua recalculada no servidor, evitando aceitar um `serviceId` ocultado pela interface.

## Testes executados nesta sessão

- Vitest completo: **237/237 testes PASS (36 arquivos)**.
- TypeScript `tsc --noEmit`: PASS.
- Build `bun run build`: PASS.
- ESLint dos arquivos alterados: PASS.
- Dois testes adicionais validam frete gratuito com única opção, frete pago com alternativas e rejeição de `serviceId` não apresentado, antes de chamar a Appmax.
- Sem chamadas de pagamento, sem credenciais lidas, sem deploy e sem alterações em banco operacional.

## Pendências bloqueantes para publicar o PR

A aprovação de CI e build **não equivale** à habilitação comercial segura. Permanecem exigidos: aplicar as migrações no Supabase staging com backup validado; testar Appmax sandbox (Pix, cartão, chargebacks, timeouts, antifraude); validar estoque e Bling, concorrência de cobranças, reconciliação de pedidos, entrega Meta CAPI e consentimento/LGPD. Os valores/embalagens de frete precisam refletir o estoque real.

O ponto de retorno para este merge é o commit `e015388`, preservado em branch separada. A `main` e o site publicado não foram modificados.
