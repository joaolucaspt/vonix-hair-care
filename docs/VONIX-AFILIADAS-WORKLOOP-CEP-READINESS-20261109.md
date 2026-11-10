# Vonix Afiliadas — Workloop de CEP e diagnóstico operacional

Data: 09/11/2026 (America/Sao_Paulo). Workloop `4df1fdc8-6a15-4b2d-bd1d-a2c4f2e30f31`, execução `e5ec3ef6-5a71-453c-b4bd-e25aba091bc8`.

## Identidade e isolamento
- **Somente** cadastro de cinco etapas, triagem, informações de endereço e painel de preparo de afiliadas Vonix Haircare Showcase.
- Repositório original `lucassilva1175/vonix-hair-care`; Lovable project `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Worktree exclusiva `C:\Users\JL\code\vonix-affiliate-workloop-accessibility-20261109`; branch `feat/vonix-affiliate-accessibility-safe-20261109`.
- Base inicial `ed23f7e66d64477be3a3c216a4c16eb994a989dc` (PR #45).
- Checkout, pagamentos, produtos, métricas, vendas, cupons operacionais, comissões, integrações de lojas e demais projetos não estão no escopo; não ler `.env`, segredos, registros de candidatas, nem ativar inscrições/e-mails/deploy.

## Defeitos reproduzidos antes das correções
1. ViaCEP preenchia cidade, UF, rua e bairro após a consulta, mas a troca para outro CEP preservava campos antigos por causa do padrão `old.field || provider.field`. Na prática, o CEP novo podia ficar associado ao endereço anterior.
2. Campos vindos do provedor não eram validados antes de inserir na UI: resposta malformada com estado inexistente ou strings superdimensionadas chegava aos controles.
3. O diagnóstico privado podia apresentar **abertura habilitada** quando `AFFILIATE_RECRUITMENT_OPEN=true`, embora a criptografia obrigatória estivesse ausente e o endpoint público recusasse inscrições.
4. O segredo TOTP era normalizado no gate de segurança e na autenticação, mas não no diagnóstico privado, criando falso sinal de falha.
5. O indicador textual de consulta de CEP não usava uma região `aria-live` para leitores de tela.

## Alterações
- Controle independente dos campos preenchidos pela consulta de CEP; apenas esses campos são removidos quando o CEP muda, preservando edições manuais e número/complemento.
- Tratamento de respostas fora de ordem preservado com versão da consulta; respostas atrasadas não substituem endereço atual.
- Validação da UF contra os 27 estados e limites de texto para cidade, logradouro e bairro, descartando campos inválidos sem gravar dados externos.
- Região acessível de status para consulta de CEP (`role=status` e `aria-live=polite`), sem tornar o serviço externo obrigatório.
- Checklist de abertura reflete a condição efetiva `affiliateRecruitmentOpen()`; segredo TOTP normalizado como na autenticação.

## Testes e alcance
- Cinco regressões sintéticas falharam no código-base antes dos ajustes: mudança de CEP, texto externo inválido, checklist sem criptografia, TOTP formatado e status acessível.
- Suite focada após patch: **55/55 testes em 3 arquivos**, TypeScript e ESLint dos arquivos alterados sem erros.
- Suite integral local: **262/262 testes em 32 arquivos**; TypeScript, build Vite/Nitro e `git diff --check` passaram.
- **Limitação do ambiente Windows:** `npm run lint` global apresentou 13.268 erros `prettier/prettier`, predominantemente diferenças CRLF/LF distribuídas por arquivos preexistentes e fora desta worktree de alterações. O lint direcionado a todos os quatro arquivos TS/TSX alterados passou com exit 0. Não reformatar o e-commerce inteiro; CI remoto deve confirmar.
- Chrome local em 390 px e 1280 px: painel administrativo exige autenticação, formulário de cinco etapas em prévia, política abre em outra aba, rascunho preservado ao cancelar descarte, nenhuma requisição de gravação nem erro JavaScript.
- Para testar o CEP em componente, `fetch` é sempre simulado. Não houve acesso a candidatas, banco real ou credenciais; nenhum envio ao provedor de e-mail, checkout ou domínio externo.
- O navegador público permanece fechado e não é prova de conexão efetiva entre o Lovable e o Supabase dedicado `jewbzrbbvxyqmxqbrwrq`.

## Bloqueios operacionais
- Vinculação das credenciais privadas de Supabase ao runtime do Lovable não comprovada.
- Homologação LGPD, governança, proxy confiável, MFA e backups/restauração ainda exigem confirmação operacional.
- `AFFILIATE_RECRUITMENT_OPEN` permanece ausente/desligada.
