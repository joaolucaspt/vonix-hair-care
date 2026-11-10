# Vonix Hair e-commerce — C17: cupom por teclado e sacola acessível

**Data:** 09/11/2026 (continuação noturna) · **Diretório:** `C:\Users\JL\code\vonix-hair-care` · **Projeto exclusivo:** e-commerce; **não** inscrição de afiliadas · **Branch:** `fix/vonix-ecommerce-auditoria-2026-11-09` · **Base de trabalho:** C16 `ec55413` · **PR de auditoria:** #26.

## Implementado

**N65 — Enter no cupom podia enviar o formulário de pagamento.** O campo `Código do cupom` ficava dentro do `checkout-form`, mas o botão `Aplicar` era `type=button`. Pressionar Enter no campo podia submeter o formulário principal, e não aplicar o código, principalmente depois que dados do comprador e cotação já estivessem preenchidos. C17 captura Enter **somente no campo de cupom**, impede a ação de submit e executa `applyCoupon()`. Composição IME ainda é respeitada. A API de pagamento e contratos de reserva/idempotência não foram alterados. Teste regressivo verifica `preventDefault`, cupom aplicado e ausência de chamada de pagamento.

**N66 — sacola com controles pequenos e indistinguíveis.** Os botões `Diminuir`, `Aumentar` e `Remover` tinham nomes idênticos em linhas diferentes, aproximadamente 24px e sem indicação de variante e oferta. C17 atribui nomes acessíveis exclusivos por **produto, variante e promoção**, alvos de **44x44px**, estado anunciado de quantidade, quebra de linha nos controles para telas pequenas, `type=button` explícito e aumento desativado no limite real de 99 unidades. Nenhuma linha foi removida automaticamente durante QA real.

**N67 — recomendações adicionais eram indistinguíveis em leitor de tela.** Botões `Adicionar` repetidos na sacola e na gaveta passaram a identificar o item. O botão de sugestões na sacola tem altura mínima de 44px. Testes provam que adicionar sugestão usa a oferta já existente, sem disparar checkout nem chamada ao gateway.

**N68 — substituição inválida não explicitava cupom anterior ativo.** A regra preserva o cupom válido anterior quando o visitante testa um código inválido; agora o checkout comunica **Cupom ativo: [código]**, com valor efetivo calculado apenas para itens elegíveis, enquanto a mensagem de código inválido fica visível. Isso evita confusão entre o texto digitado no campo e o desconto realmente considerado. O servidor continua validando preço/cupom novamente.

## Evidências reproduzíveis

- **RED/GREEN:** quatro testes de regressão propostos falharam antes do ajuste (cupom por Enter, cupom anterior, botões e sugestões). Após correção, a suíte direcionada atingiu **51/51 PASS**; adicionado também teste de limite 99.
- **Vitest integral:** **545/545 testes PASS em 66 arquivos**, exit 0.
- **TypeScript** `npx tsc --noEmit` exit 0; **ESLint dos arquivos alterados** exit 0; **Prettier dos arquivos alterados** exit 0.
- **Build Vite/Nitro:** exit 0, target Cloudflare module, **sem deploy**.
- **SSR catálogo:** 42/42 produtos ativos, zero falhas; `plex-vonix` continua indisponível/excluído. O script SSR alterou apenas o timestamp em `VONIX_SSR_PREFLIGHT_C3_20261109.json`; foi restaurado por substituição cirúrgica ao valor anterior, sem reset/restore Git.
- **Chrome local sintético:** `scripts/qa-c17-cart-coupon.mjs` percorreu PDP → gaveta → checkout → Enter no cupom → sacola → checkout em **320px / 390px / 1366px**. **3 PASS / 0 FAIL**; 9 screenshots de produto/gaveta, checkout e sacola em `qa-artifacts/vonix-c17/dev/`; comprovou cupom aplicado sem pagamento, controles de toque medidos >=44px, carrinho persistente, nenhuma exceção JS ou overflow horizontal. Toda requisição externa foi bloqueada; não houve transação real.
- **Lint global legado:** `npm run lint -- --quiet` **falhou** com **12.428 avisos classificados como erros de formatação Prettier**, incluindo endings CRLF e estilos históricos de scripts já existentes. Não executar `--fix` global, pois causaria diffs extensos fora do C17. Executado `npx eslint . --quiet --rule 'prettier/prettier: off'` em todo o projeto: **exit 0**, sem erros de lint não relacionados à formatação. Não declarar lint global verde sem qualificação.
- **Limite de teste:** Chrome serve a aplicação em desenvolvimento local. O bundle Cloudflare real, Appmax sandbox e backend/ERP em staging **não** foram homologados.

## Conciliação PR #26 e integração bloqueada

A `origin/main` local avançou para `ed23f7e`, incorporando alterações de afiliadas no PR #45 e mudanças na interface. Simulação read-only de merge da branch auditada com a `main` apontou **cinco conflitos**: `src/components/buy-drawer.tsx` (add/add), `src/lib/checkout.functions.ts`, `src/lib/upsell.ts` (add/add), `src/routes/checkout.tsx` e `src/routes/produto.$slug.tsx`. A PR #26 permanece aberta, não publicável automaticamente. Escolher `theirs` no checkout seria regressão de `statusToken`, idempotência, recuperação Pix/cartão, preço cotado e consentimento. **Não foi feito merge na main, rebase, checkout de branch, reset ou deploy.**

## Próximas portas P0 (não aprovadas)

Homologação com dados sintéticos em Appmax sandbox (autorização, QR Pix, antifraude, cancelamento, pagamento efetivo), Supabase staging isolado/RLS, Bling estoque e medidas, transporte real por SKU, rate-limit compartilhado, consentimento revogável após compra, revisão LGPD e conversões reais reconciliadas com pedidos pagos e funil GA4. A ausência de vendas **não pode ser explicada nem considerada resolvida apenas com este conjunto de testes**.

## Arquivos C17

`src/routes/checkout.tsx`, `src/routes/carrinho.tsx`, `src/components/buy-drawer.tsx`, `src/test/checkout-audit.test.tsx`, `src/test/buy-drawer-safety.test.tsx`, `scripts/qa-c17-cart-coupon.mjs`, `qa-artifacts/vonix-c17/dev/`, esta documentação, matriz e runbook P0. **Nenhum arquivo exclusivo de afiliadas foi editado.**
