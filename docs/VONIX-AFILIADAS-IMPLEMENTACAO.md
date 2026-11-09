# Vonix Hair | Sistema de inscrições e seleção de afiliadas

## Isolamento
Trabalho feito na branch feat/vonix-afiliadas-inscricoes do MESMO repositório vinculado ao projeto Lovable "Vonix Haircare Showcase" (203d2f84-1058-4ca4-acc3-41a4a5d4e2b5), em worktree separada. Não tocar no projeto "Vonix — Expedição Fácil". Nenhum banco, publicação, envio real ou segredo é alterado automaticamente por estes arquivos.

## Rotas
- Página pública para Instagram: /seja-afiliada
- Gestão restrita: /admin/afiliadas
- Worker autorizado de notificações: POST /api/internal/affiliate-mail-worker

## Campos e fluxo
O formulário pede nome completo, idade, cidade, UF, tipo de cabelo, e-mail, URL Instagram, URL TikTok e justificativa (mínimo 30 caracteres). Há aceite da política de privacidade e campo anti-bot invisível. Idade mínima provisória: 18 anos, para evitar contratação de menores sem desenho jurídico adequado. Todos os dados são validados no servidor; os perfis devem apontar para URLs HTTPS reais dos domínios oficiais, não para links arbitrários.

Inscrições são guardadas em vonix_affiliate_applications. A restrição UNIQUE no e-mail impede duplicidade do cadastro. O painel mostra os três status, contadores totais, busca por nome/e-mail, paginação de 40 em 40, links de perfis e justificativa. O login envia a senha administrativa (mínimo 16 caracteres) **apenas na autenticação inicial**, e exige código TOTP quando configurado. Depois, consultas e decisões validam no servidor um cookie HTTP-only assinado, com duração de 2 horas. A senha e o TOTP são apagados do estado da tela após o login, não aparecem nas URLs e não são enviados junto com cada decisão.

A decisão é transacional por RPC SQL: um UPDATE condicional de pendente para aprovada/recusada cria uma única entrada na tabela de e-mails, com UNIQUE(application_id). A decisão não pode ser repetida nem revertida pelo painel. Uma tentativa imediata de envio ocorre após salvar a decisão, se o provedor estiver configurado. Um worker autenticado pode processar a fila/repetições a cada cinco minutos, via agendamento do ambiente de hospedagem.

## Dependências de produção
1. Verificar/provisionar o banco Supabase correto no projeto Lovable. O serviço está indisponível se SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estiverem configurados.
2. Executar **manualmente, depois de revisão** supabase/vonix-affiliate-applications.sql na base correta. NÃO aplicar em produção sem backup/revisão.
3. Cadastrar segredos de servidor no Lovable (nunca no navegador ou no Git):
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - AFFILIATE_ADMIN_PASSWORD: uma senha forte de equipe com pelo menos 16 caracteres
   - AFFILIATE_ADMIN_SESSION_SECRET: segredo aleatório independente, com pelo menos 32 caracteres, usado para assinar cookies de sessão
   - AFFILIATE_ADMIN_TOTP_SECRET: segredo Base32 do aplicativo autenticador; obrigatório no ambiente de produção
   - RESEND_API_KEY: chave privada para o envio de e-mails transacionais
   - AFFILIATE_FROM_EMAIL: remetente em domínio previamente verificado no Resend (ex.: "Vonix Hair <afiliados@seudominio.com>")
   - AFFILIATE_WORKER_SECRET: senha aleatória com pelo menos 24 caracteres, distinta da senha de admin
   - AFFILIATE_TRUSTED_IP_HEADER: cabeçalho confiável definido pelo proxy, obrigatório; ver instruções de segurança
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
- **Proxy — configuração obrigatória:** não existe cabeçalho confiável por padrão. Definir `AFFILIATE_TRUSTED_IP_HEADER=cf-connecting-ip`, `x-real-ip` ou `x-forwarded-for` **somente após verificar que a borda/ingress remove e sobrescreve esse cabeçalho para toda requisição externa**. O código usa exclusivamente a opção configurada; não aceita `CF-Connecting-IP` incidentalmente em outro proxy. Na ausência de configuração válida, inscrições e autenticação administrativa falham de modo seguro. `x-forwarded-for` só é seguro se a borda garantir o primeiro IP como cliente real (não aceitar cadeia fornecida pelo próprio cliente). Testar em homologação com cabeçalhos falsificados e redes compartilhadas.
- **Retenção de quota:** a tabela `vonix_affiliate_throttles` possui RPC `vonix_affiliate_purge_throttle()`. Agendar invocação **diária** por tarefa privilegiada para excluir dados com mais de 2 dias (não executar via clientes anônimos). Definir separadamente a retenção LGPD de candidaturas.
- **Cadastros duplicados:** e-mail, Instagram e TikTok têm proteção de unicidade; links de perfis são canonizados. A resposta pública para conflito é neutra, evitando revelar se determinada pessoa já se inscreveu.
- **Busca administrativa:** `vonix_affiliate_search` recebe parâmetros SQL em vez de montar filtros PostgREST com texto arbitrário. Busca nomes e e-mails completos, preservando pontuação, e limita páginas a 40 cadastros.
- **Notificação confiável:** as respostas 429/5xx/timeout/409 são classificadas. Em caso de dúvida sobre aceite pelo Resend, o evento é marcado como `incerto` após o limite ou conflito definitivo; não é reenviado automaticamente fora da janela garantida de 24h. Respostas 400/401/403/422 sabidamente inválidas terminam como `falhou` sem tentativas desnecessárias. `enviado` significa **aceito pelo provedor**, não garantia de entrega na caixa de entrada. A reconciliação de `incerto` é manual e exige consultar o provedor primeiro.

