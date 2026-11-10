# Vonix Hair C34 — reconciliação segura da branch com a main (sem deploy)

**Data:** 10/11/2026. **Projeto editado:** e-commerce operacional `C:\Users\JL\code\vonix-hair-care`; branch `fix/vonix-ecommerce-auditoria-2026-11-09`; PR #26 mantido em revisão. A auditoria integral C34 original está em `docs/VONIX_AUDITORIA_INTEGRAL_C34_20261110.md`, commit `e0af39c`, recibo de 53 hashes. **Esta sincronização é apenas da branch, não é merge do PR na `main` nem publicação do site.**

## Diagnóstico com prova

A PR #26 ficou com `mergeable=CONFLICTING` depois de a `main` receber mudanças paralelas no portal de candidaturas de afiliadas. Um `git fetch origin main`, seguido de `git merge-tree --write-tree --name-only HEAD FETCH_HEAD` **somente leitura**, confirmou **um único conflito real em `src/data/pages.json`**. A árvore gerada `src/routeTree.gen.ts` foi reconciliada automaticamente. Nenhuma worktree alheia, banco, gateway, secret, anúncio ou domínio público foi tocado.

O JSON de páginas é compartilhado, mas contém **seis páginas/editoriais**. A `main` acrescentou no texto de privacidade a seção **2A: inscrições para o programa de afiliadas** e passou a mencionar ambos os domínios históricos; a branch do e-commerce já havia adicionado consentimento explícito de Google Analytics, Clarity e Pixel, além de atualizar páginas comerciais. Resolver tomando apenas um lado apagaria informações importantes do outro.

## Resolução auditável

- Política de privacidade resultante mantém integralmente a **versão atual de `main`**, inclusive dados de candidaturas, direitos dos titulares, os dois domínios e a seção 2A.
- Foi inserido o parágrafo comercial adicional da branch sobre **consentimento opcional de cookies e revogação**, sem remover o texto original da `main`.
- As demais cinco páginas editoriais permanecem com os valores da branch de e-commerce, preservando alterações comerciais e contratuais anteriores.
- **Nenhum arquivo de lógica de afiliadas foi editado manualmente**: apenas os arquivos já presentes na versão oficial `origin/main` foram incorporados à branch de revisão, conservando seus conteúdos. Não houve acesso ou gravação em banco nem ativação de inscrições.
- `src/test/site-domain-trust.test.ts` agora exige os **dois domínios na política**, a seção 2A das candidaturas, o termo canônico em Termos de Uso e a declaração de consentimento de ferramentas opcionais. O teste anterior exigia texto antigo com um só domínio e falhava após a incorporação da `main`; a nova regra protege ambos os conjuntos de conteúdo.

## Regressões sobre a base sincronizada

- **724/724 testes Vitest aprovados, 87 arquivos**, incluindo testes adicionais do portal já incorporados à `main`.
- **117/117 testes direcionados aprovados em 3 arquivos** (checkout UI/servidor + política).
- **TypeScript exit 0, ESLint funcional exit 0, build Nitro/Cloudflare local exit 0.** Nenhum teste de pagamento real ou deploy.
- PR #26 deve continuar **OPEN** e não deve ser mesclado na `main` até concluir gates P0 da auditoria C34: estoque real por SKU, Appmax sandbox, frete/dimensões reais, Supabase/Cloudflare staging, consentimento e mensuração financeira.

**Critério de conclusão deste anexo:** apenas depois de confirmar `git status` limpo e verificações remotas do SHA de sincronização; não assumir que resultados anteriores de CI certificam o novo commit. A branch em revisão não prova o comportamento do site público.
