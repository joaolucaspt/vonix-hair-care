# Vonix Hair — integração conservadora pós-C12 com a main oficial

**Data:** 09/11/2026 · **PR:** #26 · **Commit base C12:** `45c5405269f3f1f6929b6959839e005aa2bdc97b` · **Main integrada:** `58c740be4ad0e0c937461a42dcd47eac94a128cb`.

A `main` avançou com PRs oficiais #40 e #41, ambos exclusivamente relativos a formulários e sessões administrativas do sistema separado de afiliadas. Nenhuma alteração comercial/checkout/Meta do e-commerce foi produzida nessa atualização. Integração efetuada com `git merge --no-ff --no-commit origin/main`, sem reset, clean, stash, force-push ou deploy, e sem conflitos (`git ls-files -u` vazio).

**Isolamento validado:** 15 arquivos de afiliadas apareceram no merge por já fazerem parte da `main`; todos os 15 foram comparados aos blobs Git correspondentes de `origin/main` e são **idênticos**, sem edições manuais. Não confundir esses arquivos herdados com a implementação e auditoria exclusiva do e-commerce.

**Evidências após a integração:** 514/514 testes aprovados em 64 arquivos, `npx tsc --noEmit` exit 0, `npm run build` exit 0, SSR 42/42 produtos ativos e Plex HTTP 404; `git diff --cached --check` sem conflitos ou espaços inválidos. A suite cresceu com testes da `main`, sem invalidar o comprovante 495/495 anterior do código C12.

**P0 não homologados:** Appmax sandbox `paid_at` real, Pix/cartão/antifraude e reconciliação, Supabase staging com backup/migrações/RLS, Bling/estoque físico e dimensões, LGPD/revogação tardia de Purchase, WAF/rate limit distribuído e medição GA4 real. **Sem aprovação para merge do PR na main ou deploy.**