## Testes de SQL isolados (não produção)
O SQL foi testado em contêiner PostgreSQL 16 **com rede desativada**, roles de teste anon/authenticated/service_role e dados sintéticos: schema, privilégios, quota, pesquisa, decisão única, outbox, falha incerta e contadores. Os scripts `supabase/vonix-affiliate-qa.sql` e `scripts/qa-affiliate-concurrency.mjs` são **somente para um banco descartável de QA**. O segundo testa duas decisões simultâneas: um resultado true, outro false e exatamente um e-mail na fila.

**Atenção:** esta validação não prova integração com Lovable Cloud nem entrega real de Resend. O banco Lovable do projeto não está habilitado; um Supabase externo pode estar vinculado ao checkout. Confirmar a base correta antes de qualquer ativação. O PR está pronto para revisão, mas não foi mesclado por falta de permissão de escrita. Nunca aplicar SQL de QA no banco de produção.

## Escolha do banco — evitar conflito com pedidos
O repositório já contém persistência de checkout que utiliza as variáveis compartilhadas `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. O status de banco Lovable Cloud = desativado **não prova** que a loja não usa um Supabase externo. Por isso, nunca substituir as variáveis usadas pelo checkout sem auditoria.

Para um banco dedicado exclusivamente às candidaturas, configurar **ambas** `AFFILIATE_SUPABASE_URL` e `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY`. Se nenhuma delas estiver definida, o módulo usa as credenciais compartilhadas já existentes. Se somente uma das duas variáveis dedicadas estiver definida, o módulo falha de forma segura e não mistura URL e chave de bancos distintos. O SQL de afiliadas deve ser aplicado apenas no banco selecionado.

A implantação só deve prosseguir após verificar quem administra o banco atual do e-commerce, configurar o segredo `AFFILIATE_TRAFFIC_PEPPER`, testar o cabeçalho de IP do proxy e homologar ao menos uma inscrição de ponta a ponta **sem utilizar dados ou destinatários reais**.

## Sessão administrativa com autenticação em duas etapas
- Login: senha + código TOTP de 6 dígitos se a equipe ativou o segundo fator. A produção exige o segredo TOTP, e não aceita login caso esteja ausente ou inválido. O código nunca é salvo no cadastro de candidatas.
- Sessão: cookie `__Host-vonix-affiliates-admin` em produção, `HttpOnly`, `Secure`, `SameSite=Strict`, limitado à origem do site e válido por **2 horas**. Em desenvolvimento local HTTP usa cookie distinto, sem `Secure`, exclusivamente para testes.
- Qualquer rotação da senha, do TOTP ou de `AFFILIATE_ADMIN_SESSION_SECRET` invalida as sessões anteriores. Logout apaga o cookie no navegador; sessões copiadas antes do logout só expiram após duas horas ou rotação de segredo (limitação de sessões stateless).
- Operações privadas validam a sessão e a mesma origem diretamente nas funções de servidor. O formulário público permanece independente da sessão.
- A senha única de equipe é um mecanismo temporário de bootstrap. Para uso com várias pessoas, o ideal ainda é substituir por contas individuais com MFA e registros auditáveis de cada decisão. Até isso acontecer, a equipe compartilha uma única identidade administrativa e não há rastreabilidade individual.
- Testes específicos cobrem assinatura, expiração, alteração de credenciais, TOTP (vetor RFC 6238), cookies, logout e proteção de origem. Não divulgar o link de administração sem primeiro configurar o banco de produção validado e os segredos.

## Observabilidade do recrutamento
- O painel exibe cinco contadores globais da fila: **aguardando, processando, aceitos, falhas e incertos**. O estado `enviado` significa que o provedor aceitou o envio, não que a destinatária recebeu/abriu a mensagem.
- A consulta administrativa usa busca **literal** por nome ou e-mail: `%`, `_` e barras invertidas não podem ser interpretados como curingas SQL. Isso foi verificado no PostgreSQL isolado com uma transação de QA que executa `ROLLBACK`.
- Os contadores permitem identificar problemas de envio sem expor dados de candidatas aos usuários públicos. O acesso continua exigindo sessão administrativa válida, e a checagem inicial de sessão envia `Cache-Control: no-store`.
- Ainda faltam webhooks de confirmação de entrega, monitoramento de rejeição/bounce e uma trilha de auditoria por funcionário. Esses itens não são substituídos pelos contadores atuais.

## Portão de abertura — integração segura pelo GitHub
**O merge de código não abre inscrições automaticamente.** A nova página `/seja-afiliada` apresenta o programa, mas exibe “Inscrições em preparação” até a ativação consciente do ambiente. A função de envio também rejeita tentativas de cadastro pela API enquanto o portão estiver fechado, independentemente do HTML/JavaScript exibido.

Para abrir **apenas após homologação**, definir `AFFILIATE_RECRUITMENT_OPEN=true` nas variáveis de ambiente **do servidor**. Além da confirmação explícita, o sistema exige banco configurado, segredo de IP, autenticação administrativa, TOTP válido em produção, chave/responsável do worker e configuração do Resend. NÃO colocar essas variáveis no cliente/GitHub nem editar os segredos do checkout. Antes de ativar, validar SQL aplicado à base correta, remetente verificado, proteção do proxy e aviso de privacidade. A flag não é substituto de teste de conectividade do banco: se o banco estiver errado, o envio ainda falhará de modo controlado.

Por padrão `AFFILIATE_RECRUITMENT_OPEN` está ausente e o sistema fica **fechado**, inclusive se o PR de código for mesclado à `main` pelo GitHub. A página não anunciará “Inscrições abertas” quando estiver desativada, evitando coletar dados pessoais em instalação incompleta.

## Validação automática no GitHub (sem Lovable e sem segredos)
O workflow `.github/workflows/vonix-affiliates.yml` foi acrescentado à branch para executar, em pull requests e pushes na `main`, a suíte completa de testes, TypeScript, build e lint dos arquivos de afiliadas. Uma segunda tarefa sobe PostgreSQL 16 **descartável com `--network none`**, aplica a migração somente nesse contêiner e executa testes SQL/RLS e concorrência. Nenhuma tarefa usa credenciais de produção, acessa o banco do checkout ou faz deploy. A execução por GitHub Actions depende de o repositório permitir a execução dos workflows; a existência do YAML não prova que o GitHub já os executou.

## Proteção do painel contra respostas tardias
Consultas administrativas simultâneas são identificadas por versão; apenas a resposta da consulta atual pode atualizar a tela. Ao clicar em sair, os dados pessoais, contadores e detalhes de candidaturas são limpos **imediatamente**, antes da resposta de rede. Uma requisição que termine depois do logout não pode repovoar dados pessoais. Se o servidor recusar a sessão, os dados são igualmente apagados. Há testes de interface de regressão para logout com consulta pendente, expiração da sessão e tela não autenticada. Isso não altera a limitação conhecida de revogação de cookies stateless copiados antes do logout, que permanecem válidos até expiração/rotação.

## Filas de notificações — triagem por situação
Na aba administrativa **Notificações**, os cards **Aguardando, Processando, Aceitos, Falhas e Incertos** são filtros clicáveis. A pesquisa e a paginação são executadas no banco com `vonix_affiliate_search(..., p_mail_status)`, cobrindo aprovações **e** recusas sem depender dos primeiros 40 registros da tela. Clicar novamente no filtro o remove. O resultado `incerto` deve ser conciliado no painel do Resend antes de qualquer reenvio; o sistema não cria novo e-mail automaticamente.

A migração SQL agora instala a assinatura de cinco parâmetros da RPC e, caso exista um rascunho de quatro parâmetros, o elimina para evitar duas versões da busca. **Somente aplicar após revisar dependências na base correta e fazer backup.** O script de QA sintético valida busca de ambas as decisões, filtros por status de e-mail e bloqueio de execução anônima. Os contadores refletem aceites do provedor, não entrega definitiva.

## Login e quotas por falha
O login consulta primeiro o bloqueio persistido do IP. **Somente senha/TOTP incorretos consomem o limite de 12 falhas a cada 15 minutos**; logins corretos não aumentam o contador, mas um IP já bloqueado permanece impedido de entrar. Falha da consulta ao banco ou origem incompatível nega acesso. Os novos testes cobrem logins corretos, senha errada, segundo fator errado, IP bloqueado, indisponibilidade do limitador e falha ao criar cookie.

## Questionário de cinco etapas (referência Nuala / Pilea — 09/11/2026)

O formulário `/seja-afiliada` foi ampliado com cinco etapas e um indicador de progresso. A referência pública foi inspecionada via navegador e resposta **pública GET** de configuração: `https://nuala.pilea.app/influencers/cadastro`. Nenhuma candidatura foi enviada ao serviço externo e não foram usados perfis de terceiros. A referência possui validação externa de Instagram que impediu avançar com perfil fictício; as etapas restantes foram obtidas da configuração **pública** de 5 arrays. A interface Vonix é implementação independente, com identidade visual própria.

