# Vonix Hair e-commerce — C22: página de produto, compra móvel e acompanhamento claro

**Data local:** 10/11/2026. **Branch:** `fix/vonix-ecommerce-auditoria-2026-11-09`. **Repositório exclusivo:** `C:\Users\JL\code\vonix-hair-care`. **Base C21:** `29c87de`. **PR:** #26. **Produção: NOT_APPROVED**.

## O problema e a mudança visível

**N86 — alta: compra de quantidade involuntária ao trocar de SKU.** O usuário selecionava 3 unidades de `kit-cachos`, clicava no produto relacionado `kit-banana-e-mel` sem recarregar o site, e o segundo produto **herdava 3 unidades** porque a rota SPA mantinha `useState(qty)`/variante do primeiro SKU. Reproduzido em Chrome real (red) nas larguras **320, 390, 1366 px: 0/3**, com `quantityAfterSwitch=3`, screenshots de antes e depois da troca. Correção em `src/routes/produto.$slug.tsx`: `ProductPurchase` montado com `key={p.slug}` reinicializa sua quantidade, variante e gaveta a cada produto. O carrinho persistido continua intacto. Após correção, Chrome **3/3**, `quantityAfterSwitch=1`; teste React verifica que o clique de adicionar insere só uma unidade do **novo SKU**.

**N87 — média: controle de quantidade pequeno.** Alvos de +/- tinham cerca de 40 px. Foram ampliados para **mínimo 44×44 px**, com descrição incluindo o produto, desabilitação correta em 1 e 99 unidades; opções de variante também ganharam altura mínima de 44 px. Chrome mediu 44×44 nos três tamanhos de tela.

**N88 — média: coração sem feedback de acessibilidade.** O botão de favoritos dizia apenas `Favoritar`, sem `aria-pressed`. Agora informa `Adicionar [produto] aos favoritos` ou `Remover [produto] dos favoritos`, com estado selecionado `aria-pressed`. Testes React e Chrome verificaram os dois estados.

**N89 — média/UX: barra móvel de compra sem valor.** Em `/carrinho`, o CTA fixo dizia somente `Finalizar minha compra`. A versão nova exibe o valor atualizado dos produtos, rotulado **`Produtos, sem frete`** para não prometer o total da cobrança ou a gratuidade da entrega antes do CEP; acompanha alterações de quantidade. Não muda valores autoritativos do checkout. O CTA só aparece após a hidratação e com produtos na sacola.

## Arquivos realmente modificados por este ciclo

- `src/routes/produto.$slug.tsx` — estado de compra por produto, quantidade, variações e favorito.
- `src/routes/carrinho.tsx` — subtotal na barra fixa mobile.
- `src/test/product-page-navigation-audit.test.tsx` — mudança de SKU e segurança da quantidade, limite 99 e favoritos.
- `src/test/checkout-audit.test.tsx` — barra móvel apresenta subtotal sem frete, nenhum pagamento.
- `scripts/qa-c22-product-switch.mjs` — fluxo sintético no Chrome (PDP A → PDP B → favoritos → carrinho), com todas as requisições externas bloqueadas.
- `docs/VONIX_MAPA_MUDANCAS_LOJISTA_C22_20261110.md` — explicação sem jargão e imagens de comparação.

**Capturas red/green**: `qa-artifacts/vonix-c22/dev/after-390.png` (3 unidades herdadas indevidamente), `qa-artifacts/vonix-c22/green-verified/after-390.png` (1 unidade), `qa-artifacts/vonix-c22/green-verified/cart-390.png` (subtotal móvel); relatório final pós-upstream em `qa-artifacts/vonix-c22/after-pr53/report.json`. Todas as capturas são de localhost e não revelam compradores reais.

## Evidência verificável e limitação

1. RED: Chrome **0/3** com qty 3 persistindo entre SKUs. Teste de cart mobile inicialmente falhou por ausência de `Resumo do carrinho no celular`.
2. GREEN focado: **52/52 Vitest em 2 arquivos**; Chrome **3/3 (320/390/1366)** comprovando qty1 ao trocar produto, favorito acessível e área 44×44, barra de carrinho atualizando subtotal.
3. Antes da sincronização adicional: **634/634 Vitest em 75 arquivos**, TypeScript 0, ESLint integral ignorando somente a regra histórica de Prettier 0, build Nitro Cloudflare Module 0, SSR **42/42 ativos**.
4. A `main` original avançou com o **PR #53** (`c0d78a7`), que acrescenta uma landing de afiliadas **no mesmo repositório**. A atualização foi incorporada somente à branch auditada sem conflito de merge; não alterou os arquivos da compra corrigidos no C22. **Pós-PR53:** **638/638 Vitest em 75 arquivos**, TypeScript 0, ESLint de código 0, build 0, SSR 42/42 e Chrome 3/3 em três larguras. **A landing de afiliadas do PR53 não foi construída por este ciclo.**
5. `npm run lint` estrito global conserva dívida histórica de formatação/CRLF. O build do Worker gerado localmente não é deploy; o Chrome bloqueia a rede externa e não é prova de Appmax, Bling ou Supabase real.

## O que permanece pendente, sem promessa falsa

**NOT_APPROVED / sem publicação:** Appmax sandbox com Pix, cartão, antifraude, expiração/duplicidade e `paid_at`; Supabase staging isolado com RLS, backups/restauração; Bling SKU/dimensões/estoque; frete real cotado; LGPD pós-pedido; WAF/limite distribuído; GA4/Meta de compras efetivamente pagas; smoke no Worker hospedado. **Não fiz reformulação visual integral da home e de todas as páginas**; C22 é uma melhoria visível mas localizada e testada. Não realizei merge na `main` original, deploy, pagamentos, reviews ou operações reais.

## Reconciliação adicional da origem: PR #54

A `main` original também recebeu o **PR #54 (`e3e3c59`)**, com uma apresentação mobile revisada da landing de afiliadas **integrada no próprio e-commerce**. Os arquivos dessa landing não são do aplicativo independente de inscrições e não foram desenvolvidos ou modificados manualmente nesta auditoria: foram incorporados via merge controlado apenas na branch de auditoria, sem conflitos e sem substituição das mudanças de produto/carrinho C22.

A suíte foi repetida após PR54: **642/642 Vitest PASS em 77 arquivos**, TypeScript exit 0, ESLint sem Prettier histórico exit 0, build Nitro Cloudflare Module exit 0, SSR **42/42 produtos ativos**, e Chrome **3/3** em 320, 390 e 1366 px com 12 screenshots em `qa-artifacts/vonix-c22/after-pr54-verified`. Os controles continuam 44×44 px, a quantidade do novo SKU inicia em 1, os favoritos anunciam o estado e o subtotal móvel acompanha a sacola sem prometer frete. A primeira tentativa desse navegador após PR54 teve falha de temporização na hidratação em uma largura durante testes CPU-intensivos; o roteiro passou a tentar novamente o clique de teste até a UI ficar interativa, sem modificar o e-commerce. A execução final passou **3/3 sem erro JS**.

**Fronteira de aprovação:** o Workloop C22 foi aplicado somente ao repositório e-commerce e sua branch de PR #26. Nada foi enviado à `main` original nem a deploy; nenhum gateway, anúncio, estoque ou cadastro real foi acionado. A PR só é considerada integrável após read-back final do GitHub; homologação financeira e visual global permanecem pendentes.
