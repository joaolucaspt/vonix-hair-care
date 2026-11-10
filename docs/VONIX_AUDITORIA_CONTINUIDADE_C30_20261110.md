# Vonix Hair — Continuidade C30: busca sem hidratação e checkout com consulta recuperável

**Data:** 10/11/2026. **Único projeto alterado:** e-commerce Vonix Hair em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. Base inicial **C29 `a5b307d`**. Não confundir com o app separado de inscrição e seleção de afiliadas, cujos arquivos não foram modificados. **Produção NOT_APPROVED.**

## Diagnósticos e correções verificados

| ID | Área | Falha/risco encontrado | Correção C30 |
| --- | --- | --- | --- |
| **N124 (alta/conversão)** | Busca da home/cabeçalho | Em HTML antes da hidratação, os formulários não tinham `action=/loja`, `method=get` nem `name=q`. Clicando rápido ou sem JS, a navegação ia para `/?` e perdia a busca. Reproduzido Chrome **RED 0/3**. | Busca nativa com método GET, `q`, limite 120, semântica de busca e envio de teclado. Após hidratação, mantém navegação interna SPA e fechamento da busca móvel |
| **N125 (alta/conversão)** | Busca do catálogo filtrado | Busca antes da hidratação recarregava `/loja?` sem termo nem filtros. | Formulário nativo GET, campo `q` e entradas ocultas **somente** para filtros de URL normalizados (categoria, seção, tipo, necessidade, público, ordem). Busca hidratada continua preservando filtros com router |
| **N126 (média/mobile)** | Pesquisa na página de produto | A lupa móvel era um botão React sem alternativa clicável antes da hidratação/sem JavaScript. | `useHydrated`: link SSR para `/loja` enquanto app indisponível, botão de expandir busca após hidratação com `aria-controls` e campo funcional |
| **N127 (alta/checkout)** | Carregamento das formas de pagamento | Contato, CPF, endereço e pagamento podiam ser manipulados antes da conclusão de `getPaymentConfig`. | Formulário `inert` e `aria-busy` enquanto pendente, aviso de verificação e link fora do formulário para voltar à sacola. Guardas separadas em `onSubmit` e `submitPayment` impedem cobranças sem método confirmado |
| **N128 (alta/resiliência)** | Consulta de gateway travada/5xx | Uma promessa não resolvida deixaria a configuração indefinida, sem caminho de recuperação claro. | Watchdog **12 segundos**; falha vira orientação segura, botão `Tentar consultar novamente`, sacola preservada, cupom não reaplicado e nenhuma solicitação automática de Pix/cartão. Resposta tardia pode reabilitar métodos se validada; referências de tentativa anterior permanecem prioritárias |
| **N129 (QA)** | Integridade das verificações | Primeira tentativa do Chrome cruzado após reconexão do agente falhou por `ERR_CONNECTION_REFUSED` (localhost Vite parado). O primeiro seed sintético de checkout usou tamanho inválido `1L`, saneado como carrinho vazio. | Vite local reiniciado, crossflow repetido **3/3**, seed corrigido para variante real `Kit`, checkout Browser **3/3**. Esses falsos negativos não são atribuídos à aplicação |

## Testes reais e evidências

- **Vitest integral:** **672/672 PASS** em **83 arquivos**. Inclui **três novos testes** no `checkout-audit.test.tsx`: configuração pendente bloqueia formulário, falha permite nova consulta sem cobrança, watchdog de 12s libera estado seguro sem apagar sacola.
- **TypeScript:** `npx tsc --noEmit` **exit 0**.
- **ESLint funcional integral:** `npx eslint . --rule 'prettier/prettier: off'` **exit 0**. Dívida histórica CRLF/Prettier global continua separada; arquivos editados passam `prettier --check`. **Build Nitro/Cloudflare local:** **exit 0**. Não é deploy/Worker de staging.
- **SSR:** `scripts/qa-c30-ssr-storefront.mjs` **42/42 produtos ativos PASS**, `plex-vonix` HTTP **404**. Relatório `docs/VONIX_SSR_PREFLIGHT_C30_20261110.json`.
- **Chrome sem JavaScript:** `scripts/qa-c30-native-search.mjs` **3/3 PASS** em **320/390/1366 px** para pesquisa da home, pesquisa da loja com categoria preservada e link móvel do PDP. **RED antes das correções 0/3**, **GREEN final 3/3**.
- **Chrome com React hidratado:** `scripts/qa-c30-hydrated-search.mjs` **3/3 PASS** nas mesmas larguras: home, catálogo com `categoria=kits&uso=casa` preservados, busca na ficha do produto, nenhum erro JS/overflow.
- **Chrome do funil geral:** `scripts/qa-c30-crossflow.mjs` **3/3 PASS**, home, público Salão, gaveta de compra e carrinho, sem acionar checkout/pagamentos. O servidor Vite `127.0.0.1:43972` precisou ser reiniciado após queda transitória do agente; execução válida é a posterior ao reinício.
- **Chrome checkout sem gateway real:** `scripts/qa-c30-checkout-readiness.mjs` **3/3 PASS**: sacola sintética com SKU e variante existentes, pagamento indisponível local, nenhum CPF/formulário, sacola preservada. Não solicita Pix nem cartão.
- **Evidências:** `qa-artifacts/vonix-c30/search-no-js-report.json`, `qa-artifacts/vonix-c30/hydrated/report.json`, `qa-artifacts/vonix-c30/report.json`, `qa-artifacts/vonix-c30/checkout/report.json`, screenshots por 320/390/1366 px. Todos os testes de navegador bloquearam rede externa.

## Limitações e gates P0 ainda abertos

**Não atribuir recuperação de vendas a essas mudanças.** O funil real por sessão, canal e dispositivo ainda precisa ser conciliado com ordens pagas e tentativas/recusas Appmax. Nenhuma transação real nem pagamento em sandbox autorizado foi feito.

1. **Appmax sandbox autorizado:** validação Pix, cartão, antifraude, status, `paid_at`, expiração, tokenização, idempotência/timeout, reconciliação de pagamentos e recusa. O watchdog C30 é apenas do **readiness GET**, não autoriza nova cobrança quando há tentativa pendente.
2. **Supabase staging isolado:** RLS, migrações, backups/restore, funções `SECURITY DEFINER`, idempotência, snapshot de pedido e concorrência, sem acessar produção.
3. **Bling/Meta:** feed local ainda publica **42 `in stock` não verificados por saldo físico/SKU**. Auditoria de formato, links, imagens e preços passou no C29, mas não prova disponibilidade. Não suspender feed/anúncios em massa sem verificação de estoque e aprovação comercial.
4. **Frete e Worker:** cobertura/CEP e dimensões reais, SLA, Worker Cloudflare em staging, segurança WAF, desempenho móvel frio e rollback.
5. **Consentimento/marketing:** revogação LGPD após pedido pendente, reviews/autorização, GA4/Meta deduplicados e reconciliação de Purchase com confirmação financeira.

**Estado pretendido após publicação do checkpoint:** branch de auditoria e PR #26 em revisão, sem merge/deploy, sem mexer no sistema separado de afiliadas e sem prometer resultado comercial. Conferir checks remotos e worktree limpa antes de chamar o ciclo de certificado.