| Etapa | Perguntas de origem / equivalentes Vonix |
| --- | --- |
| **1. Dados pessoais** | Primeiro Nome; Sobrenome; Celular; E-mail; Confirmar e-mail; CPF; CNPJ (opcional); Data de nascimento; Cidade de nascimento; CEP; Cidade; Estado; Logradouro; Bairro; Número; Complemento (opcional); Usuário do Instagram; Usuário do TikTok (opcional); Usuário do X (opcional); Usuário do YouTube (opcional) |
| **2. Seu conteúdo** | Nicho principal (Lifestyle, Cabelos, Beleza, Moda, Fitness, Viagem, Maternidade, Decoração, Outro); se Outro, qual nicho; seguidores Instagram (até 1 mil, 1–2 mil, 2–5 mil, 5–10 mil, acima de 10 mil); seguidores TikTok (até 1 mil, 1–2 mil, 2–5 mil, não utiliza TikTok) |
| **3. Complementares** | Possui inscrição municipal? Se sim, qual número? Você tem dependentes? (Somente filhos / Não tenho) |
| **4. Marca** | Com qual linha de produtos mais se identifica? Adaptado para produtos existentes no catálogo Vonix: Progressiva Fio de Luz, Botox Vonix, Máscara de Reparação Nutri Repair, Combo Cronograma Capilar, Outra linha Vonix. Nome desejado para cupom, terminando em `10`; **é apenas sugestão, não um cupom emitido** |
| **5. Finalização** | Tipo de cabelo (Liso, Cacheado, Ondulado, Crespo); leitura e aceite dos termos e política de privacidade da Vonix Hair |

