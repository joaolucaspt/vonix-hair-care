# Vonix Hair — C35, continuação rigorosa da auditoria integral

**10/11/2026 | Projeto:** e-commerce operacional Vonix Hair, somente `C:\Users\JL\code\vonix-hair-care`; branch `fix/vonix-ecommerce-auditoria-2026-11-09`. Base confirmada C34 `9c48756`, PR upstream #26 aberto e com CI 4/4 green antes das novas modificações. **Sistema independente de afiliadas preservado.**

## Diagnóstico, reprodução e correção

**N148 | P1 — comunicação incorreta da elegibilidade de frete grátis na ficha de produto.** A regra comercial e o servidor conferem o subtotal **bruto**, antes dos descontos: pedido precisa exceder R$ 150 em produtos e depende de transportadora disponível para o CEP. A página de produto, porém, passava o valor `sel.net` ao componente `ShippingCalc`, que utilizava `hasFreeShipping(subtotal)` para decidir se explicava a gratuidade. Isso ocultava o aviso mesmo quando o servidor retornava uma opção gratuita.

**Prova RED (antes da correção):** no produto `queratina-em-gel`, 2 × R$ 81,90 = **R$ 163,80 brutos**; desconto de volume de 12% gera R$ 144,14 líquidos. O mock controlado do servidor retorna Correios PAC `free=true`, mas o aviso de elegibilidade `Frete Grátis — pedido acima de R$ 150` não aparecia. O teste integrado `src/test/product-page-navigation-audit.test.tsx` falhou exatamente nessa verificação (sem transportadora real e sem cobrar ninguém).

**Correção GREEN:** `src/routes/produto.$slug.tsx` passa `sel.gross` para o cálculo explicativo, preservando o preço líquido para exibição, quantidade, compra e analytics. A mensagem agora explica que o limite é calculado **antes dos descontos**, inclusive descontos por volume, não apenas Pix. Frete gratuito **nunca é inventado**: a mensagem só aparece com cotação confirmada em `opts.some(o => o.free)` e subtotal bruto elegível. O servidor, escolha de transportadora e total monetário não foram modificados. O teste integrado passou após a mudança.

**N149 | P2 — cobertura insuficiente das variantes.** Acrescentado teste em `src/test/pricing.test.ts` comparando `checkoutTotals(...).freeShipping` e `hasFreeShipping(gross)` para os **42 produtos ativos, 46 variantes e quantidades 1, 2, 3 (138 combinações)**. Cobre especificamente cenários com subtotal bruto acima do limite, mas líquido abaixo. Todos passaram.

## Auditoria de regressão e evidências C35

| Escopo | Resultado comprovado |
| --- | --- |
| Vitest completo | **726/726 PASS em 87 arquivos** |
| Focados (PDP, checkout e preço) | **113/113 PASS em 3 arquivos** |
| TypeScript / ESLint funcional / build local Nitro | **0 / 0 / 0** código de saída |
| Warnings históricos de ESLint | **12**, nenhum erro |
| Formatação / diff-check | **PASS / PASS** |
| SSR ativo | **42/42 PDP HTTP, SEO e structured data, 0 falhas** |
| Rotas/sitemap e integridade de catálogo | **15/15 HTTP, 42 produtos ativos, 129 referências a imagens** |
| Meta CSV local | **42 linhas, zero divergências e duplicatas; não equivale a inventário real** |
| Chrome hidratado | **3/3 crossflow + 3/3 checkout**, viewports 320, 390 e 1366, rede externa bloqueada |
| HTML SSR sem JavaScript | **3/3 verificações de conteúdo `noscript`**; renderização visual realmente sem JS **não homologada** |
| Evidências visuais | **21 screenshots** |
| Pagamentos, pedidos e integração ao vivo | **0 realizados** |

Comprovantes: `docs/VONIX_SSR_PREFLIGHT_C35_20261110.json`, `docs/VONIX_META_FEED_READINESS_C35_20261110.json`, `qa-artifacts/vonix-c35/`, `scripts/qa-c35-*.mjs` e recibo `docs/VONIX_C35_VERIFIED_RECEIPT_20261110.json`.

## Operação e limites de conclusão

**Produção NOT_APPROVED**. O novo defeito de comunicação foi corrigido na branch em revisão, **não** no domínio publicado. Continuam os bloqueios P0 já demonstrados no C34: Meta `in stock` 42/42 sem validação de saldo vendável por SKU/variante no Bling; Appmax sandbox Pix/cartão, antifraude e conciliação real de pedidos; dimensões/pesos e prazos de transportadoras; Supabase/Cloudflare staging isolado, RLS, backup/restore e rollback. Acompanhar também LGPD/depoimentos e eventos GA4/Meta conciliados com pedidos pagos.

**Proibições preservadas:** não ler `.env`, dados privados, banco operacional ou credenciais; não criar pedido nem cobrança real; não publicar, mesclar PR, alterar Meta Ads ou outros projetos. Teste de navegador com rede externa bloqueada. A integração na `main`, deployment e afirmações de disponibilidade exigem evidências próprias e autorização operacional.
