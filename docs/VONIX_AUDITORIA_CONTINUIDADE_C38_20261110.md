# Vonix Hair — Continuidade da auditoria rigorosa C38

**Data:** 10/11/2026. **Projeto isolado:** e-commerce operacional Vonix Hair em `C:\Users\JL\code\vonix-hair-care` e branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. **Base confirmada:** C37 `1729c062b2762d5c44681d05f1c14313bbdbc4e7`, PR OPEN/CLEAN, CI 4/4 aprovada, worktree inicialmente limpa.

**Regra de execução:** não confundir com o aplicativo independente de inscrições de afiliadas. Sem dados pessoais de compradores, segredos, banco operacional, transações Appmax, Bling real, anúncios, publicação, merge ou deploy. Os testes desta auditoria usam preços do catálogo local e mocks.

## 1. Problemas reais reproduzidos antes da alteração

### N156 — P1: complemento com desconto inferior ao anunciado após aumentar a quantidade

A vitrine oferecia complementos com **5%** (`comp5`). Porém, a regra comercial da própria loja é **12% para 2 unidades e 15% para 3 ou mais**, por produto e variante, sem acumular porcentagens. Uma vez adicionado o complemento ao carrinho, aumentar a quantidade preservava `offer: "comp5"`, mantendo só 5%, mesmo após o comprador atingir o volume maior.

**Caso comprovado por teste RED:** 1 unidade do Sérum Argan 60 ml a R$ 92,90, como complemento de um kit, custa R$ 88,26 após 5%. Ao aumentar para 2 unidades, a sacola antiga calculava **R$ 176,52** (2× oferta 5%) em vez de **R$ 163,50** (12% no subtotal bruto R$ 185,80). Com 3 unidades, deveria calcular **R$ 236,90** (15% do subtotal bruto R$ 278,70), e não conservar 5%. O teste `src/test/pricing.test.ts` falhou exatamente por manter `comp5` em quantidade 2.

**Correção:** `lineTotals` considera `comp5` apenas para 1 unidade, e `migrateCart` remove a promoção 5% ao atingir 2+ unidades, preservando desconto por volume. Itens repetidos do mesmo SKU/variante são consolidados com regra de volume, inclusive caso de múltiplos complementos unitários. O complemento de **uma unidade** continua recebendo seus 5% originais, sem alterar preço de catálogo.

### N157 — P1: checkout servidor cotava menos desconto para aba com oferta antiga

O servidor aceitava `{ offer: "comp5", qty: 2 }` e passava à transportadora preço unitário **R$ 88,26**, em vez dos **R$ 81,75** corretos com promoção de 12%; na criação de pedido poderia manter indevidamente o sufixo `-comp5`. Isso cria divergência entre regra da loja e valores transmitidos ao checkout.

**Teste RED:** `src/test/checkout-security.test.ts` inspecionou os parâmetros recebidos pelo mock de frete e verificou que o valor transmitido era o errado. **Correção:** `buildLines` normaliza `comp5` de 2+ unidades para a promoção maior antes da cotação ou pagamento, eliminando o sufixo promocional incorreto. O guard `quotedTotalCents` segue obrigatório nos clientes atuais, bloqueando tentativa de cobrar preço diferente do conferido pelo comprador. Nenhuma integração de gateway real foi acionada.

### N158 — P2: servidor aceitava duas linhas separadas do mesmo SKU/variante

A sacola do navegador consolida unidades repetidas, mas o endpoint de cotação/checkout aceitava payloads diretos como dois registros `qty=1` da mesma variante. Isso permitiria calcular duas linhas sem volume, em desacordo com a sacola que as combina em duas unidades.

**Teste RED:** a cotação retornava sucesso para duas linhas idênticas. **Correção:** `buildLines` rejeita duplicatas da mesma combinação SKU+variante **antes de acessar cotação externa, reservar tentativa de checkout ou criar cliente/pagamento**, exigindo revisão da sacola. Diferentes variantes de um mesmo produto continuam permitidas.

