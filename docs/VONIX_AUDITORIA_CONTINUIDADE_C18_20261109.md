# Vonix Hair e-commerce — C18: integração da main sem regressão de pagamento

**Data local:** 09/11/2026 · **Projeto:** SOMENTE `C:\Users\JL\code\vonix-hair-care` · **Branch:** `fix/vonix-ecommerce-auditoria-2026-11-09` · **Base C17:** `949214d` · **PR:** #26 · **produção:** NOT_APPROVED.

## Resultado e escopo

- O histórico da `main` original foi incorporado **somente na branch de auditoria**, não na `main` remota: primeiro `ed23f7e` (PR #45), depois `cd91784` (PR #46, com ajustes no formulário de candidaturas). O aplicativo externo de candidaturas e suas outras worktrees não foram acessados ou alterados.
- Os cinco conflitos foram conciliados sem aceitar automaticamente o checkout menos protegido da `main`: `src/components/buy-drawer.tsx`, `src/lib/checkout.functions.ts`, `src/lib/upsell.ts`, `src/routes/checkout.tsx` e `src/routes/produto.$slug.tsx`. Foram feitas cópias SHA256 dos cinco arquivos auditados em um backup temporário da máquina antes do merge; os arquivos foram reintroduzidos e verificadas as cópias exatas antes de alterações pontuais. Sem `git reset`, `git restore`, `git checkout`, `git stash`, `git clean` ou deploy.
- Na API de pagamento, permanecem verificação de total cotado em centavos, deduplicação por fingerprint somente do servidor, bloqueio de tentativas incertas, snapshot imutável de pedido, validação de CPF, status do pedido com token assinado e reconciliação de Pix/cartão. A aplicação não inicia novo pagamento ao tentar recuperar um pedido.
- **N69 — cupom de afiliada com comprovação server-side:** a integração agora oferece `lookupCoupon` read-only de até 40 caracteres. O checkout só aceita códigos de indicação após confirmação positiva do resolvedor do servidor, e `createPayment` **revalida** a promoção antes de reservar e cobrar, inclusive se a confirmação anterior expirou. Percentuais nunca vêm do browser como fonte de verdade; desconhecido/indisponível falha fechado sem reservar nem pagar. Diferença entre preço exibido e real continua bloqueando o pagamento.
- **N70 — experiência de indicação segura:** cupons válidos capturados por `?ref=` podem ser propostos automaticamente após validação, sem sobrescrever cupom da roleta ou código já digitado. Busca assíncrona antiga não altera o carrinho após edição/remover cupom. O usuário pode inserir o cupom manualmente; Enter não submete pagamento.
- **N71 — mensagem comercial não cumulativa:** o popup de cupom no e-commerce passou a esclarecer que a oferta incide apenas sobre itens elegíveis sem outra promoção, e que o desconto Pix é condicionado às mesmas regras; botões de fechar/copiar têm área de toque ampliada. **Somente a mensagem e acessibilidade do popup do e-commerce foram editadas; não foi alterado o aplicativo externo de inscrições.**
- **N72 — CI estrutural:** `.github/workflows/vonix-ci.yml` agora adiciona o ESLint sem a regra de Prettier para impedir erros reais de código, mantendo a dívida histórica CRLF/formatos como pendência separada; workflow também mantém Vitest, TypeScript, build sem deploy e PostgreSQL sintético em container isolado.

## Evidências verificadas, sem operações reais

- Vitest focado de checkout, segurança, cupons, gaveta e upsell: **105/105 PASS**; popup seguro **2/2 PASS**.
- Após conciliar `cd91784`, Vitest **590/590 PASS, 70 arquivos** (exit 0), TypeScript exit 0, ESLint integral ignorando só a regra Prettier exit 0, build Vite/Nitro Cloudflare Module exit 0. ESLint dos arquivos e Prettier editados foram conferidos separadamente.
- Auditoria SSR local verificou **42/42 produtos ativos sem falhas**, preservando o snapshot histórico (alteração apenas do timestamp restaurada cirurgicamente).
- Chrome local sintético via `scripts/qa-c18-merged-checkout.mjs`, viewports **320 / 390 / 1366 px**, navegação PDP → gaveta → checkout → cupom estático Enter → sacola → retorno: **3/3 PASS**, sem erros de página, sem overflow horizontal, carrinho conservado e controle de toque >=44px. Nove screenshots e relatório em `qa-artifacts/vonix-c18/dev/`. Todas requisições externas do browser bloqueadas; **nenhuma submissão de pagamento** ou interação com banco operacional, Appmax, Bling ou cadastro real.
- O CI da branch no fork é evidência adicional quando houver resultado read-back para o commit final. Nunca interpretar build local como validação de pagamento em produção.

## Bloqueios P0 e decisão

**NÃO APROVADO PARA DEPLOY/PRODUÇÃO:** Appmax sandbox completo (Pix/card, `paid_at`, falhas ambíguas/charge duplicado, antifraude), Supabase staging isolado RLS/restore/idempotência, Bling e medidas/estoques SKU, Melhor Envio real por CEP, LGPD revogação após pedido, WAF/rate-limit distribuído, GA4 atribuído a pedidos efetivamente pagos, runtime Cloudflare Worker em staging e auditoria de dependências. `npm run lint` global estrito ainda apresenta dívida de formatação/CRLF no repositório; a regra Prettier não deve ser ignorada permanentemente sem plano de limpeza isolada.

**Critério de êxito da integração:** o PR #26 deve apontar para o commit auditado, com histórico da `main` até `cd91784` e `mergeable` sem conflitos no momento do read-back. Se novas alterações concorrerem na main, repetir comparação; não publicar automaticamente. Ganho de conversão/vendas ainda depende de métricas reais, não inferível de testes sintéticos.

## Leitura remota após publicação C18

O fork confirmou **CI verde** no SHA `10ee1f6` ([execução #42731662183](https://github.com/joaolucaspt/vonix-hair-care/actions/runs/42731662183)): job `verify` (Bun frozen-lockfile, testes, TypeScript, ESLint não-formatação e build) e job de idempotência SQL em PostgreSQL sintético concluídos com sucesso. O GitHub marcou o [PR #26](https://github.com/lucassilva1175/vonix-hair-care/pull/26) como **MERGEABLE** e ainda **OPEN**. O CI não valida operações reais; registrar novamente o estado após qualquer novo commit ou avanço relevante da main.
