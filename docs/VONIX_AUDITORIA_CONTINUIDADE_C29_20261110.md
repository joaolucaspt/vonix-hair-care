# Vonix Hair — Auditoria C29: recuperação da busca, sacola segura, privacidade e feed Meta

**Data:** 10/11/2026. **Projeto exclusivo:** e-commerce operacional Vonix Hair em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. Base C28 `aeb0689`. **Não é o sistema independente de inscrições de afiliadas. Não alterar produção.**

## Achados, correções e impacto para o cliente

| ID | Área | Antes | Resultado C29 |
| --- | --- | --- | --- |
| **N118** | Carrinho | No carrinho completo, o botão `−` de uma unidade executava `setQty(...,0)`, removendo o produto sem tocar em `Remover`. A gaveta já tinha correção C27, mas o carrinho não. | Botão diminuir desativado em quantidade 1; remover continua independente. Botão aumentar tem estado desabilitado evidente em 99; subtotal e ofertas não foram alterados. |
| **N119** | Busca | `cafe verde combo` ou `verde combos cafe` falhavam: alias Combo → Kit só funcionava na primeira palavra. | Alias legado corrigido palavra a palavra, em qualquer ordem, preservando todos os termos obrigatórios e filtros. |
| **N120** | Busca por tamanho | `botox 1kg` podia não encontrar o produto mesmo que `1Kg` fosse uma variante real. | Indexa também os rótulos das variantes do catálogo; `botox 1kg` passa, `botox 2kg` não deve passar sem tamanho correspondente. |
| **N121** | SEO/privacidade | A página de sacola pessoal `/carrinho` não apresentava diretiva `noindex`. | `noindex, nofollow` nos metadados, como checkout e outras páginas individuais; o sitemap não contém carrinho. |
| **N122** | Feed Meta — **P0 aberto** | `/api/public/meta-catalog` publica **42/42 `in stock`**, embora só haja uma exclusão estática `OUT_OF_STOCK` e nenhuma evidência de estoque sincronizado por SKU/variante nesta sessão. | **Não foi inventado estoque, nem desligados anúncios.** Novo pré-flight CSV cruzou IDs, produtos, preços, preços promocionais, imagens e links com o catálogo local: **42 linhas, zero divergências/IDs duplicados**. A **disponibilidade permanece NOT_VERIFIED**, exigindo Bling e revisão da campanha antes de publicar/modificar o feed. |
| **N123** | Prova social | Seção da home afirmava serem “depoimentos reais de cabeleireiras” sem prova de identidade/procedência verificada nesta auditoria. | Copy prudente: “Experiências compartilhadas com a Vonix Hair sobre o Botox Vonix”. As imagens e textos não foram inventados, editados ou removidos; origem/autorização continuam pendentes de documentação. |

## Execuções e validação real

- **Vitest completo:** **669/669 PASS em 83 arquivos**, com três novos testes de carrinho e novas asserções de busca. Alguns testes antigos do checkout ainda emitem aviso React `act(...)`, **não falha da suíte**.
- **TypeScript `npx tsc --noEmit`: exit 0**; **ESLint integral funcional `npx eslint . --rule 'prettier/prettier: off'`: exit 0**; **build Nitro/Cloudflare local: exit 0**. Prettier dos arquivos alterados e `git diff --check` também verificados.
- **Chrome local, navegação sintética sem rede externa**, `scripts/qa-c29-search-cart-chrome.mjs`: **3/3 PASS** em 320, 390 e 1366 px, 9 screenshots, 0 erros JavaScript. Cada teste cobre: query `verde combo cafe`, query `1kg botox`, adição de 1 kit no PDP, carrinho `−` bloqueado em 1, `+` habilitado e somando 2, `+` bloqueado em 99, remoção explícita, estado vazio e meta `noindex`.
- **SSR completo:** `scripts/qa-c29-ssr-storefront.mjs` **42/42 produtos ativos PASS**, SKU `plex-vonix` excluído HTTP 404; `docs/VONIX_SSR_PREFLIGHT_C29_20261110.json`. Uma primeira cópia do script via PowerShell sem UTF-8 causou **42 falsos erros de comparação textual** (`atÃ©`, `cotaÃ§Ã£o`); o script foi regenerado explicitamente com UTF-8, reexecutado e aprovado **42/42**. Não classificar o erro de ferramenta como regressão do e-commerce.
- **Auditoria de feed CSV:** `scripts/qa-c29-meta-feed-readiness.mjs`, `docs/VONIX_META_FEED_READINESS_C29_20261110.json`. **Formato e correspondência: aprovados, 0 divergências para 42 linhas**. **Estoque: 42 alegações não verificadas, gate BLOQUEADO.** Esse script não acessou Bling, conta Meta, PostgreSQL nem API privada.
- Nenhuma cobrança Pix/cartão, cliente real, CEP real enviado a transportadora, review real, migração de banco, publicação ou anúncio alterado nesta execução.

## Bloqueios P0 que impedem a liberação

1. **Meta + Bling:** reconciliar produtos e variantes com saldo físico auditável, aprovação do lojista para o feed, periodicidade de atualização e tratamento de SKU sem saldo. **Não trocar `in stock` por `out of stock` em massa nem devolver 503 em produção sem plano de ads/estoque**, pois isso pode desativar campanhas. A ausência de prova não demonstra indisponibilidade.
2. **Appmax sandbox isolado:** Pix/cartão, antifraude, recusa, expiração, `paid_at`, conciliação, tempo de confirmação e proteção contra cobrança duplicada.
3. **Supabase staging:** migrações, RLS, service_role, dados sintéticos, concorrência, backups/restore, idempotência de checkout, sem tocar no banco operacional.
4. **Logística e Worker:** cotação real de CEP/prazo/preço, estoque e dimensões Bling, runtime Cloudflare staging, headers/WAF, rede móvel fria e rollback.
5. **LGPD e mensuração:** revogação após pedido, consentimento em dados e CAPI, origem de reviews e contadores, propriedade GA4 e reconciliação financeira de compras pagas por canal/dispositivo.

**Importante:** não há prova de que essas melhorias tenham aumentado vendas ou de que o feed tenha causado ausência de vendas. Sem extratos de tentativas Appmax, fonte de pedidos pagos, custos/canais e sessões por etapa, a hipótese comercial segue **INCONCLUSIVA**. **Produção NOT_APPROVED.** Preservar PR #26 sem merge e sem deploy até homologação operacional.
