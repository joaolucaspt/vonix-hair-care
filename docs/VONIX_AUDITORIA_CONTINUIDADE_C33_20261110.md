# Vonix Hair — Auditoria C33: endereço de entrega coerente com CEP e entrada manual preservada

**Data:** 10/11/2026. **Escopo único:** e-commerce operacional Vonix Hair em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR original **#26**. Base inicial **C32 `f80909d`** com 4/4 checks GitHub verdes. **Este ciclo não inclui o formulário separado de candidaturas de afiliadas.**

## Achados com reprodução vermelha antes das correções

**N138 — endereço anterior permanecia após trocar CEP (risco de entrega errada).** Um comprador podia concluir uma consulta automática para CEP A, informar número e complemento e depois editar o CEP para B. A implementação apenas alterava `cep`, mantendo rua, bairro, cidade, UF, número e complemento de A. Isso representava dados de entrega inconsistentes; **não há evidência de pedido real com esse erro**. Teste de regressão falhou antes da correção.

**N139 — resposta automática sobrescrevia endereço digitado manualmente.** Enquanto `lookupAddress` estava pendente, o comprador podia corrigir a Rua; a resposta eventual sobrescrevia a correção, além de preencher cidade/bairro/UF. Teste de regressão falhou antes da correção. O hook já possuía cancelamento básico ao trocar CEP, mas não preservava campo editado manualmente.

**N140 — busca de CEP podia carregar indefinidamente.** Sem resposta nem rejeição do serviço de endereço, `useCepAddress` mantinha `loading=true`. O cliente conseguia digitar o endereço manualmente, mas a indicação de carregamento não terminava e não havia retry explícito. Terceiro teste falhou antes da correção.

## Mudanças implementadas

1. **`src/routes/checkout.tsx`:** quando um CEP antes completo (8 dígitos) é substituído por outro, limpar **somente os campos de endereço daquela entrega**: rua, bairro, cidade, UF, número e complemento. Preservar nome, e-mail, CPF, telefone, forma de pagamento e itens. Se a alteração for apenas máscara/visual e os dígitos forem iguais, preservar endereço. O usuário pode digitar o endereço manualmente depois da troca.
2. **`src/hooks/use-cep-address.ts` + checkout:** cada sucesso do lookup carrega o CEP exato consultado; o callback ignora respostas para CEP diferente do campo atual. Para o CEP correto, preenche **somente** rua/bairro/cidade/UF que ainda estejam vazios, sem sobrescrever correções manuais; não altera número/complemento.
3. **`useCepAddress`:** watchdog local de **10 segundos**, estado de falha e explicação clara de preenchimento manual. Uma resposta após expiração é ignorada; `Tentar buscar CEP novamente` dispara uma **nova consulta explícita** sem remover rua já digitada. O cálculo de frete continua independente.
4. **`src/test/checkout-audit.test.tsx`:** três regressões com dados sintéticos: limpar endereço do CEP anterior; preservar Rua digitada enquanto lookup aguarda; timeout 10s, endereço manual e retry bem-sucedido sem apagar correção. **Baseline vermelho 3/3 antes do patch; 65/65 testes de checkout após correção.**

## Validação verificável

- **Vitest completo: 683/683 testes PASS em 83 arquivos.** Três novos casos; checkout direcionado **65/65 PASS**.
- **TypeScript:** exit 0; **ESLint funcional** `npx eslint . --rule 'prettier/prettier: off'`: exit 0, 12 avisos legados de React Fast Refresh sem erros; **build Nitro/Cloudflare local:** exit 0. O build não representa deploy nem homologação Worker.
- **SSR:** `scripts/qa-c33-ssr-storefront.mjs` **42/42 produtos ativos** PASS, SKU `plex-vonix` 404. `docs/VONIX_SSR_PREFLIGHT_C33_20261110.json`.
- **Chrome, rede externa bloqueada:** `scripts/qa-c33-crossflow.mjs` **3/3** (home, navegação, vitrine, gaveta, carrinho) e `scripts/qa-c33-checkout-readiness.mjs` **3/3** (checkout sem gateway local, campos de pagamento não liberados, sacola sintética preservada). Resoluções **320, 390, 1366 px**, screenshots e `report.json` em `qa-artifacts/vonix-c33`.
- **Ambiente QA:** primeira tentativa de navegador recebeu `ERR_CONNECTION_REFUSED` porque a prévia antiga não estava rodando. Um `vite preview` isolado na porta 43973 não era compatível com o adaptador de build atual (procurava `dist/server/server.js` e devolvia HTTP 500), **não foi usado como verificação positiva**. Nova prévia Vite local em `127.0.0.1:43974` respondeu HTTP 200; repetição completa SSR 42/42, Chrome 3/3 e checkout 3/3. Sem alterar a configuração de build para mascarar a incompatibilidade de preview. O bloqueio da prévia compilada requer verificação de runtime Cloudflare staging.
- **Integridade:** Prettier dos arquivos alterados, `git diff --check` e manifesto SHA-256 em `docs/VONIX_C33_VERIFIED_RECEIPT_20261110.json`.

## P0 pendentes: produção NÃO APROVADA

Os bugs são relevantes para conversão e logística, mas **não provam pedidos perdidos ou vendas recuperadas**. Necessária a reconciliação de sessões, origens Meta Ads, tentativas e ordens efetivamente pagas.

1. **Appmax sandbox real e antifraude:** tokenização, Pix, cartão, `paid_at`, rejeição, expiração e recuperação idempotente sem cobrança duplicada.
2. **Supabase staging:** migrações, RLS/serviços autorizados, backup, restore, concorrência, isolamento e rollback.
3. **Bling + Meta:** disponibilidade por SKU/variante e saldo real antes de validar as **42 alegações `in stock` no feed**. Não desativar feed/anúncios sem análise comercial.
4. **Logística:** CEP real, dimensões/embalagem, frete real cotado e SLA; Worker Cloudflare staging, segurança e performance mobile fria. O cálculo de frete nunca foi disparado contra transportadora real nesta sessão.
5. **Privacidade/mensuração:** consentimento LGPD, reviews e prova social autorizados, GA4/Meta `Purchase` reconciliados com pagamentos confirmados.

**Restrições mantidas:** sem ler `.env`, segredos ou DB operacional, sem pedidos, pagamentos, clientes reais, integrações externas, merge, deploy ou alterações no sistema independente de afiliadas. Preservar PR #26 **OPEN** até homologação formal, com branch e worktree protegidas.