## 2. Testes e evidências C38

| Verificação | Resultado efetivo |
| --- | --- |
| Vitest integral | **745/745 PASS, 88 arquivos** |
| Regressões direcionadas preço, segurança, sacola e persistência | **98/98 PASS em 4 arquivos** |
| Preços de `comp5` contra volume para 46 variantes × quantidades 2, 3, 4 e 99 | **184/184 comparações** |
| TypeScript `npx tsc --noEmit` | **EXIT 0** |
| ESLint funcional | **EXIT 0**, 12 avisos históricos de Fast Refresh, 0 erros |
| Build Nitro/Cloudflare local | **EXIT 0**, sem staging/publicação |
| Prettier / `git diff --check` | **EXIT 0 / EXIT 0** |
| SSR das fichas públicas ativas | **42/42 PASS**, item aposentado `plex-vonix` 404 |
| Rotas, sitemap e imagens | **15/15 rotas, 129/129 referências**, todas locais |
| Feed Meta CSV local | **42 linhas e 0 divergências estruturais**; não prova disponibilidade Bling |
| Chrome navegação integrada | **3/3 PASS (320, 390, 1366 px)** |
| Chrome checkout com serviços externos bloqueados | **3/3 PASS** |
| Chrome específico de promoção **real na UI** | **3/3 PASS**: kit base → complemento 5% → 2 un. 12% → 3 un. 15%; confirma DOM, preço e `localStorage` |
| HTML de fallback sem JS | **3/3 verificações** de marcação SSR, não prova renderização visual real sem JS |
| Capturas Chrome | **27 PNGs**: 21 das jornadas C37 reaplicadas + 6 dos preços 2/3 unidades |

**Registros RED:** `qa-artifacts/vonix-c38/logs/pricing-red.log` e `qa-artifacts/vonix-c38/logs/server-red.log` (testes sintéticos antes do patch). **Registros GREEN:** `qa-artifacts/vonix-c38/logs/full-vitest.log` e `focused-green.log`; artefatos e resultados de navegador sob `qa-artifacts/vonix-c38/`. Scripts reproduzíveis em `scripts/qa-c38-*.mjs` e preflight SSR/Meta em `docs/VONIX_SSR_PREFLIGHT_C38_20261110.json` e `docs/VONIX_META_FEED_READINESS_C38_20261110.json`. O recibo C38 registra hashes SHA-256.

## 3. Situação operacional e riscos ainda abertos

**PRODUÇÃO NOT_APPROVED.** O patch desta branch não está automaticamente no site público. O trabalho validado é de código e navegador local, não de entrega ao cliente final.

- **P0 estoque:** as 42 ofertas do feed Meta continuam usando `in stock` sem confirmação de estoque vendável em Bling por SKU/variante. Preços do catálogo não substituem inventário; não alterar campanhas sem validação.
- **P0 pagamentos:** falta homologação Appmax em sandbox aprovado (Pix, cartão, antifraude, webhook, conciliação de pedidos pagos, estornos e idempotência).
- **P0 frete:** pesos e dimensões reais, transportadoras e cotações representativas por CEP não verificados. As rotas de QA bloqueiam redes externas.
- **P0 staging:** Cloudflare Worker / Supabase isolados, migrações/RLS, restore/backup, observabilidade, WAF e rollback.
- **P1 conformidade e eventos:** prova de consentimento LGPD, origem de depoimentos, GA4/Meta conciliados com `Purchase` de pedidos efetivamente pagos.

**Nenhum merge, deploy, pagamento, pedido real, dado operacional, segredo, campanha ou projeto independente de afiliadas foi alterado neste ciclo.** Para declarar que o e-commerce está pronto para produção, ainda são necessárias as evidências dos gates reais e autorização operacional explícita.
