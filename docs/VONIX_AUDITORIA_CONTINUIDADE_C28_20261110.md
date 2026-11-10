# Vonix Hair — Auditoria C28: ranking verificável e compra desde o primeiro carregamento

**Data:** 10/11/2026. **Projeto exclusivo:** e-commerce Vonix Hair em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. Base anterior: **C27 / `2b08ecc`**. **NÃO** é o sistema independente de candidaturas de afiliadas. **Produção: NOT_APPROVED.**

## Problemas identificados, impacto e mudanças

| ID | Impacto | Diagnóstico anterior | Correção C28 |
| --- | --- | --- | --- |
| **N112** | Confiança/comercial | `BEST_SELLERS` era uma lista fixa que incluía produtos com 10–21 unidades enquanto o histórico informava itens com 27–58. A seção `Mais vendidos` mostrava ordenação por outro critério. | Ranking dos seis produtos *ativos* com maior volume histórico do próprio `vendas.json`, mantendo desempate estável e excluindo SKU indisponível; ordem preservada também em `/loja?secao=mais-vendidos` |
| **N113** | Veracidade | O número `vendidos` aparecia sem indicar que era um histórico, não um contador ao vivo. | Data de referência de vendas **03/11/2026**, texto nas duas vitrines e contexto assistivo/tooltip nas fichas/cards; não prometer estoque em tempo real |
| **N114** | UX de conversão | Card tinha apenas ícone de sacola como ação de compra, sem texto visível; favoritos repetiam o nome acessível `Favoritar` em todos os cards. | CTA de largura total com `Adicionar à sacola` para tamanho único e `Escolher tamanho` para variantes; nome acessível e estado de favoritos específicos por produto |
| **N115** | Conversão alta / cold load | Clique imediato no botão da loja durante SSR/hidratação não adicionava ao carrinho (Chrome dev **RED 0/3**, armazenamento local sem item); após hidratação **3/3 PASS**. | Antes de a página estar interativa, o CTA é um **link nativo** para a ficha do produto em vez de parecer um botão de adição funcional. Após hidratação, volta ao botão direto de adicionar ou escolher tamanho |
| **N116** | Conversão/clareza | Botões Comprar agora/Adicionar e seletores do PDP eram visualmente clicáveis mesmo quando o React ainda não tinha ativado os eventos. | Interações de compra, quantidade, tamanho e favoritos ficam desabilitadas enquanto `useHydrated` é falso; nenhuma adição silenciosa ou pagamento |
| **N117** | Integridade de pedido | Verificar que `Escolher tamanho` não adiciona automaticamente SKU com mais de uma variante, nem altera uma sacola existente. | Chrome testado em três resoluções: navegação para `/produto/kit-cachos`, sem nova linha de carrinho antes da seleção |

**Fonte do ranking:** `src/data/vendas.json`, campo `_fonte`: volumes históricos informados pelo lojista, alguns a partir do Bling e outros de WhatsApp e apuração direta, até **03/11/2026**. Não há prova nesta sessão de conciliação das quantidades contra o ERP em produção. C28 conserva números originais e apenas passa a ranqueá-los de modo coerente; **não inventa vendas nem atualiza estoque**. Caso a origem dos volumes não possa ser comprovada, retirá-los das alegações comerciais antes de lançar.

## Testes e evidências do ciclo

- **Vitest global:** **666/666 PASS**, **82 arquivos**; acrescido `src/test/sales-ranking-audit.test.ts` com 4 testes de referência, ordem, filtros e estabilidade.
- **TypeScript `npx tsc --noEmit`**: exit **0**. **ESLint integral funcional** com regra histórica `prettier/prettier` desligada: exit **0**. **Build Nitro/Cloudflare local**: exit **0** (não é deploy nem Worker de staging).
- **Chrome local com JavaScript desativado:** `scripts/qa-c28-ssr-click-fallback.mjs` **3/3 PASS** em **320, 390 e 1366 px**. Clique nativo no CTA SSR leva ao PDP; sem JS, os botões de cobrança/compra do PDP permanecem desabilitados. **6 screenshots**, relatório `qa-artifacts/vonix-c28/ssr-no-js/report.json`.
- **Chrome local após hidratação:** `scripts/qa-c28-storefront-conversion.mjs` **3/3 PASS** nessas mesmas larguras. Valida ranking da home e da loja, CTA e persistência de carrinho (Botox Vonix 1 kg), ida para a sacola, escolha de Kit Cachos para definir variante sem alterar carrinho; **12 screenshots** em `qa-artifacts/vonix-c28/` (home, catálogo, sacola, variante).
- **Diagnóstico RED reproduzível:** antes da proteção de hidratação, o Playwright clicou imediatamente no CTA da loja e não surgiu item em `localStorage.vonix-cart` (**0/3**); com 1,2 s de espera foi **3/3**. O script final testa separadamente o fallback SSR sem JavaScript e a adição após hidratação; não indica que uma venda ocorreu.
- **SSR das 42 páginas de catálogo ativo:** **42/42 PASS**, excluído `plex-vonix` responde **404**, `docs/VONIX_SSR_PREFLIGHT_C28_20261110.json`. Preço, metadata, imagens e JSON-LD avaliados sem alegar `InStock` não confirmado.
- Rede externa bloqueada nos testes de navegador. Sem pedidos, pagamentos, reservas, CPF, clientes, APIs de fornecedor ou deploy reais.

## Ainda não resolvido — não confundir QA com venda

1. **P0 Appmax (sandbox homologado):** todos os estados Pix/cartão, antifraude, recusa, expiração, status, `paid_at`, idempotência e recuperação sem cobrança duplicada.
2. **P0 Supabase staging:** migrações, RLS, service_role, backup/restauração, concorrência e idempotência com dados **sintéticos**, sem afetar bancos reais.
3. **P0 Bling/expedição:** volumes e SKUs reais, estoque por variante, embalagem, dimensões/peso e cotação de frete por CEP, incluindo CEPs sem cobertura.
4. **P0 runtime Cloudflare em staging:** desempenho de rede/CPU móvel fria, propagação de eventos, headers/WAF e rollback. O bug de hidratação foi reproduzido **em Vite local** e mitigado com link nativo; prova em Worker hospedado continua pendente.
5. **P0 LGPD/marketing:** origem dos depoimentos e contadores, revogação de consentimento após compras pendentes, autenticidade dos eventos financeiros, GA4/Meta com conciliação de compras pagas.

**Causa de falta de vendas:** não demonstrada por esse QA. O funil antigo tem contagens de visitantes e visualizações, mas não sessões únicas por canal/dispositivo reconciliadas com Appmax. Coletar evidência financeira e de mídia em uma janela comum antes de atribuir o gargalo. **Manter PR #26 aberto, sem merge/deploy da loja para produção até homologação operacional.**
