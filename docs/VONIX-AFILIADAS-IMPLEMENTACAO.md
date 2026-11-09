# Vonix Hair | Sistema de inscrições e seleção de afiliadas

## Isolamento
Trabalho feito na branch feat/vonix-afiliadas-inscricoes do MESMO repositório vinculado ao projeto Lovable "Vonix Haircare Showcase" (203d2f84-1058-4ca4-acc3-41a4a5d4e2b5), em worktree separada. Não tocar no projeto "Vonix — Expedição Fácil". Nenhum banco, publicação, envio real ou segredo é alterado automaticamente por estes arquivos.

## Rotas
- Página pública para Instagram: /seja-afiliada
- Gestão restrita: /admin/afiliadas
- Worker autorizado de notificações: POST /api/internal/affiliate-mail-worker

## Campos e fluxo
O formulário pede nome completo, idade, cidade, UF, tipo de cabelo, e-mail, URL Instagram, URL TikTok e justificativa (mínimo 30 caracteres). Há aceite da política de privacidade e campo anti-bot invisível. Idade mínima provisória: 18 anos, para evitar contratação de menores sem desenho jurídico adequado. Todos os dados são validados no servidor; os perfis devem apontar para URLs HTTPS reais dos domínios oficiais, não para links arbitrários.

Inscrições são guardadas em vonix_affiliate_applications. A restrição UNIQUE no e-mail impede duplicidade do cadastro. O painel mostra os três status, contadores totais, busca por nome/e-mail, paginação de 40 em 40, links de perfis e justificativa. Apenas quem envia AFFILIATE_ADMIN_PASSWORD correta (mínimo 16 caracteres) ao servidor acessa as ações. A senha não é persistida no navegador e não consta da URL.

A decisão é transacional por RPC SQL: um UPDATE condicional de pendente para aprovada/recusada cria uma única entrada na tabela de e-mails, com UNIQUE(application_id). A decisão não pode ser repetida nem revertida pelo painel. Uma tentativa imediata de envio ocorre após salvar a decisão, se o provedor estiver configurado. Um worker autenticado pode processar a fila/repetições a cada cinco minutos, via agendamento do ambiente de hospedagem.

## Dependências de produção
1. Verificar/provisionar o banco Supabase correto no projeto Lovable. O serviço está indisponível se SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estiverem configurados.
2. Executar **manualmente, depois de revisão** supabase/vonix-affiliate-applications.sql na base correta. NÃO aplicar em produção sem backup/revisão.
3. Cadastrar segredos de servidor no Lovable (nunca no navegador ou no Git):
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - AFFILIATE_ADMIN_PASSWORD: uma senha forte de equipe com pelo menos 16 caracteres
   - RESEND_API_KEY: chave privada para o envio de e-mails transacionais
   - AFFILIATE_FROM_EMAIL: remetente em domínio previamente verificado no Resend (ex.: "Vonix Hair <afiliados@seudominio.com>")
   - AFFILIATE_WORKER_SECRET: senha aleatória com pelo menos 24 caracteres, distinta da senha de admin
4. Configurar um cron externo/autorizado a fazer POST HTTPS em /api/internal/affiliate-mail-worker com Authorization: Bearer <AFFILIATE_WORKER_SECRET> a cada 5 minutos. NÃO deixar o worker público nem chamá-lo em GET.
5. Testar: inscrição real de homologação, repetição por mesmo e-mail, login admin negado/autorizado, filtros, duas decisões concorrentes para o mesmo cadastro, mensagens e fluxo real Resend em destinatário controlado, retries e falha da rede.
6. Atualizar os avisos LGPD (controlador, contato, prazo de retenção e eliminação) e validar as regras de participação e remuneração antes de divulgar a URL na bio.
7. Antes do lançamento, implantar rate limiting e proteção de bot/WAF na borda, preferir usuários individuais e MFA para a equipe, além de métricas operacionais, backups, política de retenção e monitoramento da fila.

## Idempotência e limitação declarada
Banco: somente uma mudança de status e uma entrada de outbox por candidatura. Provedor Resend: Idempotency-Key constante por mensagem, com janela de deduplicação de 24h. A fila só repete até 20h; depois casos incertos exigem conciliação humana para não causar reenvio automático fora dessa janela. A indisponibilidade do remetente NÃO apaga uma decisão salva.

## Critérios de liberação
Não prometer que e-mails serão enviados antes da configuração. Não publicar, não executar SQL em produção, não ligar autenticação compartilhada como solução definitiva e não disparar e-mails reais sem revisão de segurança, privacidade e aprovação do responsável.
