# C56 — Aprovadas: contatos protegidos + e-mail opcional + transparência

**Data:** 18/11/2026. **Projeto exclusivo:** portal de afiliadas Vonix Hair, separado do e-commerce. **Base comprovada:** main `5c43ef104da7e7f2c34dafe702db341c55999844` (C55).

## Diagnóstico verificável (sem expor dados pessoais)

Projeto Supabase dedicado `jewbzrbbvxyqmxqbrwrq`, com quatro candidaturas `aprovada`: **uma antiga v2 com e-mail na coluna e três v3 simplificadas sem e-mail coletado**. Todas as quatro têm respostas criptografadas. Também há quatro recusadas (uma v2, três v3). Não foi necessário nem possível inventar e-mail para registros antigos. A equipe pode usar telefone/Instagram das inscrições existentes.

Os dados de telefone, endereço e Instagram das v3 vivem em `questionnaire_encrypted` com AES-256-GCM. A listagem de triagem deliberadamente não libera telefone/endereço sem solicitação individual. O acesso protegido `getAffiliateApplicationPrivateDetail` já exige mesma origem, sessão administrativa válida e rate limit; o servidor lê o ciphertext por ID e só então descriptografa. Nenhum PII de terceiros foi lido/exposto no relatório.

**Outra causa:** das quatro contas administrativas owner, principal e Isabela completaram a troca de senha; Giovana e Lucas têm `must_rotate_password=true`. Não desabilitar essa proteção nem compartilhar credenciais. Para visualizar dados, precisam concluir a troca obrigatória de senha provisória com as próprias contas. Nenhuma sessão autenticada real foi simulada ou acessada sem senha.

## Correção C56

- `src/routes/admin.afiliadas.tsx`: card de aprovada explicita **Dados e contatos da afiliada aprovada** e botão **Ver contatos e respostas**; mostra e-mail armazenado ou **Não informado no cadastro simplificado**. Respostas confidenciais só aparecem depois do clique com sessão válida. Fechar o detalhe oculta novamente contato/telefone/endereço. O caso de candidata antiga sem e-mail não dá falso erro. Campos de documentos antigos seguem protegidos.
- `src/lib/affiliate-simple.ts`, `affiliate-applications.server.ts`, `affiliate-wizard-crypto.server.ts`: para novas inscrições, e-mail **opcional**, formato validado, normalizado para minúsculas, salvo na coluna nullable existente e no ciphertext de v3. Endereço/telefone ainda criptografados. O decodificador aceita ciphertext histórico v3 **sem** campo email, convertendo ausência para string vazia. Evita forjar e-mails. Nenhuma migration, GRANT ou RLS expandido.
- `src/components/affiliate-simple-form.tsx`: novo campo opcional sem alterar telefone, endereço, Instagram obrigatórios ou TikTok opcional. Aviso de que o código de acompanhamento não é enviado por e-mail, mesmo informado.
- `src/components/affiliate-application-prep.tsx`, `src/routes/seja-afiliada.tsx`, `src/components/affiliate-landing.tsx`: comunicação alinhada; FAQ honesto sobre e-mail opcional. A landing premium C55 mantém imagens reais e avaliações **de produtos**, sem depoimentos fictícios de afiliadas.
- Testes adaptados + novos testes de acesso protegido, não leitura por visitantes, exposição de contato só sob demanda, ausência de e-mail histórico v3 e nova escrita opcional.

## Segurança/limitações

Banco: `public.vonix_affiliate_applications` somente `service_role` tem GRANT direto; `anon` e `authenticated` não têm SELECT. Não alteramos RLS nem o Supabase. Server action valida sessão atual de admin + origem e taxa; credenciais e segredo nunca chegam ao navegador. A equipe deve tratar e-mails/telefones conforme a LGPD.

É impossível exibir e-mails de candidatas que não os forneceram. Não há recuperação automática de dados jamais coletados. Solicite os e-mails por contato autorizado via telefone/Instagram se for necessário, sem inventar registros. **Não foram modificados os dados e estados reais dos 8 registros.**

## Evidências

- TypeScript `--noEmit`: PASS; ESLint dos 13 arquivos: PASS; Prettier PASS; build de produção PASS.
- Suite integral: **741/741 testes PASS em 77 arquivos** (testes direcionados 128/128 inicialmente, depois 741).
- Chrome em localhost 360×780, 390×844, 768×1024, 1440×900: **4/4 PASS**; campo e-mail `type=email` e opcional, telefone obrigatório, FAQ sete itens, nenhum erro JS/overflow ou envio de candidatura. Rota administrativa sem login: nenhuma candidatura ou dado protegido visível. Testes sintéticos cobrem desbloqueio do detalhe após autorização. **Não houve teste E2E com sessão real de administradora** por ausência de sua senha e proibição de expor PII.
- O primeiro script QA lia o formulário antes da consulta de disponibilidade terminar; foi corrigido para aguardar o botão real de prévia e a tela de login. `C56-browser-QA-final2.log` final PASS.
- Logs, scripts QA e screenshots em `C56-browser-QA.cjs`/`C56-browser-shots` ficam no clone local, sem commit, e não incluem dados reais.
- Nenhum arquivo de e-commerce, preço, carrinho, pagamento, checkout, integração, banco original nem `.env` foi modificado.

## Publicação

Submeter PR delimitado e validar os dois gates de GitHub. Integrar só com CI verde, deploy Lovable, verificar bundle servido e smoke de produção. O status de publicação só deve ser marcado concluído após read-back da aplicação pública e do painel desautenticado.
