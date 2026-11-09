# Vonix Hair — auditoria C10: compatibilidade GA4, privacidade e main atualizada

**Data:** 09/11/2026 · **Projeto:** e-commerce Vonix Hair, PR #26 · **Base C9:** `da5711a` · **Commit diagnóstico:** `a1365bf` · **Main incorporada:** `d2e7ba1`.

## N46 — divergência de GA4 derrubava o CI de integração do PR

Em 09/11, os jobs `verify` e `Types, tests, lint and build` do upstream falharam no único teste `src/test/tracking-origin.test.ts`, embora todos os demais testes e os dois jobs PostgreSQL tivessem passado. A instrumentação diagnóstica revelou a divergência: a execução do PR integrado à `main` carregava `https://www.googletagmanager.com/gtag/js?id=G-J8TYLB425K` enquanto a branch isolada ainda esperava `G-JW91EQ32F3`.

A origem foi confirmada: a `main` recebeu o commit **`8c8bf6b`**, alterando o ID público de GA4 para `G-J8TYLB425K`. A branch foi integrada por merge conservador da `main` `d2e7ba1` e o teste passou a exigir o identificador vigente. O histórico do checkout foi preservado. **A conta GA4 à qual o ID pertence e o recebimento de dados reais ainda precisam de conferência autorizada no painel da propriedade.**

## N47 — risco de introduzir tags de marketing antes de consentimento ao integrar main

A versão `main` de `__root.tsx` exibia uma tag externa GA4 direta e carregava Clarity/Pixel sem a guarda introduzida na auditoria; a integração não deve restaurar esse comportamento. O merge selecionou apenas o novo **ID GA4**, mantendo no PR:

- Carregamento de GA4, Clarity e Pixel somente no domínio canônico e depois de aceitação de marketing no navegador
- `PageView` no CAPI público apenas com `consent:true`, além das verificações de origem no servidor
- Bloqueio de eventos em localhost e prévias
- Revogação de consentimento local em página seguinte; **revogação posterior ao pedido no snapshot server-side continua pendente**

O teste foi ampliado: nenhuma tag externa GA4/Clarity/Pixel pode existir diretamente no `head.scripts` sem guarda. A QA sintética do Chrome com domínio `https://vonixhair.com` servido pelo localhost e tráfego externo **interceptado** confirmou zero solicitações antes de aceite e, depois dele, GA4 `G-J8TYLB425K`, Clarity, Pixel e `PageView` com `consent:true`. Não ocorreu envio de marketing real.

## Validações da árvore integrada C10

- **Vitest completo: 482/482 testes em 62 arquivos**, exit 0; testes de marketing focados 24/24
- **TypeScript, ESLint afetado e build Vite/Nitro:** aprovados
- **SSR: 42/42 produtos ativos**, Plex Vonix excluído (404), sem inferir inventário físico
- **Integração Git:** main `d2e7ba1` herdada com alterações oficiais de afiliadas sem edição manual pelo e-commerce; checar diffs dos arquivos de afiliadas contra `origin/main`
- **Checks do GitHub:** obrigatórios no novo commit; logs vermelhos antigos não equivalem à situação atual

## Bloqueios operacionais preservados

**P0:** Appmax sandbox (Pix/cartão/antifraude/retentativas), migrações e backup em Supabase staging, Bling e estoque/dimensões por SKU, ledger de revogação tardia de Purchase Meta e LGPD, WAF/rate limiting, pedidos pagos conciliados, propriedade GA4 correta e autorização jurídica do rastreamento. **P1:** acompanhamento de conversão agregado, Lighthouse, evidência de preços e prova social. Roteiro em `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`.

**Sem merge do PR na `main`, deploy, operação financeira, acesso a credenciais, SQL operacional ou envios externos.**
