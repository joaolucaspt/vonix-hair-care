# Vonix Hair — auditoria C4: controle de consentimento e privacidade

**Data:** 09/11/2026
**Projeto único:** e-commerce `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26.
**Base de entrada:** `f5a7269`; worktree limpa antes das mudanças. A `main` remota avançou para `ff03d13` com provisionamento de afiliadas, que pertence a outro projeto. **Não incorporar nem alterar código de afiliadas neste ciclo.**

## Por que este ciclo era necessário

A loja já possuía proteção contra analytics de produção em localhost, mas não exigia decisão de cookies opcionais para inicializar **GA4, Microsoft Clarity e Meta Pixel** no domínio oficial. A ausência de consentimento explícito não deve ser interpretada como autorização. Também existiam, na página institucional, alegações sem comprovação nesta auditoria: “480 produtos vendidos” e resposta em “pouquíssimas horas”.

## Implementação

1. **`src/lib/tracking-consent.ts`:** escolha `accepted`/`rejected` guardada em `localStorage` sob chave versionada; valores ausentes, inválidos e exceções de armazenamento negam rastreamento. Se a gravação persistente for bloqueada, a recusa pode ficar registrada apenas em `sessionStorage`; quando nenhum dos dois armazenamentos funciona, o aviso pode ser dispensado na aba atual sem ativar rastreadores. Revogação elimina cookies analíticos acessíveis por JavaScript quando possível (não garante remoção dos dados já transferidos para terceiros).
2. **`src/routes/__root.tsx`:** bootstrap de consentimento anterior aos scripts do head. GA4, Clarity e Meta Pixel apenas são inicializados quando **origem canônica `https://vonixhair.com` E escolha expressa `accepted`**. SPA `PageView` também exige consentimento. Prévia/localhost continuam isolados.
3. **`src/components/tracking-consent.tsx`:** aviso de privacidade acessível, sem checkbox pré-marcado, com opções equivalentes **Recusar opcionais** e **Aceitar opcionais**, explicação de que a compra funciona sem cookies opcionais, link para política e erro visível se a preferência não puder ser salva. O checkout não é bloqueado por modal; a escolha reabre via rodapé. Alterar opção recarrega a página para ativar/desativar scripts a partir de documento limpo.
4. **`src/components/site.tsx`:** botão **Preferências de cookies** disponível no rodapé.
5. **`src/lib/analytics.ts`:** eventos opcionais de GA4/Clarity/Meta não são emitidos antes da aceitação. A API CAPI acionada pelo navegador apenas pode ser chamada da origem publicada, impedindo tráfego de prévias mesmo sob mocks.
6. **`src/data/pages.json`:** política explica a escolha, recusa e revogação, mantém processamento necessário para pedidos e pagamentos separado de marketing. Alegações não comprovadas de volume de vendas, entrega universal e resposta em poucas horas foram substituídas por descrições verificáveis e condicionadas ao CEP.
7. **Testes:** `src/test/tracking-origin.test.ts` (cenários de origem + consentimento e chamada PageView), `src/test/tracking-consent.test.tsx` (persistência, bloqueio, recusa, revogação, abertura pelo rodapé e checkout acessível), `src/test/checkout-audit.test.tsx` (Pix operável com consentimento recusado e **zero eventos opcionais**).

## Evidências executadas

- **Vitest completo:** **413/413 testes em 57 arquivos**, `TEST_EXIT=0`.
- **TypeScript:** `npx tsc --noEmit`, `TSC_EXIT=0`.
- **Build:** `npm run build`, `BUILD_EXIT=0`.
- **ESLint direcionado:** arquivos alterados, sem regra Prettier legada, `LINT_EXIT=0`.
- **SSR dos 43 produtos:** `scripts/audit-ssr-storefront-c3.mjs`, **43/43 aprovados**, `SSR_EXIT=0`, sitemap e 404 corretos. Isso não certifica disponibilidade real de estoque.
- **Chrome com domínio simulado localmente:** primeira visita, recusa, aceitação, revogação — quatro estados observados; nenhuma tentativa de GA4/Clarity/Meta/CAPI antes da aceitação ou após a revogação, e os três provedores só solicitados quando aceitos. **Todos os requests externos foram interceptados/abortados**, e CAPI respondeu localmente, **sem enviar dados reais**. Recibo `docs/VONIX_CONSENT_BROWSER_AUDIT_20261109.json`.
- **Chrome localhost em 320/390/1366 px:** home de produto e checkout sem overflow, botões de consentimento com área adequada, compra preservada com banner ainda aberto e aviso oculto no checkout. Nenhuma exceção JS observada.

## Itens NÃO homologados que permanecem abertos

- **Consentimento jurídico integral:** revisão LGPD sobre categorias, finalidades, retenção, evidência de aceite, prazo, gestão de dados já coletados e bases legais por fornecedor. O código é um controle técnico, **não certificação jurídica**.
- **Meta Purchase server-side:** o pipeline de Purchase CAPI baseado em pedidos aprovados pode ser emitido pelo servidor sem ler esta preferência de navegador. Verificar contrato, fundamento legal e compatibilidade com recusa antes de afirmar que **todo** marketing é consentimento-condicionado. Não modificar o pipeline crítico nem a base real sem staging/aprovação.
- **Dados reais de usuários e campanhas:** comparações históricas GA4, Clarity e Meta podem diminuir após opt-in; não inferir queda de conversão só por queda de eventos. Medir sessões e pedidos pagos em fontes agregadas, com autorização.
- **Pagamentos/Appmax, Supabase staging e Bling:** ainda exigem homologação fim a fim, RLS/migrações, locks, backups e reconciliação; nenhum teste unitário transforma esse processo em pronto para produção.
- **Estoques e logística:** 43 produtos ainda podem constar `in stock` no feed e JSON-LD sem estoque físico conciliado por SKU. Confirmar dimensão, peso, validade de preços comparativos e termos/depoimentos.
- **Publicação:** não houve merge, deploy, execução de SQL em produção, pagamentos reais, contas/credenciais acessadas ou disparos externos. Revisar CI do novo commit antes de publicar qualquer recurso.

**Regra operacional:** manter PR #26 em revisão até homologar P0; preservar módulos de afiliadas exatamente como na `main`. Ver matriz histórica `docs/VONIX_AUDITORIA_MATRIZ_20261109.md` para itens 01–20 e N01–N25.