**Diferenças deliberadas:** removemos o campo genérico "Novo campo" da referência; "outro nicho" e número de inscrição municipal aparecem somente quando aplicáveis; conferência do Instagram abre o link informado em nova aba, mas **não valida automaticamente titularidade ou número real de seguidores** (requer integração autorizada separada). Não copiamos termos da Nuala nem prometemos comissão ou cupom antes de um regulamento e contratação Vonix.

**Validação:** CPF e CNPJ por dígitos verificadores, nascimento e maioridade, confirmação do e-mail, telefone com DDD, CEP, perfis, faixas de seguidores, nome sugerido do cupom e termos; validação a cada etapa, botão Voltar com preservação do progresso. CEP pode ser consultado opcionalmente via ViaCEP quando inscrições abertas; número, CPF e contatos nunca são enviados a esse serviço. Enquanto fechadas, a página permite **prévia interativa** em desktop/mobile, sem requisições de cadastro, sem persistência de respostas e sem consulta CEP.

**Privacidade e banco:** o servidor deriva identidade do questionário validado, criptografa o questionário completo (AES-256-GCM, IV aleatório, tag de autenticidade) em `questionnaire_encrypted`, e entrega ao painel apenas um resumo operacional sem CPF, CNPJ, nascimento, endereço completo ou telefone. A chave de 32 bytes privada `AFFILIATE_QUESTIONNAIRE_KEY` (64 hex ou base64url) é **obrigatória** para abrir inscrições. Não colocar chave em JavaScript do navegador, Git, documentação ou sistema de logs. Fazer backup seguro e planejar rotação com recriptografia e retenção LGPD antes da coleta real. Um novo deploy **não aplica automaticamente** a migração à base em produção.

**SQL:** a migração `supabase/vonix-affiliate-applications.sql` adiciona a coluna criptografada e torna TikTok/motivação opcionais para o cadastro de cinco etapas, sem apagar inscrições legadas. O serviço de busca envia texto cifrado apenas ao backend com `service_role`; o servidor o retira da resposta administrativa após calcular o resumo. Conferir a base e executar backup/revisão antes de aplicar produção. Não ativar `AFFILIATE_RECRUITMENT_OPEN=true` até banco, chave, MFA, proxy, WAF, Resend e requisitos jurídicos estarem homologados.

**QA:** 165/165 testes locais em 25 arquivos, TypeScript, ESLint e build aprovados; PostgreSQL 16 descartável com migração/RLS/concorrência aprovados; fluxo automatizado **real no navegador desktop e mobile 5/5 etapas** com dados fictícios, zero POST de candidatura em prévia. Nenhuma inscrição real foi recebida/enviada nessa implementação.
