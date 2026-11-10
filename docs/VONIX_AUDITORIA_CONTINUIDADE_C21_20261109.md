# Vonix Hair e-commerce — C21: estado seguro entre abas e pesquisa brasileira

**Data local:** 09/11/2026 · **Projeto EXCLUSIVO:** `C:\Users\JL\code\vonix-hair-care` · **Branch:** `fix/vonix-ecommerce-auditoria-2026-11-09` · **Base C20:** `f04a8af` · **PR:** #26 · **Produção:** NOT_APPROVED.

## Escopo, riscos e decisões

A auditoria C21 examinou múltiplas etapas da experiência de compra (catálogo e pesquisa, favoritos, sacola, resumo do checkout, preferências por tipo de cliente e armazenamento de navegador). Nenhum código foi alterado fora desta worktree. Nenhuma cobrança real, pedido, inscrição, mensagem, comentário ou lançamento financeiro foi criado. Dados de navegador e cenários Chrome são **sintéticos** e todo tráfego externo do navegador foi bloqueado. A `main` inicialmente estava em `96296d4` (PR #50), sem novos conflitos no checkout. Uma alteração subsequente da `main`, PR #51, foi detectada durante os testes; sua incorporação só poderá ser registrada após reconciliação e QA da branch auditada.

### N79 — Favoritos corrompidos derrubavam a loja (média/alta)

`createStore` aceitava dados JSON de `vonix-favs` sem verificar o tipo. Um valor válido como JSON mas não array (por exemplo, um objeto) fazia `useFavorites().has()` executar `.includes()` sobre algo que não é uma lista, gerando exceção de renderização em cartões e telas que usam favoritos. Foi reproduzido em Vitest. `migrateFavorites` agora valida a entrada, descarta produtos aposentados/inexistentes, remove repetições e limita o processamento de entradas anormais; migra o cache para uma lista canônica de slugs do catálogo ativo. O produto `plex-vonix` permanece indisponível e é removido das listas antigas.

### N80 — Carrinho e favoritos em abas diferentes ficavam desatualizados (alta)

O armazenamento compartilhado gravava alterações locais, porém não observava o evento `storage` enviado pelo navegador às **outras abas** da mesma origem. Em uma aba, a sacola podia mostrar quantidade e desconto antigos enquanto outra alterava o carrinho. O `createStore` agora conecta/desconecta o listener conforme o primeiro/último assinante React, revalida dados recebidos externamente, aplica limpeza do armazenamento, notifica a UI via `useSyncExternalStore` e mantém o aviso de migração do carrinho quando necessário. A alteração propagada ao checkout atualiza o resumo e não habilita pagamento sem a cotação de frete obrigatória. A sincronização de abas **não oferece bloqueio transacional entre navegadores**; o servidor continua sendo autoridade dos valores e idempotência.

### N81 — Preferência de público sem validação (média)

`vonix-audience` de `sessionStorage` também era restaurado sem checagem. Agora `migrateAudience` permite apenas `casa`, `salao` ou `null`; objetos, strings obsoletas e outros formatos são normalizados antes do uso no catálogo.

### N82 — Busca sem acento falhava com nomes acentuados (média/conversão)

O filtro da vitrine comparava strings apenas em minúsculas. Consultas `mascara` e `cafe verde` podiam falhar para **Máscara** e **Café**. `matchesStoreQuery` agora normaliza acentos por Unicode NFD, caixa e espaços consecutivos, preservando os filtros existentes, a ordem da loja, variantes, preços, políticas de oferta e regras de pagamento.

## Verificação reproduzível

- **TDD RED:** 4 testes falharam antes das alterações em persistência e sincronização (incluindo exceção `favs.includes is not a function`), e 1 teste de busca sem acentos falhou antes da função nova. **GREEN focalizado: 9/9 em 2 arquivos.**
- **Vitest integral:** **621/621 PASS em 73 arquivos**. `npx tsc --noEmit` exit 0; `npx eslint . --quiet --rule 'prettier/prettier: off'` exit 0; `npx prettier --check` dos 4 arquivos alterados exit 0; `npm run build` exit 0 com preset Nitro Cloudflare Module; `git diff --check` exit 0.
- **SSR:** 42/42 SKUs ativos, 0 falhas, sem serviços operacionais. O teste alterou apenas `generatedAt` no relatório histórico, restaurado precisamente sem `git reset/clean/restore`.
- **Chrome local 320, 390 e 1366 px:** 3/3 PASS, zero erros de página, 12 screenshots, `scripts/qa-c21-multitab-storefront.mjs` e `qa-artifacts/vonix-c21/dev/report.json`. Fluxo: favorito com JSON corrompido → outra aba salva favorito (descarta SKU aposentado) → segunda aba atualiza sacola de 2 para 3 itens → buscas sem acento mostram Máscara e Café Verde → atualização de carrinho em outra aba altera o resumo do checkout, mantendo Pix indisponível sem CEP. Todas as requisições externas foram bloqueadas; nenhuma cobrança disparada.
- O primeiro roteiro Chrome teve falha **somente no seletor do teste**, que procurava `Coco` sem acento; o catálogo efetivamente usa `Côco`. O seletor foi corrigido para aceitar ambos e o roteiro passou em todas as resoluções. Não atribuir essa falha ao motor de busca.

## Pendências de prontidão, preservação e próxima etapa

**NOT_APPROVED** para produção. Faltam homologação Appmax sandbox Pix/cartão (`paid_at`, duplicação, expiração, antifraude), Supabase staging isolado (RLS, backups, concorrência), Bling SKU/estoque/dimensões, cotação real, WAF/rate-limit distribuído, LGPD pós-pedido, GA4/Meta somente pedidos pagos, smoke Worker Cloudflare e revisão de dependências. A regra global de Prettier/CRLF conserva dívida histórica; este ciclo não rodou `--fix` em todo repositório.

**Limites de Git:** nunca mesclar automaticamente na `main` original, publicar ou acessar app independente de afiliadas. Checkpoint C21, hashes, relatório QA e status remoto/CI serão read-back verificados. A existência de um PR integrável não substitui a homologação operacional de checkout e estoque.
