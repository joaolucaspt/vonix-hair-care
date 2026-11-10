# Vonix Hair — Auditoria rigorosa e correção de integridade de sacola C37

**10 de novembro de 2026 | Escopo:** somente o e-commerce operacional em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. **Base validada:** C36 `c091761` e CI do PR 4/4 green antes do novo ciclo. Não modificar afiliadas, outros projetos, arquivos de produção/segredos, banco operacional, anúncios ou cobrança de clientes.

## 1. Sumário da falha e repro RED

**N153 | P1 — perda de itens adicionados à sacola enquanto um pagamento anterior aguardava confirmação.** A função `finish()` em `src/routes/checkout.tsx` executava `c.clear()` incondicionalmente quando recebia um status de pagamento autorizado da Appmax (Pix ou cartão). O callback usava `c.lines` da sacola **atual** para emitir `Purchase`, mesmo quando a compra tinha sido enviada com outro conjunto de itens. Assim, um cliente poderia pagar um Pix, voltar às compras, adicionar um novo produto e, quando a Appmax confirmasse o pagamento antigo, ter a nova sacola apagada. Além disso, os novos SKUs poderiam ser atribuídos incorretamente à transação antiga no pixel/GA4.

**Reprodução concreta antes do patch:** foram criados dois testes sintéticos em `src/test/checkout-audit.test.tsx`, um para cartão com ordem pendente restaurada e outro para Pix restaurado. O pedido anterior aguardou `getOrderStatus`, a sacola foi alterada, e o mock autorizado confirmou `paid=true`. Ambos falharam **RED**: o checkout chamou `mocks.cart.clear()` sobre a sacola nova. **Sem chamada real a gateway ou banco.**

## 2. Correção e segurança

- Módulo novo `src/lib/pending-purchase-basket.ts`: salva em `sessionStorage` **somente identificador de pedido e identidade não pessoal dos itens** enviados (slug, variante, quantidade, oferta), com vencimento de 24 horas, limite de entradas, validação de tipos e checagem de ordem. Não armazena CPF, telefone, e-mail, endereço, cartões, tokens ou uma declaração de aprovação de pagamento.
- Após a resposta real de **criação de Pix ou cartão**, registra o conjunto de itens **que foi enviado no pedido**; **não substitui esse registro** se a resposta for apenas `method="verification"`, pois nesse caso o servidor pode estar recuperando um pedido anterior e a sacola atual não prova a identidade da compra.
- Quando o status **autenticado** da Appmax confirma pagamento, a sacola é limpa **somente se** SKU/variante/quantidade/oferta ainda corresponderem exatamente ao pedido original. Uma sacola com item adicionado, removido, alterado ou com snapshot ausente/vencido é mantida. Confirmação de compra continua exibida normalmente, sem induzir nova cobrança.
- O evento `Purchase` mantém `transaction_id` e valor informado pelo servidor. Só inclui dados de itens e frete do carrinho atual quando a correspondência está comprovada; caso contrário, omite esses dados para **não inventar produtos** da compra antiga. Isso é proteção de consistência do evento do navegador, **não homologação de GA4/Meta ou CAPI**.
- O registro temporário de itens é descartado para aquela ordem depois da finalização. A validação de status, políticas de idempotência, antifraude e recuperação do pagamento **não foi alterada**.
- Para sessões antigas sem snapshot, não há base confiável para limpar automaticamente; a regra é **preservar a sacola**, evitando perda de produtos por suposição.

## 3. Novas verificações

Foram acrescentados **9 testes**: testes de integração Pix/cartão pendente com sacola nova, recuperação sem associar sacola nova a um pedido antigo, armazenamento de itens após novo Pix e validações do helper para comparação de variante/quantidade/oferta, exclusão por ID, TTL, dados adulterados, limite e ausência de PII. Também foi ajustado o teste preexistente de cartão restaurado para fornecer o snapshot legítimo; ele continua comprovando que o carrinho da compra efetiva é limpo apenas depois de status pago autenticado.

| Verificação | Resultado |
| --- | --- |
| Vitest geral | **739/739 PASS em 88 arquivos** |
| Checkout/persistência dirigidos | **93/93 PASS em 4 arquivos** |
| TypeScript, lint funcional, build Nitro, Prettier e diff check | **EXIT 0** para cada um; 12 avisos históricos de Fast Refresh, 0 erros |
| Product detail SSR | **42/42 PASS**, produto retirado responde 404 |
| Rotas/sitemap/arquivos de mídia | **15/15 PASS**, 42 produtos ativos, 129/129 imagens presentes |
| Meta CSV **local** | **42/42 linhas, 0 divergências de preço, link, ID ou imagem**; estoque real não comprovado |
| Chrome integrado | **3/3 vitrine/carrinho** e **3/3 checkout**, em 320, 390, 1366 px, sem rede externa |
| Chrome sem JS | **3/3 verificações do HTML bruto `noscript`**; não comprova renderização visual real sem JS |
| Screenshots | **21 imagens PNG** sob `qa-artifacts/vonix-c37/` |

**Transparência sobre a execução de navegador:** primeira rodada simultânea de Chrome teve **2/3 no crossflow**, porque a checagem de `sessionStorage` para público salão foi feita 900 ms após a navegação e encontrou temporariamente `casa`, enquanto o título da página já indicava salão. O teste passou a aguardar a condição de armazenamento real, sem depender de atraso fixo; a **reexecução isolada terminou 3/3**. O resultado inicial com erro e a reexecução estão preservados em `qa-artifacts/vonix-c37/logs/crossflow.log` e `crossflow-confirmed.log`. Não há evidência suficiente para classificar o evento inicial como defeito de produção. Foi alterado somente o script de QA, sem mudar a regra comercial de público.

Evidências estruturadas: `docs/VONIX_SSR_PREFLIGHT_C37_20261110.json`, `docs/VONIX_META_FEED_READINESS_C37_20261110.json`, `qa-artifacts/vonix-c37` e `docs/VONIX_C37_VERIFIED_RECEIPT_20261110.json`. Todos os testes financeiros são sintéticos e não geram pedidos/cobranças reais.

## 4. Bloqueios que permanecem abertos

**PRODUÇÃO NOT_APPROVED.** O checkout local está mais resistente a confirmações tardias, mas isso não significa que o site publicado já tenha a correção. Faltam evidências reais para os mesmos gates P0 dos ciclos anteriores: estoque vendável Bling por SKU/variante versus os 42 `in stock` do Meta feed, Appmax sandbox de Pix/cartão/antifraude/webhook e `paid_at` reconciliado, dimensões/pesos e fretes reais, staging Cloudflare/Supabase com backup/restore, RLS e rollback. LGPD, procedência de reviews e deduplicação GA4/Meta por pedido realmente pago continuam pendentes.

**Sem merge, deploy, alteração de ad account, transações, dados pessoais ou leitura de secrets.** O PR #26 deve permanecer aberto até haver autorização explícita de integração/publicação com gates operacionais comprovados.
