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

## Segurança e escala — revisão adicional
- **Limite durável:** o banco controla atomicamente até **8 tentativas públicas por IP a cada 15 minutos** e **12 autenticações administrativas incorretas por IP a cada 15 minutos**. Após isso, o IP é temporariamente bloqueado; senha correta não consome tentativas, mas também fica bloqueada após o limite. É defesa complementar, não substitui WAF/CAPTCHA nem controle de abuso distribuído.
- **Privacidade:** o IP NÃO é armazenado como texto: é transformado em HMAC-SHA256 de escopo e IP, com o segredo de servidor `AFFILIATE_TRAFFIC_PEPPER`, que deve ter **pelo menos 32 caracteres aleatórios**. Sem IP verificado pelo proxy, segredo ou banco, a inscrição e o acesso administrativo negam acesso (fail closed).
- **Proxy:** por padrão, somente o cabeçalho `CF-Connecting-IP` é aceito. Se o provedor não o repassar, `AFFILIATE_TRUSTED_IP_HEADER=x-real-ip` ou `x-forwarded-for` só pode ser usado depois de confirmar que o proxy de borda **sobrescreve** o cabeçalho, impedindo falsificação por clientes. Testar em homologação antes de publicar, incluindo usuários de redes compartilhadas.
- **Retenção de quota:** a tabela `vonix_affiliate_throttles` possui RPC `vonix_affiliate_purge_throttle()`. Agendar invocação **diária** por tarefa privilegiada para excluir dados com mais de 2 dias (não executar via clientes anônimos). Definir separadamente a retenção LGPD de candidaturas.
- **Cadastros duplicados:** e-mail, Instagram e TikTok têm proteção de unicidade; links de perfis são canonizados. A resposta pública para conflito é neutra, evitando revelar se determinada pessoa já se inscreveu.
- **Busca administrativa:** `vonix_affiliate_search` recebe parâmetros SQL em vez de montar filtros PostgREST com texto arbitrário. Busca nomes e e-mails completos, preservando pontuação, e limita páginas a 40 cadastros.
- **Notificação confiável:** as respostas 429/5xx/timeout/409 são classificadas. Em caso de dúvida sobre aceite pelo Resend, o evento é marcado como `incerto` após o limite ou conflito definitivo; não é reenviado automaticamente fora da janela garantida de 24h. Respostas 400/401/403/422 sabidamente inválidas terminam como `falhou` sem tentativas desnecessárias. `enviado` significa **aceito pelo provedor**, não garantia de entrega na caixa de entrada. A reconciliação de `incerto` é manual e exige consultar o provedor primeiro.

## Testes de SQL isolados (não produção)
O SQL foi testado em contêiner PostgreSQL 16 **com rede desativada**, roles de teste anon/authenticated/service_role e dados sintéticos: schema, privilégios, quota, pesquisa, decisão única, outbox, falha incerta e contadores. Os scripts `supabase/vonix-affiliate-qa.sql` e `scripts/qa-affiliate-concurrency.mjs` são **somente para um banco descartável de QA**. O segundo testa duas decisões simultâneas: um resultado true, outro false e exatamente um e-mail na fila.

**Atenção:** esta validação não prova integração com Lovable Cloud nem entrega real de Resend. O banco Lovable do projeto ainda precisa ser habilitado, configurado e homologado antes de uso público. Este PR permanece em rascunho; nunca aplicar o SQL de QA no banco de produção.

## Escolha do banco — evitar conflito com pedidos
O repositório já contém persistência de checkout que utiliza as variáveis compartilhadas `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. O status de banco Lovable Cloud = desativado **não prova** que a loja não usa um Supabase externo. Por isso, nunca substituir as variáveis usadas pelo checkout sem auditoria.

Para um banco dedicado exclusivamente às candidaturas, configurar **ambas** `AFFILIATE_SUPABASE_URL` e `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY`. Se nenhuma delas estiver definida, o módulo usa as credenciais compartilhadas já existentes. Se somente uma das duas variáveis dedicadas estiver definida, o módulo falha de forma segura e não mistura URL e chave de bancos distintos. O SQL de afiliadas deve ser aplicado apenas no banco selecionado.

A implantação só deve prosseguir após verificar quem administra o banco atual do e-commerce, configurar o segredo `AFFILIATE_TRAFFIC_PEPPER`, testar o cabeçalho de IP do proxy e homologar ao menos uma inscrição de ponta a ponta **sem utilizar dados ou destinatários reais**.
