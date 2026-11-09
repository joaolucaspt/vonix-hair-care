# Vonix Haircare Showcase — handoff do sistema de afiliadas (09/11/2026)

**Escopo exclusivo:** Vonix Haircare Showcase — projeto Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`. Repositório original `lucassilva1175/vonix-hair-care`. Não confundir com Vonix — Expedição Fácil nem com outros projetos.

## Origem e integração
- Worktree isolada: `C:\Users\JL\code\vonix-hair-afiliadas`, branch `feat/vonix-afiliadas-inscricoes`.
- PR: https://github.com/lucassilva1175/vonix-hair-care/pull/27, criado a partir do fork `joaolucaspt/vonix-hair-care`.
- Em 09/11/2026, a branch incorporou a main original em `231f3bd166af0fa30eda1056b3ec19c718305aac`. Checkout, pagamentos, frete, catálogo, analytics e homepage ficaram sem alterações próprias deste módulo.
- Em 09/11/2026 a permissão GitHub de `joaolucaspt` foi ampliada para WRITE no repositório original: o PR #27 foi mesclado, GitHub Actions passou e a versão pública foi publicada no domínio `vonixhair.com`. Não alterar checkout operacional nem publicar candidaturas reais.

## Superfície implementada
- `/seja-afiliada`: página de recrutamento com validação de nome, idade 18+, cidade/UF, tipo de cabelo, Instagram/TikTok, e-mail, motivação e consentimento. `AFFILIATE_RECRUITMENT_OPEN` é **false por padrão**. Ao estar desabilitado, o formulário não aparece e a API rejeita a inscrição.
- `/admin/afiliadas`: sessão assinada de duas horas com cookie `HttpOnly`, TOTP exigido em produção, bloqueio por IP e prevenção de exibição de informações privadas após logout ou resposta tardia. **Tentativas inválidas** gastam a cota; autenticações corretas não gastam, mas bloqueio já ativo é respeitado.
- Visão de decisões pendentes/aprovadas/recusadas e aba **Notificações**; filtros globais por `pendente`, `processando`, `enviado`, `falhou`, `incerto` no PostgreSQL (não em filtragem local), com busca literal e paginação.
- SQL Supabase com RLS, RPC de decisão atômica e outbox única por cadastro; envio idempotente via Resend com worker protegido e conciliação manual de envios incertos.
- Cabeçalho IP da borda é obrigatório e escolhido explicitamente (`AFFILIATE_TRUSTED_IP_HEADER`). Sem proxy confiável, cadastro e login falham de forma segura.
- CI proposto em `.github/workflows/vonix-affiliates.yml`: testes/TS/lint/build e PostgreSQL 16 descartável `--network none`.

## Evidências locais desta sessão
- **154/154 testes passaram em 23 arquivos**, incluindo testes de checkout e frete existentes, autenticação/2FA, envio, painel, filas e busca.
- `npx tsc --noEmit`: PASS.
- ESLint focado no módulo de afiliadas: PASS.
- `npm run build`: PASS, com avisos de `inputValidator()` depreciado apenas em módulos preexistentes de checkout/reviews/leads.
- PostgreSQL 16 descartável, sem rede: migração PASS, QA/RLS/busca por status de notificações PASS, disputa real de duas decisões concorrentes PASS (uma decisão e uma notificação).
- Teste HTTP local: `GET /` 200, `GET /seja-afiliada` 200, `GET /admin/afiliadas` 200 e `POST /api/internal/affiliate-mail-worker` sem autorização 401. Nenhum dado real, cadastro ou e-mail enviado.

## Pendências explícitas (não alegar produção pronta)
1. **Concluído**: PR #27 mesclado e publicado na main original; novas evoluções do questionário seguem em PR/branch próprio, sem ativação de inscrições.
2. **Concluído para PR #27**: GitHub Actions executou testes, build e PostgreSQL descartável com sucesso (run `42641774161`). Evoluções posteriores exigem nova execução do CI após novo PR/merge.
3. Escolher e verificar banco Supabase real sem tocar nas credenciais do checkout. O banco Lovable Cloud deste projeto constou como desativado; isso não exclui Supabase externo.
4. Revisar e aplicar a migração apenas no banco autorizado, com backup. A RPC de busca substitui a assinatura de quatro argumentos por uma de cinco, mantendo o quinto opcional.
5. Configurar exclusivamente no servidor segredos de admin/sessão/TOTP, limite IP/HMAC e cabeçalho do proxy, Resend e remetente validado, worker/cron autenticado, controle de retenção e termos LGPD.
6. Homologar fluxos end-to-end em ambiente isolado, WAF, entregabilidade e auditabilidade antes de ativar `AFFILIATE_RECRUITMENT_OPEN=true`.

**Restrições:** não ler segredos nem bancos operacionais, não misturar projetos, não abrir inscrições ou enviar e-mails reais nesta fase; deploy de código somente após CI e mantendo recrutamento fechado; preservar a worktree principal `C:\Users\JL\code\vonix-hair-care` e suas mudanças concorrentes.

## Adendo — questionário de cinco etapas (09/11/2026)

A continuação utiliza a worktree isolada `C:\Users\JL\code\vonix-hair-questionario`, branch `feat/vonix-questionario-cinco-etapas` a partir da main pós-PR #27. A permissão GitHub WRITE já foi concedida e o PR #27 foi integrado e publicado. Este módulo não altera o checkout principal.

Novos arquivos: `src/lib/affiliate-wizard.ts`, `src/lib/affiliate-wizard-crypto.server.ts`, `src/components/affiliate-wizard.tsx`, `src/test/affiliate-wizard.test.ts`, `src/test/affiliate-wizard-ui.test.tsx`. Atualizados: página pública, backend, schema SQL, painel, QA, CI e documentação. Os cinco grupos de perguntas foram auditados na configuração pública da referência Nuala (sem inscrição real); ver o documento IMPLEMENTACAO para detalhes. A prévia de cinco etapas é acessível mesmo enquanto a operação está fechada, sem submissões ou armazenamento.

A chave privada de 32 bytes `AFFILIATE_QUESTIONNAIRE_KEY` passa a ser necessária para abrir o cadastro; dados sensíveis do questionário são criptografados e não apresentados no painel. A migração SQL adicional não foi aplicada à base operacional. O programa segue em fase de homologação sem inscrições reais.
