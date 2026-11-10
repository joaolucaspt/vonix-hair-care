# Vonix Hair e-commerce — C19: busca acessível, consentimento no checkout e sincronização da main

**Data local:** 09/11/2026 · **Repositório exclusivo:** `C:\Users\JL\code\vonix-hair-care` · **Branch:** `fix/vonix-ecommerce-auditoria-2026-11-09` · **Base C18:** `3e03fcf` · **PR:** #26.

## Sistema e mudanças integradas

O ciclo C19 amplia o funil do catálogo até a revisão da compra. A `main` original do e-commerce, recebida após C18, foi incorporada somente à branch auditada. A sincronização inicial incluiu **PR #47, base `266763f`**, contendo melhoria de integridade das funções de afiliadas já existentes no MESMO repositório. Não foi acessado ou modificado o aplicativo independente de inscrições de afiliadas. Nenhuma operação real de pedidos, pagamentos, entrega, dados pessoais, anúncios, e-mail ou publicação foi ativada.

### N73 — preferência explícita de cookies bloqueada na página de checkout

O banner `TrackingConsentBanner` omitira-se incondicionalmente na rota `/checkout`. Essa omissão protegia o formulário contra bloqueio por banner não solicitado, porém também impedia o cliente de abrir **voluntariamente** as preferências pelo rodapé, especialmente para revogar consentimento previamente dado. C19 separa abertura explícita de exibição automática: checkout continua sem banner obrigatório, mas o evento `TRACKING_PREFERENCES_EVENT` abre a interface mesmo nessa rota. A flag é limpa ao salvar escolha. A lógica de negar rastreamento opcional por padrão permanece inalterada.

**Comprovação:** teste de componente com checkout e consentimento previamente aceito, reabertura explícita e opções de aceitação/recusa; navegador Chrome confirma a escolha **Recusar opcionais** salva como `rejected` e que o carrinho sobrevive ao recarregamento.

### N74 — busca do catálogo exigia tecla Enter

A rota `/loja` tinha entrada de busca solta com `onKeyDown` apenas para Enter, sem botão de envio facilmente descoberto por toque, teclado virtual ou leitor de tela. C19 introduziu `<form role="search" aria-label="Buscar produtos">`, `<input type="search" enterKeyHint="search">` e botão visível **Buscar** (`type="submit"`, altura >=44px). A busca utiliza a navegação interna `/loja?q=` e mantém filtros existentes. Controles de filtro passaram a ter altura mínima de 44px. Nenhuma alteração no carrinho ou processamento do pagamento.

### N75 — filtros de URL reproduziam entradas arbitrariamente longas

O validador de URL agora remove espaços externos, descarta strings vazias e limita `q` a 120 caracteres e demais filtros a 80, reduzindo títulos absurdamente longos e processamento sem restrição de URLs malformadas. Mantidos filtros por categoria, tipo, necessidade e ordenação, além de produto e público-alvo.

## Evidências

- **TDD:** três novos cenários falharam antes das mudanças, depois **12/12 PASS** nos testes focados de busca e privacidade.
- **Vitest integral:** **596/596 PASS em 71 arquivos**, exit 0, após integração do PR #47.
- **TypeScript:** `npx tsc --noEmit` exit 0. **ESLint integral sem a regra histórica Prettier:** exit 0. **Prettier dos arquivos alterados:** exit 0.
- **Build:** `npm run build` exit 0, saída Vite/Nitro Cloudflare Module. Não foi feito deploy.
- **SSR:** script C3 verificou **42 produtos ativos e 0 falhas**. O timestamp do recibo SSR histórico foi restaurado cirurgicamente após QA; relatório histórico não foi sobrescrito.
- **Chrome real, desenvolvimento local, rede externa bloqueada:** `scripts/qa-c19-storefront-privacy.mjs` em **320, 390 e 1366 px**, **3 PASS / 0 FAIL**, sem page errors, sem overflow, com busca pelo formulário, PDP, gaveta, checkout, cupom por Enter, reabertura de privacidade, recusa explícita, edição/retorno da sacola e conservação dos itens. **Nenhuma chamada de cobrança foi disparada.** Comprovantes em `qa-artifacts/vonix-c19/dev/report.json` e 12 screenshots.
- **Limites metodológicos:** Chrome dev local não representa hospedagem real do Cloudflare Worker. Todas as chamadas HTTP externas no navegador foram bloqueadas. Não houve testes reais de Appmax, Supabase produção, Bling, transportadora ou atribuição de pedidos pagos.

## Prontidão e riscos ainda abertos

**NOT_APPROVED / SEM DEPLOY**. A homologação exige Appmax sandbox (Pix/cartão, confirmação `paid_at`, rejeição e timeout ambíguo), Supabase staging (RLS, idempotência, backups/restore, concorrência), Bling por SKU e dimensões físicas, cotação real, revogação LGPD pós-pedido, WAF/limite distribuído, GA4 + Meta baseados em pedidos efetivamente pagos e smoke no Worker Cloudflare. O `npm run lint` estrito histórico também conserva débito de Prettier/CRLF. Não se pode atribuir aumento de vendas somente a testes sintéticos.

**Política de Git:** sem `reset`, `clean`, `restore`, `checkout`, `stash` ou substituição da branch `main`. A PR #26 só é considerada integrável segundo leitura efetiva do GitHub do commit final; alterações concorrentes na `main` podem exigir nova revisão.

## Atualização de sincronização: PR #48

A `main` do e-commerce avançou mais uma vez para **`03df19a` (PR #48)**, com alterações de resiliência das funcionalidades de afiliadas já existentes no mesmo repositório. Foi incorporada **sem conflitos** e sem alterar os arquivos funcionais de checkout/catálogo deste ciclo. Os testes globais foram repetidos após essa incorporação: **602/602 PASS em 71 arquivos**, TypeScript exit 0, ESLint não formatação exit 0, build Cloudflare exit 0. A medição de 42 SKUs e as três rodadas Chrome foram executadas após PR #47; PR #48 não mudou as rotas do e-commerce usadas nesses testes. A conclusão de prontidão permanece **NOT_APPROVED**.
