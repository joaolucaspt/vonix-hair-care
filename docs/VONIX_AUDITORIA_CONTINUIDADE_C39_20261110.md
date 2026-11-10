# Vonix Hair — Auditoria de continuidade C39: integridade de pedidos simultâneos

**10/11/2026 — e-commerce operacional somente** `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, upstream PR #26. **Base C38:** `cada683592dcd1f7c78ae250870a2075284583ef`, worktree inicial limpa, 4/4 verificações GitHub aprovadas. O sistema independente de seleção/candidaturas de afiliadas não foi modificado.

## N159 — P1: a identidade de uma compra pendente era substituída pela próxima

O C37 introduziu um snapshot sem dados pessoais em `src/lib/pending-purchase-basket.ts` para evitar apagar o carrinho do comprador quando um pagamento antigo (Pix/cartão) fosse aprovado depois que ele adicionou novos itens. A implementação C37 usava **um único objeto** em `sessionStorage`, guardando apenas um `orderId`. Ao criar outro pedido pendente, o navegador substituía o registro anterior; a confirmação subsequente do primeiro pedido já não identificava quais itens haviam sido comprados. Por segurança, a sacola era mantida, podendo continuar exibindo produtos já pagos; os itens do evento `Purchase` eram omitidos por falta de identificação confiável.

**Provas RED antes da alteração:** dois testes adicionais executados em `src/test/pending-purchase-basket.test.ts` falharam (1) ao salvar pedido 123 e depois 124 e tentar recuperar o primeiro; (2) ao ler snapshot C37 legado, salvar um novo pedido e recuperar ambos. Não houve transação real.

**Correção C39:** o mesmo nome de chave é mantido para compatibilidade, mas os dados passam a usar `{ version: 2, entries: [...] }`:
- snapshots separados por ID de pedido, com apenas slug, variante, quantidade, oferta e timestamp — **sem CPF, endereço, nome, e-mail, cartão, token ou declaração de pagamento aprovado**;
- máximo de **oito** pedidos por aba, retenção de **24 horas** e descarte dos mais antigos quando o limite é atingido;
- leitura/migração automática do snapshot C37 (`{orderId,lines,savedAt}`), sem descartar a compra anterior ao registrar outra;
- validação da identidade, formato, tamanho, quantidade e validade temporal de cada registro; entrada adulterada ou vencida é ignorada sem envenenar os outros pedidos;
- `clearPurchaseBasket(orderId)` elimina apenas a compra correspondente; não confunde registros, nem supõe que qualquer pagamento está quitado;
- se o armazenamento estiver desabilitado/corrompido, a lógica de limpeza de carrinho continua **conservadora**: não apaga por suposição. A Appmax permanece a única fonte autorizada do estado de pagamento.

Foi acrescentado teste integrado de checkout com **dois snapshots**, uma confirmação de cartão antigo autenticada e uma segunda compra preservada. O checkout limpa somente a sacola correspondente ao pagamento aprovado, mantém o segundo snapshot e não atribui o produto da segunda compra ao primeiro evento de conversão. Além dos dois testes RED, entraram testes novos para limite de oito pedidos, integridade dos demais após corrupção de um registro, migração legada, prazo e recuperação.

## Escopo de auditoria e gates de QA

| Escopo | Evidência |
| --- | --- |
| Testes focados de checkout/Pix/cartão/snapshot | **99/99 PASS em 4 arquivos** |
| Vitest integral, reexecução **isolada** | **751/751 PASS em 88 arquivos** |
| Primeira execução integral sob concorrência intensa | **750 PASS, 1 timeout**, no teste de checklist `affiliate-readiness-script.test.ts`, depois **PASS** na repetição isolada. Resultado original preservado, sem alterar lógica de afiliadas |
| TypeScript, ESLint funcional, build, Prettier, diff-check | Resultados de saída documentados em recibo separado; 12 avisos ESLint históricos, sem erros |
| SSR PDP ativos | **42/42 PASS**, produto `plex-vonix` retirado responde 404 |
| Rotas / catálogo / mídia | **15/15 rotas**, 42 produtos ativos, **129/129** referências de imagens válidas |
| Feed Meta CSV local | **42 linhas**, sem discrepâncias de link/preço/identificador; **`in stock` não comprovado por Bling** |
| Chrome vitrine e carrinho (320/390/1366px) | **3/3 PASS**, rede externa bloqueada |
| Chrome checkout sintético (320/390/1366px) | **3/3 PASS**, sem pagamentos |
| Chrome específico C39 (320/390/1366px) | **3/3 PASS**: dois pedidos guardados, recuperados individualmente, exclusão de um sem apagar outro; sem PII |
| HTML `noscript` | **3/3** confirma marcação SSR; **não** é prova de renderização visual com JavaScript desativado |
| Screenshots locais | **21 PNGs**, mais relatório JSON do teste específico de pedidos |

O servidor Vite C39 respondeu HTTP 200 após a preparação inicial (primeiro probe curto, durante compilação SSR, não foi conclusivo). Não houve alteração de produção nem da API de pagamento para superar esse aquecimento. O timeout da primeira suíte sob recursos concorrentes não foi ocultado: `qa-artifacts/vonix-c39/logs/full-vitest.log` e `full-vitest-isolated.log` guardam ambos os resultados, e o caso de checklist não foi modificado.

**Rastreabilidade:** `docs/VONIX_SSR_PREFLIGHT_C39_20261110.json`, `docs/VONIX_META_FEED_READINESS_C39_20261110.json`, `qa-artifacts/vonix-c39/`, `scripts/qa-c39-*.mjs`, `docs/VONIX_C39_VERIFIED_RECEIPT_20261110.json`. Logs textuais em `qa-artifacts/.../logs/` podem ser locais e ignorados por Git; o recibo separa arquivos fonte/artefatos versionados dos logs locais.

## Riscos externos não resolvidos — PRODUÇÃO NOT_APPROVED

1. **Bling/Meta:** confirmação real de estoque vendável por SKU/variante para 42 declarações `in stock` do feed; não inferir disponibilidade por existir no catálogo.
2. **Appmax:** homologação autorizada Pix/cartão/antifraude, webhook, pedido pago, conciliação, estorno e idempotência em sandbox/staging real.
3. **Frete:** dimensões/pesos e serviços de transportadoras verificadas em pacotes reais, CEPs e prazos. O peso/dimensões existentes são hipóteses.
4. **Cloudflare/Supabase:** staging dedicado para migrações/RLS, backup/restore, observabilidade, WAF e rollback efetivo.
5. **LGPD, avaliações e analytics:** origem dos reviews, consentimento e correspondência GA4/Meta com compras efetivamente pagas.

**Limites:** dados sintéticos, sem pagamentos/pedidos reais, leitura de `.env`, banco operacional, mudança de campanha, integração/publicação externa, merge do PR ou deploy. Este resultado não comprova que o domínio publicado já usa o C39 e não substitui homologações comerciais.
