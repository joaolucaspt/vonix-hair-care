# Vonix Hair — integração C8 à main: cabeçalho móvel e disponibilidade do catálogo

**Data:** 09/11/2026 · **Projeto:** e-commerce Vonix Hair `C:\Users\JL\code\vonix-hair-care` · **PR:** #26.
**Segurança C8:** commit `54d1516`; **primeira integração** da `main` `ec6d7f5`: commit `5f87e71`; **atualização final incorporada:** `0bd0643` (estoque do Plex Vonix). Nenhum merge do PR à `main` ou deploy foi autorizado.

## N41 — cabeçalho móvel atualizado gerou conflito e overflow

A nova versão da `main` substituiu o cabeçalho por uma navegação mais compacta na página de produto e checkout. O e-commerce no PR havia melhorado a navegação “Pedidos” e acrescentado o controle de privacidade no rodapé. A integração acusou um conflito em `src/components/site.tsx`, resolvido preservando:

- Grade centralizada, menu compacto e busca sob demanda no produto; no checkout, cabeçalho mínimo conforme o upstream
- Acesso a `/conta` rotulado corretamente como **Pedidos** (não há autenticação de conta)
- Botão **Preferências de cookies** e os demais controles de privacidade do C4–C8

O Chrome encontrou uma regressão real de **9 px de largura extra** na página de produto a 390 px: ações e o rótulo “Pedidos” estendiam o carrinho além da viewport. O texto foi ocultado somente em página de produto móvel, mantendo o ícone com `aria-label="Acompanhar pedido"` e o acesso no menu. **Revalidação:** home, página do Combo Banana e Mel e checkout em 320/390/1366 px com HTTP 200, sem overflow ou erros JS; busca móvel do produto funcional. O teste com `paid:true` adulterado no checkout também foi repetido e passou após o merge.

## N42 — estoque atualizado pela main, auditor SSR com contagem antiga

A `main` `0bd0643` colocou **`plex-vonix` em `OUT_OF_STOCK`**, retirando o item da vitrine, do sitemap e do feed Meta. Esta é uma alteração legítima do catálogo feita fora da auditoria; **nenhum agente desta rodada deve reativar o produto**. Entretanto, o script SSR C3 continuava lendo o JSON de 43 produtos em vez da lista vendável de 42, produzindo uma falha falsa para o Plex (404 esperado).

O script `scripts/audit-ssr-storefront-c3.mjs` agora lê a exclusão `OUT_OF_STOCK` declarada no `src/lib/store.ts`, valida que os slugs existem no arquivo original, verifica somente as páginas ativas e **exige HTTP 404** para cada produto excluído. Qualquer alteração inesperada na declaração faz o preflight falhar, em vez de ignorar indisponibilidade.

**Resultado integrado:** 43 itens no JSON fonte; **42 produtos ativos**, **42/42 páginas SSR aprovadas**, Plex Vonix **404**, **42 URLs de produto no sitemap** e **42 linhas de produto no feed Meta**, sem Plex. Isso não valida que o estoque físico dos outros 42 existe: a reconciliação real por SKU permanece P0.

Os três testes antigos que esperavam 43 produtos no catálogo ativo foram atualizados para 42 e os cenários de exclusão foram preservados. Nenhum SKU foi criado ou reaberto.

## Evidência e controle de integração

- **Vitest completo na árvore integrada:** **469/469 testes em 62 arquivos**, exit 0, após atualizar as expectativas de estoque. TypeScript, build de produção e lint dos arquivos afetados passaram.
- **Chrome local:** home/produto/checkout 320, 390 e 1366 px; teste de status `paid:true` adulterado; zero cobranças, requisições externas interceptadas.
- **Auditoria SSR local:** 42/42, 1 página de produto intencionalmente 404; 42 itens no feed e 42 URLs no sitemap.
- **Compatibilidade:** Git preserva o commit C8 e incorpora as alterações recentes da `main` sem sobrescrever arquivos de afiliadas. Na comparação com a `main` `0bd0643`, **zero diferenças em arquivos de afiliadas**. Os arquivos de afiliadas que surgem no commit de integração são exatamente os já aprovados na `main`, não modificações manuais do e-commerce.
- **GitHub CI:** o novo job isolado de PostgreSQL do checkout havia passado no commit C8 antes das integrações; aguardar nova validação remota da árvore integrada.

## Portas ainda não homologadas

Persistem **Appmax sandbox**, Supabase staging (migrações C5/C8, RLS, backup/restore e transições), Bling, estoque/dimensões por SKU, revogação de consentimento tardia e revisão jurídica, WAF/rate limit e pedidos pagos reais versus sessões. **Não realizar merge do PR na `main`, deploy ou transações reais sem cumprir P0.** O runbook é `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`.
