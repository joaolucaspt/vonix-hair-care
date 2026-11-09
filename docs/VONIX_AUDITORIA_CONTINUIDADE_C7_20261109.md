# Vonix Hair — auditoria C7: consulta segura de pedidos e API Meta opcional

**Data:** 09/11/2026 · **Projeto único:** `C:\Users\JL\code\vonix-hair-care` · **PR:** #26 · **Base da rodada:** `77274bb`.

## N34 — “Meus pedidos” não permitia consultar status

Antes, o checkout orientava o cliente a consultar pedidos por sua conta, mas `/conta` só apresentava um link para o WhatsApp. Foi implementada uma consulta limitada aos pedidos pendentes ainda armazenados na sessão do navegador. Reaproveita `restorePendingPix`, `restorePendingCard` e a função `getOrderStatus` já autorizada pelo token assinado do pedido, **sem nova API de pagamento**.

O cliente pode consultar manualmente a situação de uma tentativa, com mensagens distintas para **pago**, **pendente**, **encerrado** e **status temporariamente indisponível**. O token não aparece em texto, URL, HTML ou analytics. A consulta não cria Pix, não envia cartão, não inicia pedido novo e não elimina o atendimento. Se o pagamento anterior tinha método incerto, a tela mostra **“Não confirmado”** em vez de afirmar que era cartão.

**Limitação importante:** a sessão e a capacidade assinada têm validade aproximada de 24 horas; compras antigas, outros aparelhos, abas sem sessão e rastreios logísticos continuam dependendo do atendimento. É uma consulta temporária, **não** um histórico de pedidos autenticado.

## N35–N37 — API pública de eventos Meta aceitava sinais incompletos e metadados arbitrários

A rota `/api/public/meta-event` ainda aceitava eventos de navegador sem exigir sinais de origem e consentimento explícito; aceitava URLs de evento apenas validadas mais tarde pelo cliente Graph e repassava estruturas arbitrárias de `customData`. Também usava `X-Forwarded-For` como substituto para o IP de borda.

Agora a rota exige correspondência com a origem canônica e contexto de navegação `same-origin`, rejeita eventos sem `consent:true`, valida a origem da URL do evento, limita e valida campos de valor, quantidades, IDs e itens com Zod em schema estrito, e aceita IP somente de `cf-connecting-ip` válido. O evento **Purchase continua proibido** nessa rota; apenas o fluxo de pedido pago confirmado pode produzi-lo.

O `PageView` inicial usava um script separado que não enviava o novo campo de consentimento. O navegador detectou que a rota o recusaria. O script foi corrigido para adicionar `consent:true` e revalidar a preferência na hora do disparo. A rotina SPA de `analytics.ts` também passou a enviar o sinal.

**Limite de segurança e conformidade:** cabeçalhos HTTP e um booleano do navegador podem ser falsificados por clientes não confiáveis. Isso reduz erros e parte do abuso involuntário, **não é prova jurídica do consentimento, autenticação nem rate limit distribuído**. Proteções de borda (WAF/rate limit), bases legais, auditoria e revogação de pedidos continuam sob revisão.

## Evidências reais da rodada

- **Vitest completo:** **441/441 testes aprovados em 59 arquivos**, exit 0; novos cenários abrangem pedidos Pix/cartão, métodos incertos, token não renderizado, respostas Appmax e erro de rede, origem e consentimento CAPI, dados JSON malformados e IP confiável.
- **TypeScript:** `npx tsc --noEmit` exit 0; **ESLint direcionado** exit 0; **build Vite/Nitro** exit 0.
- **Preflight SSR local:** 43/43 páginas de produto, sitemap e rota 404 conforme o auditor, exit 0; **estoque real não validado**.
- **Chrome headless** com dados sintéticos, páginas `/conta` 320, 390 e 1366 px: HTTP 200, viewport sem overflow, botão de consulta com 46 px de altura, nenhum erro JS e nenhum token assinado renderizado.
- **Chrome simulando `https://vonixhair.com` sobre servidor local**: primeira visita sem aceite não enviou eventos; visita com aceite enviou PageView e AddToCart com `consent:true` e `Origin` correto. Todos os pedidos externos para Meta/GA4/Clarity foram interceptados ou abortados; nenhuma operação de marketing real.
- **Integridade Git:** worktree preservada, nenhuma mudança nos módulos de afiliadas. GitHub CI do novo commit deve ser confirmado separadamente após push.

## Pendências preservadas — não declarar pronto sem provas

**P0:** Appmax sandbox de Pix/cartão/antifraude, falhas e estorno; Supabase staging com SQL/RLS, backup/restore e concorrência; Bling homologado, inventário físico, peso e tamanho por SKU; consentimento LGPD com revogação tardia no backend e segurança do evento Purchase; WAF/rate limit do endpoint público; conciliação operacional dos pedidos. **P1:** evidências de preços comparativos, prova social autorizada, envio efetivo de comunicações, métricas cruzadas de sessões com pedidos pagos, Lighthouse e acessibilidade assistiva.

Não houve merge na `main`, deploy, acesso a segredos, envio de mensagens, pagamento real ou SQL em banco operacional. Para homologação: `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`.
