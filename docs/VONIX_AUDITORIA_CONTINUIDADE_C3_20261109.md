# Vonix Hair — Auditoria integral, continuidade C3 — 09/11/2026

**Projeto único:** e-commerce Vonix Hair, `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. **Não é** o projeto de afiliadas. Sem deploy, merge na `main`, pagamentos reais, leitura de `.env` ou acesso a pedidos/bancos operacionais.

## Objetivo comercial e limite de certeza

A auditoria iniciada em 03/11 investigou ausência de vendas. Os 20 achados originais e os achados novos N01–N18 permanecem na matriz `VONIX_AUDITORIA_MATRIZ_20261109.md`. Dados antigos (aproximadamente 593 visitantes, 50 visualizações de carrinho, 32 visualizações de checkout) **não definem taxas por sessão nem comprovam o motivo da ausência de vendas**. Para isso é indispensável reconciliar sessões únicas, canal, consentimento, pedidos iniciados, aprovados/recusados e vendas pagas na Appmax.

## Evidência adicional: falhas reais reproduzidas

### C3-01 — Carrinho com armazenamento bloqueado

**Antes**: armazenamento local bloqueado ao clicar em “Adicionar ao carrinho” provocava exceção `Storage denied`; o carrinho ficava vazio. A leitura de CEP salvo e a escrita de CEP também não tratavam exceções do navegador. **Correção** em `src/lib/store.ts`: estado de carrinho permanece em memória e notifica componentes mesmo quando `localStorage.setItem` falha; cache de CEP passa a ser opcional com tratamento de erro. Teste automatizado de 3 cenários: PASS. Reprodução em Chrome com `Storage.prototype.setItem` bloqueado **depois da hidratação**: toast mostrado, contador de carrinho 1, navegação SPA mantém produto, 0 pageerrors. **Limite**: uma recarga completa não recupera o carrinho se o navegador impedir persistência; não alegar resolução da persistência sem armazenamento.

### C3-02 — Analytics poluído por prévias

**Antes**: o localhost da loja carregava `www.googletagmanager.com/gtag/js?id=G-JW91EQ32F3` e `www.clarity.ms/tag/yrgl15vqw9` da operação. Reproduzido no Chrome com rotas abortadas para não enviar eventos. **Correção** em `src/routes/__root.tsx`: inicialização GA4 e Clarity exclusivamente quando `window.location.origin === "https://vonixhair.com"`, mantendo carregamento ativo no domínio publicado. Chrome localhost pós-correção: zero requisições de rastreamento real. Teste `tracking-origin.test.ts`: 2/2 PASS com execução isolada de bootstrap para localhost/staging/preview/prod. **Limite**: consentimento/LGPD, legitimidade de eventos e deduplicação em produção continuam exigindo auditoria real.

### C3-03 — Comunicação comercial coerente e SEO

Em `site.tsx`, `index.tsx`, `produto.$slug.tsx`, `$page.tsx` e `pages.json`, a página não anuncia “5% OFF no Pix” irrestrito nem frete grátis automático: Pix **até 5% em itens sem outra oferta**; frete grátis acima do subtotal previsto, **sujeito à cobertura e cotação para o CEP**. Política de Frete explicita cobertura e indisponibilidade; sem modificar preços, descontos reais ou meios de pagamento.

A visualização de produto `view_item` agora registra corretamente a variante selecionada. Chrome local `kit-cachos`: eventos de `250ml` e, ao clicar na segunda variante, `1L`; nenhum pageerror.

### C3-04 — Preflight SSR dos 43 produtos

Script reexecutável `scripts/audit-ssr-storefront-c3.mjs`, recibo `docs/VONIX_SSR_PREFLIGHT_C3_20261109.json`. Localhost apenas, sem gerar pedidos/pagamentos:
- **43/43 produtos aprovados**: HTTP 200, canonical, OG absoluto, meta descriptions 139–168 caracteres com condições verdadeiras, preço atual no JSON-LD, endereço da oferta, imagens existentes, sem transportadora antiga na descrição.
- Home, loja, carrinho e checkout: HTTP 200; sitemap 43 URLs de produtos; `robots.txt` HTTP 200; rota inexistente HTTP 404.
- **Estoque real não auditado**: catálogo feed e JSON-LD ainda usam `InStock` sem conciliação operacional; pendência crítica explicitada, sem inventar disponibilidade.

O primeiro script falhou falsamente em imagens devido à conversão incorreta de URL de caminho no Windows; foi corrigido com `fileURLToPath` e toda a bateria repetida (43/43).

### C3-05 — Toques móveis e largura do cabeçalho

Revisão real no Chrome com 320, 390 e 1366 px, home, loja e produto: controles favoritos, menu, carrinho, conta, carrosséis, galeria e compartilhamento. Foram encontrados botões de 8/32/36 px e overflow horizontal introduzido pelos primeiros ajustes no cabeçalho de 320 px; **corrigidos ambos**. Solução usa alvos de 40 px (indicadores de página) e 44 px em controles primários, `aria-pressed` em favoritos, sem alterar preço/carrinho. **Resultado final em 9 cenários**: nove HTTP 200, zero overflow, zero botões testados abaixo das dimensões previstas e zero exceções JS. O teste não substitui leitor de tela, teclado completo ou inspeção de aparelhos físicos.

### C3-06 — Compra rápida funcional nos cards

O botão da vitrine antes enviava à página do produto também os itens com **uma única variante**, pois a flag de promoção por quantidade estava ligada em todo o catálogo. Agora **39 produtos com variante única** podem ir direto para a sacola, mantendo `add_to_cart` e valor reais; **4 produtos com opções de tamanho/versão** continuam encaminhando à PDP. Três testes específicos verificaram a bifurcação e a estrutura do catálogo. Chrome mobile confirmou adicionar Combo Banana e Mel, contador 1 e presença do produto no carrinho. Nenhum pedido nem pagamento foi iniciado.

## Verificações e homologação

- **Antes das mudanças finais de toque:** suíte completa Vitest **390/390 PASS em 55 arquivos**, TypeScript PASS, ESLint direcionado PASS e build Nitro/Vite PASS (09/11).
- **Antes de sincronizar a `main`:** 393/393 testes aprovados em 56 arquivos, TypeScript, build e lint direcionado PASS; 43/43 páginas SSR e 10 verificações de Chrome sem falhas. **Depois de integrar a `main` em `4dffd38`: 400/400 testes aprovados em 56 arquivos**, `TSC_EXIT=0`, `BUILD_EXIT=0`, `ESLINT_EXIT=0`, `SSR_EXIT=0` (43/43 produtos) e `BROWSER_EXIT=0` (10 cenários incluindo carrinho, 320/390/1366 px). O novo ID do Clarity `zaq09ea2zy` foi confirmado pelo teste de origem. A execução no GitHub do novo commit ainda exige confirmação após o push.
- Não alterar arquivos de afiliadas. Comparar explicitamente com a `main` e conferir HEAD remoto antes de fazer push.
- PR #26 continua sujeito à homologação operacional P0. CI aprovado para commit anterior `67af4a5`, não reutilizar aprovação para o novo commit até o GitHub confirmar os checks.

## Integração de base atualizada e isolamento do sistema de afiliadas

Em 09/11 a `main` avançou de `06f15b6` para `4dffd38` com o PR #30 de governança de afiliadas e a correção oficial do projeto Microsoft Clarity da loja. A integração foi feita com `git merge --no-ff --no-commit`, sem conflitos e preservando o conteúdo da `main` em arquivos de afiliadas. A única adaptação específica da auditoria foi a expectativa do ID de Clarity no teste do e-commerce. Nenhum arquivo de afiliadas foi editado manualmente; documentação e status desses módulos pertencem ao outro projeto. Criado checkpoint anterior à integração em `backup/vonix-pr26-pre-main-4dffd38-c3-20261109`.

## Pendências para não perder no próximo ciclo

**P0 / bloqueiam publicação de pagamento:** Appmax sandbox fim a fim (Pix/cartão/aprovação/recusa/timeout/cobrança repetida/reembolso/antifraude), Supabase staging com RLS, migrações, concorrência, restauração de backup, Bling sandbox/reconciliação de pedidos e devoluções, SKU com estoque realmente disponível, medidas/pesos/frete, segurança e limites operacionais.

**P1 / confiança e mensuração:** evidências dos preços comparativos “de/por”, autorização e veracidade de depoimentos/contadores de vendas, coleta e consentimento LGPD para rastreio, instrumentação e análise reais por sessões e etapas até pedido efetivamente pago, qualidade dos eventos Meta/GA4 sem duplicação, Search Console, políticas e dados legais aprovados.

**P2 / desempenho e experiência:** dados reais de Core Web Vitals (LCP/INP/CLS), Lighthouse em rede móvel fria, acessibilidade com teclado/leitor de tela e zoom; otimização contínua de imagens/vídeos restantes e testes A/B após homologação.

**Decisão:** não mesclar PR nem fazer deploy automático enquanto o bloco P0 permanecer sem homologação. GitHub habilitado para PRs autoriza revisão de código, não pagamento real ou execução de banco de produção.
