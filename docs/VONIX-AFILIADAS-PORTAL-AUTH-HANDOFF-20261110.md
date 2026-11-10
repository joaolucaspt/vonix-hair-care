# Vonix Hair — portal de acompanhamento e gestão por contas individuais

Data: 10/11/2026. Projeto exclusivo `lucassilva1175/vonix-hair-care` (Lovable 203d2f84-1058-4ca4-acc3-41a4a5d4e2b5). Não alterar checkout, pedidos nem sistema separado de comissões.

## Endereços
- Programa e inscrição: https://vonixhair.com/seja-afiliada
- Portal privado da candidata: https://vonixhair.com/acompanhar-inscricao
- Ativação e login da equipe: https://vonixhair.com/acesso-equipe-afiliadas
- Painel de revisão: https://vonixhair.com/admin/afiliadas

## Solução implementada

- Supabase dedicado existente `jewbzrbbvxyqmxqbrwrq`, distinto do banco da loja.
- Migração `vonix_affiliate_portal_status_and_admin_invites_20261110` aplicada diretamente no Supabase: projeção de status com trigger após INSERT/UPDATE e RLS de leitura só pelo e-mail verificado do JWT; nenhuma leitura/gravação direta `anon` de inscrições.
- Fonte SQL versionada em `supabase/vonix-affiliate-portal-status.sql`. Verificar antes de reaplicar; não inclui e-mails particulares de administradores no repositório.
- Roster de 3 convites com papel `reviewer` já inserido na base. A conta de administrador proprietário anterior segue disponível.
- Nova rota de candidatas recebe autenticação por e-mail/código, verifica usuário no Auth e consulta SOMENTE status/datas sob RLS; não devolve CPF, endereço, telefone ou decisões de outras pessoas. Mantém acompanhamento após recusa.
- Após gravação válida da inscrição, servidor tenta convidar o e-mail ao Auth via chave *service role* do Supabase dedicado. O convite não é considerado enviado caso Auth o rejeite. Honeypot não cria conta.
- A tela do formulário não mostra sucesso de convite sem indicação de API, nem cria usuários diretamente pelo navegador.
- Nova rota de equipe: e-mail verificado, primeiro acesso com senha pessoal mínima de 12 caracteres, roster ativo e login posterior com autenticação **por senha no servidor**, não apenas OTP. Cookie administrativo HttpOnly, Secure, SameSite Strict, prazo de 1 hora.
- Equipe pode revisar, aprovar e recusar. Exclusão de dados fica reservada ao proprietário. A antiga senha+TOTP de proprietário continua disponível e o painel aponta para a nova rota de equipe.
- Site mantém a conta do e-commerce separada dos acessos de candidatas e gestores.

## Estado de liberação — não confundir UI com captação

No início do ciclo havia zero usuários Supabase Auth e zero candidaturas. A migration e as três entradas da lista de equipe **não enviam convites** automaticamente.

Verificar antes de ativar inscrições reais:
1. Na hospedagem privada do app configurar `AFFILIATE_SUPABASE_URL=https://jewbzrbbvxyqmxqbrwrq.supabase.co`, `AFFILIATE_SUPABASE_PROJECT_REF=jewbzrbbvxyqmxqbrwrq`, e `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY` **só no servidor**, separada da loja. Não inserir chave secreta em chat, GitHub, JavaScript público ou navegador.
2. Configurar no mesmo ambiente `AFFILIATE_QUESTIONNAIRE_KEY`, `AFFILIATE_ADMIN_SESSION_SECRET`, `AFFILIATE_ADMIN_PASSWORD`, `AFFILIATE_ADMIN_TOTP_SECRET`, `AFFILIATE_TRAFFIC_PEPPER`, `AFFILIATE_TRUSTED_IP_HEADER`. Fazer backup separado da chave de criptografia antes de receber dados.
3. Supabase Authentication → URL Configuration: revisar **Site URL** e adicionar `https://vonixhair.com/acompanhar-inscricao` e `https://vonixhair.com/acesso-equipe-afiliadas` aos redirect URLs. Confirmar produção HTTPS e templates reais.
4. Verificar SMTP/limite de e-mails e testar convite da primeira candidata e de cada um dos três gestores; formulário somente após prova de recebimento e confirmação de e-mail.
5. Em Supabase Auth / Providers, analisar `Allow new users to sign up`. No momento da auditoria estava ligado. Para impedir cadastros arbitrários via API pública, desligar após configurar o convite privado via service role e ativar administradores. RLS já impede que uma conta aleatória veja candidatura alheia, mas ter um usuário Auth não equivale a ter inscrição.
6. Com testes sintéticos e consentimento LGPD autorizado, confirmar INSERT da candidata, status pendente via portal, registro criptografado integral via painel, aprovação, recusa de outro teste, auditoria e tratamento de duplicidade; comprovar restauração/backup.
7. Somente então cumprir os indicadores de governança/privacidade/provedor do runbook e abrir `AFFILIATE_RECRUITMENT_OPEN=true` na hospedagem. Confirmar que o próprio domínio exibe inscrição real, não `prévia`.

## Não realizado neste ciclo

- Não há garantia de persistência da rota pública até verificar credenciais privadas da hospedagem e fazer read-back end-to-end.
- Não foram lidos/alterados segredos de produção, checkouts ou dados pessoais reais.
- Contas Supabase Auth dos três gestores e e-mails de convite exigem o fluxo externo de verificação; o roster não cria senha nem envia mensagens.
- A configuração de SMTP, Auth redirect allowlist, desativação do signup irrestrito e backups exige controle do projeto Supabase/hospedagem.
- Não prometer disponibilidade para campanha Meta enquanto a landing continuar indicando `Inscrições em preparação`.
