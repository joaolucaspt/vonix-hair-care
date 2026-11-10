# Vonix Hair — Auditoria C31: cotação de frete vinculada ao CEP, à sacola e ao cupom

**Data:** 10/11/2026. **Projeto único:** e-commerce operacional Vonix Hair em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. Base anterior **C30 `a75d4ab`** (4/4 jobs GitHub verdes). **Não é o app independente de inscrição de afiliadas. Produção NOT_APPROVED.**

## Achado reproduzido e mudança

### N130 — Corrida entre mudança da sacola/CEP/cupom e cotação de frete

A página calculava `chosen = options.find(o => o.id === serviceId)` apenas pela seleção anterior. Quando o cliente mudava o CEP, itens, desconto ou solicitava nova cotação, a remoção de `options` acontecia no próximo `useEffect`. Na renderização anterior à limpeza, o checkout ainda podia conservar um serviço/total de frete que pertencia à entrada velha. O botão já usava `quoting` e `chosen`, e o servidor tem verificação de total; **não há prova de uma cobrança indevida passada**, mas a interface deveria ser fail-closed.

**Correção:** `src/routes/checkout.tsx` passa a gerar `shippingRequestKey` com **CEP apenas dígitos, lista completa de SKU/variante/quantidade/oferta, código do cupom ativo e número da tentativa de recotação**. `quotedRequestKey` só é preenchido ao receber opções de frete válidas para esses dados. Enquanto a cotação for pendente, falhar, retornar sem opções ou os dados forem alterados, `shippingQuoteCurrent` é falso, `chosen` é nulo, transportadoras antigas não são mostradas e o CTA de pagamento fica inativo. `onSubmit` e `submitPayment` também têm guarda direta para prevenir cobrança mesmo que o formulário seja enviado artificialmente por código. Os cálculos reais, gateway, carteiras e serviços do servidor permanecem inalterados.

### N131 — Validação das transições de cotação

Adicionados **3 testes** em `src/test/checkout-audit.test.tsx`:
1. Depois de cotação válida, alterar **CEP** enquanto a nova resposta está pendente: opção antiga desaparece, botão fica inativo, submit forçado não faz cobrança;
2. Alterar **quantidade/SKU da sacola** e rerenderizar: bloqueio imediato até a nova resposta e nenhuma cobrança;
3. Aplicar **BEMVINDA5** depois de frete válido: cotação anterior é invalidada, transporte antigo some, sem chamada de pagamento.

Os casos acima usam exclusivamente chamadas simuladas; não representam frete nem pagamento real.

## QA do ciclo

- **Vitest integral: 675/675 testes PASS em 83 arquivos**; alvo Checkout 57/57 PASS. Alguns testes legados emitem warnings React `act(...)` que não alteram o resultado.
- **TypeScript** `npx tsc --noEmit`: exit **0**; **ESLint funcional** `npx eslint . --rule 'prettier/prettier: off'`: exit **0**; **build Nitro/Cloudflare local**: exit **0**. Formatação dos arquivos editados e `git diff --check` examinados separadamente.
- **SSR 42/42 produtos ativos PASS** por `scripts/qa-c31-ssr-storefront.mjs`, `docs/VONIX_SSR_PREFLIGHT_C31_20261110.json`; SKU aposentado `plex-vonix` HTTP **404**.
- **Chrome headless local 3/3 PASS** em 320, 390 e 1366 px pelo `scripts/qa-c31-crossflow.mjs`, rede externa bloqueada, navegação home/público Salão/gaveta/carrinho sem pagamento. Capturas e `qa-artifacts/vonix-c31/report.json`.
- Nenhum pedido, token, CPF real, cotação externa, cobrança, banco operacional, anúncio, programa de afiliadas, merge ou deploy tocados.

## Impacto, limitações e gating

Essa mitigação reduz o risco **visual e operacional** de levar um orçamento de frete desatualizado ao checkout. Não significa que taxas de frete, estoque ou conversões foram verificadas em produção. As verificações dos valores e prazos ainda exigem cenários homologados com Melhor Envio/Bling e CEPs de teste.

**P0 pendentes:** (1) Appmax sandbox homologado: Pix/cartão/antifraude/`paid_at`/expiração/idempotência; (2) Supabase staging: políticas RLS, backup/restore e concorrência; (3) Bling estoque por variante e reconciliação Meta `42/42` alegações `in stock` ainda não comprovadas; (4) frete real por dimensões, CEP e transportadora e Worker Cloudflare staging; (5) LGPD, autenticidade de avaliações e reconciliação GA4/Meta com pedidos realmente pagos. Sem essas evidências, **não inferir a causa da ausência de vendas, nem aprovar produção**.

**Próximo passo de segurança:** após checagens local e CI, preservar PR #26 aberto sem merge/deploy, a árvore de trabalho limpa e continuar no mesmo projeto e branch. Todos os dados do QA são sintéticos.
