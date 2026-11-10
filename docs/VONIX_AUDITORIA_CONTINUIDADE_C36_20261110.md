# Vonix Hair — Auditoria de continuidade C36, 10/11/2026

**Projeto estritamente limitado:** e-commerce operacional `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. **Base verificada:** C35 `c970b052c3dd8ecd48d356d944f398605c564572`, worktree limpa, CI GitHub 4/4 aprovada antes desta rodada. O sistema de cadastro/seleção de afiliadas é outro projeto e não foi tocado. Nenhum merge, deploy, banco operacional, gateway ou anúncio real.

## 1. Defeitos comprovados e corrigidos com testes RED → GREEN

### N150 — P1: UF inválida aceita por resposta de CEP

- A validação do servidor postal `src/lib/address.server.ts` aceitava qualquer `^[A-Z]{2}$`, inclusive `ZZ` e `XX`, embora o checkout (endurecido no C34) aceite exclusivamente UFs brasileiras reais.
- **Teste antes da correção:** ViaCEP sintético respondia CEP correto com `uf: ZZ`. O servidor retornava sucesso em vez de buscar o BrasilAPI. Outro cenário simulava as duas fontes com UFs inexistentes e exigia falha segura: ambos **RED**.
- **Correção:** reusar `isValidBrazilUF` de `src/lib/checkout-input-validation.ts`, que já valida as 27 UFs. Resposta incoerente do provedor não autopreenche o checkout; tenta a outra fonte e, se ambas falharem, retorna orientação de entrada manual. Nenhuma requisição externa real realizada nos testes.

### N151 — P1: município só com espaços era aceito

- A cidade postal usava `z.string().min(1)`, aprovando `"   "`. Isso preenchia campo essencial com espaços, que a validação do pagamento rejeitaria só posteriormente.
- **RED:** teste com ViaCEP sintético contendo `localidade: "   "` exige tentativa ao BrasilAPI e resultado íntegro.
- **GREEN:** `z.string().trim().min(1)` e normalização dos campos rua/bairro por `.trim()`. Cidade ausente ou inválida não é tratada como endereço confirmado.

### N152 — P2: orientação incorreta para CEP de abrangência municipal

- CEPs válidos podem informar cidade/UF, mas não rua/bairro. A UI antiga dizia **"Endereço preenchido — confira e complete o número."** e focava diretamente o campo número, embora rua e bairro ainda estivessem vazios.
- **RED:** teste de checkout com resposta sintética `street=""`, `district=""`, `city="Belo Horizonte"`, `uf="MG"` exigia mensagem de preenchimento parcial e foco no campo rua.
- **GREEN:** `src/hooks/use-cep-address.ts` agora distingue rua e bairro ausentes, explica o que falta e `src/routes/checkout.tsx` direciona ao primeiro campo ausente (rua, bairro ou número), preservando campos manuais existentes. Uma consulta tardia para outro CEP continua protegida pelas verificações anteriores de cancelamento.
- Essa alteração não cria pedidos, modifica endereço de cliente existente ou envia mensagens reais.

## 2. Validação efetivamente realizada

| Gate | Resultado |
| --- | --- |
| Testes Vitest completos | **730/730 PASS**, 87 arquivos |
| Testes focados, consulta postal + checkout UI + servidor | **133/133 PASS**, 3 arquivos |
| TypeScript | **EXIT 0** |
| ESLint funcional (Prettier via verificação separada) | **EXIT 0**; 12 warnings históricos, 0 erros |
| Build local Nitro/Cloudflare | **EXIT 0** |
| Prettier / diff-check | **EXIT 0 / 0** |
| SSR produtos ativos | **42/42 PASS**, Plex Vonix removido 404 |
| Rotas / sitemap / integridade catálogo | **15/15 PASS**, 42 produtos ativos, 129 referências de imagens |
| Feed Meta público simulado pela rota local | **42/42 linhas, 0 divergências/duplicatas**; alegações `in stock` **sem estoque Bling comprovado** |
| Chrome com hidratação | **3/3 vitrine + 3/3 checkout** nos viewports 320, 390 e 1366 px; rede externa bloqueada |
| HTML `noscript` | **3/3 verificações de presença SSR**; não prova visibilidade visual em navegador realmente sem JS |
| Capturas locais | **21 PNGs**, em `qa-artifacts/vonix-c36/` |

Testes usam dados sintéticos, `vi.stubGlobal("fetch")` e mocks; nenhum pedido, pagamento, cotação real de transportadora ou atualização de banco operacional. Os scripts de QA C36 estão em `scripts/qa-c36-*.mjs`; relatórios estruturados `docs/VONIX_SSR_PREFLIGHT_C36_20261110.json`, `docs/VONIX_META_FEED_READINESS_C36_20261110.json`, `qa-artifacts/vonix-c36/`; recibo SHA-256 em `docs/VONIX_C36_VERIFIED_RECEIPT_20261110.json`.

## 3. Riscos de produção **não resolvidos**

- **P0 — estoque:** o feed Meta continua alegando `in stock` para 42 produtos; a existência de saldo vendável por SKU e variante no Bling, reservas e sincronização ainda **não foi homologada**. Não inferir falta de estoque nem alterar campanhas sem autorização.
- **P0 — pagamento:** não foram testados Appmax Pix/cartão/antifraude com transações reais de sandbox, reconciliação de `paid_at`, webhook, idempotência e estorno em staging aprovado.
- **P0 — frete:** pesos/dimensões são assumptions do catálogo; são necessários dados reais de variantes/kits e cotações de transportadoras por CEP.
- **P0 — staging:** Cloudflare Worker e Supabase exigem homologação real de runtime, RLS/migrações, backup/restore, WAF, observabilidade e rollback.
- **P1/P2 — publicação e marketing:** a branch do PR não é a loja publicada. Reconciliar GA4/Meta `Purchase` com pedidos pagos, consentimento LGPD e origem documentada de depoimentos antes de afirmar que as campanhas/vendas estão corretas.

**Decisão:** **PRODUÇÃO NOT_APPROVED.** A implementação local C36 só será considerada publicada após aprovação explícita de merge/deploy e smoke real no domínio de produção. Nenhuma estimativa de ROAS, lucro ou causa exclusiva de conversão foi inventada.
