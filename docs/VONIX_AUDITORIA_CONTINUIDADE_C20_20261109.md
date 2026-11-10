# Vonix Hair e-commerce — C20: avaliações e privacidade das áreas pessoais

**Data (Brasil):** 09/11/2026 · **Projeto isolado:** `C:\Users\JL\code\vonix-hair-care` · **Branch:** `fix/vonix-ecommerce-auditoria-2026-11-09` · **Base C19:** `8a6e57f` · **PR:** #26 · **Produção:** NOT_APPROVED.

## Incorporação controlada

A origem `lucassilva1175/vonix-hair-care` passou a incluir PR #49, commit `0dc0dd8`. A branch de auditoria do **e-commerce** incorporou a versão da `main` via `git merge --no-commit --no-ff origin/main` sem conflitos; só o histórico da branch será concluído ao commitar o C20. As alterações do PR #49 são exclusivamente de consistência de dados de afiliadas já existentes neste repositório original. **Não foi acessado nem modificado o aplicativo independente de inscrições** ou sua worktree. Não houve merge nem deploy na `main` original.

## Mudanças comprovadas no e-commerce

**N76 — Formulário de avaliações mantinha estado do produto anterior na navegação SPA (média).** O mesmo componente `ReviewForm` pode permanecer montado quando muda o `slug` da rota de produto. Se a avaliação do produto A estivesse concluída, a interface do produto B mostrava a mensagem “Avaliação enviada” e ocultava o formulário mesmo sem avaliação de B. C20 reconfigura a nota, campos, estado, publicação e erros ao mudar o produto; somente mostra “enviada” se o armazenamento local realmente indicar **aquele slug**. Um armazenamento local inválido não bloqueia o formulário.

**N77 — Submissão duplicada e resposta fora de ordem (média).** A única guarda anterior era `state === "sending"`, que só é refletida após React processar o render. Dois eventos submit na mesma atualização podiam invocar duas vezes o servidor. A nova trava síncrona `sendingRef` impede duplicações locais enquanto o request está pendente; um contador de geração por produto impede que resposta atrasada do produto A altere o sucesso/rascunho de B. Ao falhar o servidor, a trava é liberada para nova tentativa. Isso **não substitui** rate limit, deduplicação server-side nem comprova ausência de duplicações originadas em dispositivos distintos.

**N78 — Metadados de páginas pessoais (baixa/média).** `/conta` e `/favoritos` agora definem `<meta name="robots" content="noindex, nofollow">`. O checkout já possuía `noindex`. Essas diretivas evitam indexação acidental por mecanismos cooperantes; **não são autenticação**, não alteram tokens assinados de consulta nem protegem dados por si só. O token de status continua exclusivamente na sessão e nunca no HTML.

## Evidências objetivas

- **TDD RED:** três cenários falharam antes dos ajustes (estado vazando para outro produto, submissões simultâneas, metadados ausentes); após correção **15/15 testes direcionados PASS em 2 arquivos**, incluindo resposta atrasada, falha de persistência sem falso sucesso, recuperação após erro e token ausente do HTML.
- **Vitest integral:** **611/611 PASS em 72 arquivos**; `npx tsc --noEmit` exit 0; `npx eslint . --quiet --rule 'prettier/prettier: off'` exit 0; `npx prettier --check` nos arquivos alterados exit 0; `git diff --check` exit 0.
- **Build:** `npm run build` exit 0 com Nitro Cloudflare Module (build não publicado).
- **SSR:** 42/42 SKUs ativos, zero falhas, somente host dev local. O script atualizou o timestamp do relatório SSR histórico e este foi restaurado por substituição cirúrgica, sem comandos destrutivos de Git.
- **Chrome 320/390/1366:** `scripts/qa-c20-reviews-private-pages.mjs`, 3/3 sucesso, 9 screenshots e `qa-artifacts/vonix-c20/dev/report.json`. O navegador acessou **Meus pedidos**, **Favoritos** e uma página de produto para editar um rascunho sem enviar. Verificou `noindex,nofollow`, token sintético não presente no DOM, flag local `paid:true` não apresentada como confirmação real, formulário editável, nenhuma exceção JS e nenhuma transação/review real. **Todas as requisições externas foram bloqueadas.**

## O que o ciclo não resolveu

- Não foram homologados Appmax Pix/cartão/antifraude, reembolso/status `paid_at`, Bling, estoque por SKU, cotação real por CEP, Supabase staging RLS/backup/restauração, WAF rate-limit distribuído, revogação de consentimento pós-pedido, mensuração de compras efetivamente pagas e Worker Cloudflare hospedado.
- O `npm run lint` estrito tem dívida histórica Prettier/CRLF; o gate de ESLint sem essa regra não significa que a formatação completa do repositório esteja limpa.
- O browser usa **dev local, dados sintéticos, sem rede externa**, não uma homologação do checkout real. `robots` é uma instrução cooperativa para indexadores, não substitui autorização por pedido.
- Não há evidência de melhoria efetiva de conversão ou vendas pagas, apenas correções e testes de funcionamento.

## Checkpoint e próximo gate

Branch de auditoria e PR #26 devem manter histórico da `main` incorporado, commit exclusivo C20, backup e gates de CI verificáveis. A etapa seguinte deve validar segurança do Worker e as integrações financeiras em **staging explicitamente autorizado** antes de qualquer liberação operacional. Nenhuma alteração no app independente de afiliadas, pagamento real, banco operacional, push para a `main` ou deploy foi realizada.

## Sincronização adicional da origem: PR #50

Após o commit inicial do C20, a `main` do repositório original avançou para **`96296d4` (PR #50)**, com validação de chaves e limites de criptografia nas funções de afiliadas já presentes no mesmo repositório. A atualização foi incorporada **na branch auditada** usando `git merge --no-commit --no-ff origin/main`; zero conflitos, nenhuma mudança adicional nas rotas de e-commerce, componentes de avaliação ou tratamento de pagamentos auditados. Não houve alterações no aplicativo independente de candidaturas.

Após PR #50, nova execução integral: **614/614 Vitest PASS em 72 arquivos**, TypeScript exit 0, ESLint do repositório sem a regra Prettier legada exit 0, build Nitro exit 0. O Chrome foi executado novamente em 320/390/1366 com **3/3 PASS** e nove novas capturas em `qa-artifacts/vonix-c20/pr50/`, usando dados sintéticos e bloqueio de toda rede externa. A validação SSR 42/42 ocorreu antes dessa integração, que não modificou catálogo nem PDP. Esses resultados confirmam a compatibilidade da branch atual, não a prontidão de produção.
