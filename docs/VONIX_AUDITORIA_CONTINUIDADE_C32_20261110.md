# Vonix Hair — Auditoria C32: frete resiliente, cupom pendente e congelamento de checkout

**Data:** 10/11/2026. **Projeto único:** e-commerce operacional Vonix Hair em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR original #26. Base verificada: **C31 `9e4ac78`**, 4/4 checks verdes, worktree limpa. Não é o sistema independente de inscrição/seleção de afiliadas. **Produção NOT_APPROVED.**

## Correções efetivamente implementadas

| ID | Área | Falha/risco observado | Mudança C32 |
| --- | --- | --- | --- |
| **N132 (alta)** | Cálculo de frete | `quoteShipping` sem prazo máximo deixava “Calculando frete…” indefinido, sem permitir retry caso uma promessa não terminasse | Watchdog de **15 segundos** para a cotação corrente, zera opções e seleção, mostra erro específico e libera `Tentar calcular frete novamente`; mantém CTA de pagamento bloqueado. O cliente explicitamente inicia o retry. |
| **N133 (alta)** | Resposta de frete atrasada | Mesmo quando UI terminasse de aguardar, uma resposta antiga poderia tentar exibir transportadora / preço de uma solicitação obsoleta | Callback antigo é ignorado após expiração e após troca de CEP/itens/cupom/retry; reenvio cria novo `shippingRequestKey` (C31); teste confirma que um serviço retornado tardiamente não substitui cotação nova. **O timeout do browser não cancela necessariamente o trabalho remoto do provedor**, mas impede que sua resposta reative o CTA. |
| **N134 (alta)** | Verificação das formas de pagamento | O watchdog de 12 s de `getPaymentConfig` marcava o gateway como indisponível, mas ainda aceitava `then` tardio para reabrir os campos sem uma nova consulta explícita | Encerra o ciclo de consulta ao expirar. Só **`Tentar consultar novamente`** inicia outra verificação que possa desbloquear os campos; mantém sacola e guarda de pagamentos incertos. |
| **N135 (alta)** | Cupom de afiliada | O botão de pagar podia ficar ativo enquanto `lookupCoupon` validava um código remoto; o comprador poderia pagar antes de receber o desconto que esperava. Trocar um cupom remoto pendente por local podia deixar `couponChecking=true` até a promessa antiga resolver | CTA e ambas as funções de submit barram pagamento enquanto `couponChecking`; iniciar outra aplicação de cupom cancela a indicação visual do pedido de verificação anterior. Resultados antigos não substituem o cupom escolhido, via sequência de lookup existente. |
| **N136 (alta)** | Pagamento em andamento | Campos ainda podiam ser editados enquanto Pix/cartão estava sendo processado; callback de código de afiliada capturado por URL também podia mudar desconto depois que a tentativa começasse | Formulário fica `inert` e `aria-busy` quando `busy`, com botão já bloqueado; `checkoutSubmissionStarted` impede aplicar cupom de indicação assíncrono após início da tentativa validada. Nenhuma alteração na confirmação financeira ou tokens Appmax. |
| **N137 (QA)** | Falhas artificiais de teste | Primeira versão do teste de frete com relógio falso avançava **simultaneamente** o watchdog separado de configuração de pagamento, removendo o formulário antes da checagem do frete | Teste corrigido para aguardar primeiro configuração resolvida, só então controlar o relógio de frete. **Reexecução 62/62 checkout PASS**, sem mascarar a falha inicial. |

## Testes e evidências desta sessão

- `src/test/checkout-audit.test.tsx`: **cinco novos testes** de (1) frete travado 15s e retorno tardio, (2) retry com frete novo e retorno antigo, (3) configuração de gateway expirada com retorno tardio ignorado, (4) cupom remoto pendente/substituição por `BEMVINDA5`, (5) congelamento do formulário no Pix e cupom de indicação tardio. Todos sem pagamento real.
- **Vitest integral:** **680/680 testes em 83 arquivos PASS**, confirmado na execução completa após o último caso.
- **TypeScript** `npx tsc --noEmit`: exit 0; **ESLint funcional** `npx eslint . --rule 'prettier/prettier: off'`: exit 0; **build Nitro/Cloudflare local**: exit 0 (sem deploy). Verificações já executadas após alterações funcionais; último teste apenas acrescentou asserção nova.
- **SSR:** `scripts/qa-c32-ssr-storefront.mjs`, 42/42 páginas ativas PASS e `plex-vonix` HTTP 404, `docs/VONIX_SSR_PREFLIGHT_C32_20261110.json`.
- **Chrome local externo bloqueado:** `scripts/qa-c32-crossflow.mjs` **3/3** resoluções 320/390/1366 (home, público Salão, gaveta e carrinho), `scripts/qa-c32-checkout-readiness.mjs` **3/3** (gateway local não configurado, CPF/payment form ocultos, sacola sintética válida preservada). Capturas **15 PNG** e relatórios em `qa-artifacts/vonix-c32`. Nenhum pagamento Pix/cartão real ou de teste foi solicitado.
- Formatação dos arquivos alterados e `git diff --check` precisam estar verdes antes do registro Git; `docs/VONIX_C32_VERIFIED_RECEIPT_20261110.json` lista hashes SHA-256.

## Impacto e limitações verificadas

As mudanças impedem **interfaces travadas** e **preços/cupons mudando durante uma tentativa** de acordo com os testes simulados. **Não provam redução de abandono, lucro ou pedidos aprovados**, porque esta execução não acessou registros de pagamento, estoque de produção, transportadoras reais, Meta Ads nem base de compradores.

**Pendências P0 — produção NOT_APPROVED:** Appmax sandbox real e reconciliação de `paid_at`/fraude/idempotência; migração/RLS/restore em Supabase staging; Bling com estoque vendável atualizado por variante e feed Meta com **42 `in stock` ainda não comprovados**; serviço de frete real para CEP/dimensões/embalagens e staging Cloudflare; consentimento LGPD/revogação, avaliações e compras pagas reconciliadas com GA4/Meta. Preservar a PR #26 **aberta, sem merge ou deploy**, até homologação e autorização operacional.

**Regras de trabalho preservadas:** alterações somente no e-commerce; não ler `.env`, segredos nem banco operacional; não processar pagamentos, não mexer na aplicação separada de afiliadas e não interferir em outras worktrees.
