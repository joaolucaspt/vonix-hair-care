# Vonix Hair — operação final do programa de candidaturas

**Estado de segurança:** formulário de cinco etapas publicado, mas **inscrições fechadas por padrão**.
**Escopo ativo:** exclusivamente candidatura, triagem e proteção dos dados enviados.
Cupons, métricas, vendas e comissões pertencem a outro aplicativo e não devem
ser adicionados a este projeto.
Este documento é para operadores autorizados. Não contém chaves ou URLs de banco.
A liberação de candidaturas **não** significa que cupons individuais, atribuição de
vendas, cálculo ou pagamento de comissões já estejam implementados.

## 1. O que está implementado e testável sem dados reais

- A página pública `/seja-afiliada` possui landing editorial exclusiva Vonix Hair: hero com imagens do próprio catálogo, critérios da candidatura, três etapas de seleção, perfis de influenciadora/UGC, ideias de conteúdo, FAQ e chamadas para a inscrição. Referência externa usada **somente** como inspiração de arquitetura de landing page; nunca reutilizar fotos, provas sociais, avaliações, público, plataformas, taxas, prazos, descontos ou promessas de outra marca. As imagens são arquivos oficiais já presentes em `public/images/products`, e o FAQ apresenta a seleção como candidatura sem compra obrigatória, com benefícios somente mediante futura proposta formal.
- Formulário Vonix em cinco etapas, com validação de CPF/CNPJ, email, maioridade e termos.
- Prévia pública do formulário sem envios e sem armazenamento; descarte voluntário do rascunho com confirmação, sem salvar documentos no navegador. Ao usar **Fechar prévia** ou **Iniciar inscrição real**, a página também pede confirmação se existir rascunho não enviado; o aviso nativo de saída não protege mudanças de estado internas da mesma página.
- A página de cadastro reconsulta a disponibilidade quando a aba volta a ficar ativa; chamadas antigas não alteram a decisão mais recente. Uma prévia **nunca vira inscrição real automaticamente** depois de uma abertura. Para começar a inscrição real, é necessário iniciar um novo formulário explicitamente. Caso as inscrições sejam fechadas durante um preenchimento real, os campos continuam apenas na memória da aba, em modo simulação e sem POST.
- Antes de fechar uma página com candidatura não enviada, o navegador recebe um aviso de saída; a Política de Privacidade abre em outra aba, preservando os dados preenchidos. O aviso de saída depende do suporte do navegador e não substitui o descarte explícito.
- Campos condicionais ocultos (outro nicho e número de inscrição municipal) são limpos quando deixam de ser aplicáveis. O servidor também elimina esses valores antes de criptografar um questionário, mesmo se receber payload manipulado.
- CPF recebe uma máscara consistente de 11 dígitos (`000.000.000-00`), e o servidor aceita apenas CPF, telefone e CEP em formatos esperados e tamanhos limitados. Texto adicional, espaços arbitrários e payloads superdimensionados não passam à criptografia. Mensagens de erro do aceite dos termos são vinculadas ao controle para leitores de tela.
- CNPJ opcional possui máscara progressiva (`00.000.000/0000-00`), e servidor só aceita os 14 dígitos puros ou exatamente a máscara brasileira, com dígitos verificadores válidos. Letras, pontuação arbitrária e símbolos não são descartados silenciosamente antes da validação do payload. Celular exige DDD brasileiro existente, nove dígitos locais e início `9`; na interface o formato permanece `(DD) 9XXXX-XXXX`. Campos inválidos bloqueiam a etapa e recebem erro acessível.
- Consulta de CEP opcional: ao mudar o CEP, apenas os dados anteriormente inseridos automaticamente (cidade, estado, rua e bairro) são limpos; o que a candidata digitou manualmente permanece, assim como o número/complemento. O novo retorno do ViaCEP é validado por UF e comprimento de campos antes de preencher. Respostas atrasadas não repovoam dados. O status da consulta é anunciado para leitores de tela.
- Envio público exige origem do próprio site (HTTPS ou localhost de desenvolvimento); origem ausente ou divergente não passa ao limitador nem grava candidaturas.
- Somente conflitos HTTP 409 com `23505` **e identificação exata da restrição de e-mail** (`vonix_affiliate_applications_email_key`) recebem a mesma resposta pública de sucesso para impedir enumeração de candidatas. A tabela também possui índices únicos de Instagram e TikTok: conflitos nesses perfis não provam que a candidatura foi recebida e devem gerar falha genérica, sem expor qual conta já está cadastrada. Se o banco não identificar a restrição, o sistema falha de forma segura em vez de afirmar sucesso.
- Criptografia AES-256-GCM do questionário completo, com resumo sem documentos no painel. A API privada de triagem usa uma lista explícita de campos autorizados e remove campos adicionais vindos do banco, incluindo propriedades extras na fila de notificações. Registros e contadores inválidos são recusados, não apresentados como dados confiáveis.
- A chave do questionário exige exatamente **32 bytes** em 64 caracteres hexadecimais ou **43 caracteres base64url canônicos** (sem padding, espaços ou caracteres adicionais); servidor e script de prontidão aplicam a mesma regra. Respostas privadas com ciphertext acima de 32.768 caracteres são recusadas antes da decodificação, em vez de alocar memória sem limite.
- A projeção de resumo de um questionário antigo valida somente campos **não sensíveis** de interesse administrativo, com limites de tamanho, após autenticar o ciphertext. Não reavalia CPF ou idade atuais da candidata: requisitos de novas inscrições não podem apagar o resumo de um cadastro legítimo já recebido.
- A listagem privada rejeita resultados de busca com **mais de 40 inscrições** (limite máximo por página) e carimbos de criação/revisão que não sejam datas ISO válidas com fuso. Assim, respostas incorretas de uma RPC não produzem cartões ou datas inválidas no painel.
- Prévia LGPD exclusivamente de leitura: números obrigatoriamente inteiros e não negativos, sem preencher valores ausentes como se fossem zero.
- Diagnóstico privado do banco exige resultados válidos das RPCs de estatísticas e de retenção, não apenas HTTP 200. As duas consultas são independentes; uma falha não esconde o resultado da outra e nenhum corpo de erro é devolvido ao navegador.
- Diagnóstico de abertura administrativa usa a **mesma condição efetiva de liberação** do endpoint público e não considera somente o valor da flag. A verificação do segredo TOTP utiliza a mesma normalização de espaços que a autenticação, sem retornar a chave ao navegador.
- Login administrativo com sessão HttpOnly/SameSite Strict, TOTP no servidor e quota por IP. O botão de login só habilita após seis dígitos do autenticador.
- O painel oculta os dados das candidatas assim que a aba é escondida e durante a revalidação ao retomá-la. Se a validação falhar por conexão, mantém a tela protegida e permite repetir a consulta; se a sessão expirou, elimina imediatamente os dados privados.
- Acesso negado durante pesquisa, decisão, exclusão ou diagnósticos limpa os dados da candidata. A prévia de retenção descarta respostas antigas quando seus prazos são alterados, exibe os critérios efetivamente consultados e continua somente leitura.
- Durante a troca de filtros, busca ou paginação administrativa, os cartões pessoais anteriores ficam ocultos até o retorno da nova consulta, evitando apresentar dados defasados sob uma seleção diferente. Se a última inscrição de uma página avançada for aprovada ou excluída, a listagem consulta novamente a última página ainda existente para não deixar o operador preso em uma página vazia.
- Busca, triagem, decisões atômicas, fila Resend com idempotência e estados incertos. Antes de enviar qualquer comunicação, o servidor valida o resultado da reserva privada: exatamente zero ou uma mensagem, com UUIDs válidos, e-mail válido, decisão permitida e contador de tentativa inteiro. Respostas incompatíveis exigem conciliação e jamais disparam envio.
- O resumo administrativo da notificação vinculada à candidatura aceita **no máximo uma** linha de outbox (unicidade prevista no SQL) e `sent_at` nulo ou data ISO com fuso. Duas notificações indevidas ou uma data inválida são recusadas antes de compor os cartões privados.
- O retorno de sucesso do provedor de e-mail só confirma entrega à fila se contiver um identificador não vazio, sem espaços, caracteres de controle ou tamanho excessivo (até 128 caracteres). Recibos inválidos são tratados como **resultado incerto**, nunca como envio comprovado, para evitar duplicação automática.
- O painel diferencia `accepted` (aceito pelo provedor, **entrega não confirmada**), `queued` (na fila), `review` (resultado incerto/falhou: requer conciliação) e `unconfigured` (provedor ausente). Uma decisão administrativa pode ser registrada mesmo sem e-mail configurado, mas nunca deve aparecer como mensagem entregue.
- Exclusão definitiva **por administrador após validação externa da titular**, com confirmação
  de email, motivo e bloqueio durante mensagens em processamento.
- Trilha técnica de decisões e exclusões sem PII direta, preservada após apagar a candidata.
  Atenção: a senha compartilhada **não identifica individualmente** qual membro da equipe agiu.
- Prévia de retenção de inscrições pendentes/recusadas pelo painel privado
  (**Preparação / Prévia de retenção LGPD**), com intervalos de 30 a 3.650 dias
  e apenas contadores agregados. **Não apaga ninguém**. A prévia é sujeita a
  sessão administrativa, validação de origem e limitador de acesso por IP;
  resultados de requisições anteriores não voltam a aparecer após logout.
- Testes sintéticos SQL/RLS, concorrência e CI sem rede externa de banco.

## 2. Procedimento de preparação do banco

1. Identificar a instância Supabase **dedicada** ao módulo de candidaturas.
   O cadastro **nunca reutiliza** `SUPABASE_URL` ou
   `SUPABASE_SERVICE_ROLE_KEY` do checkout. A ausência de
   `AFFILIATE_SUPABASE_URL`, `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY` e
   `AFFILIATE_SUPABASE_PROJECT_REF` mantém tanto o formulário quanto a consulta administrativa indisponíveis.
2. Fazer backup/restauração de teste, revisar permissões e responsável pela base.
3. Aplicar, **nesta ordem**, em ambiente de homologação:
   `supabase/vonix-affiliate-applications.sql`;
   `supabase/vonix-affiliate-governance.sql`.
4. Validar as tabelas com acesso apenas ao `service_role` e os RPCs:
   `vonix_affiliate_stats`, `vonix_affiliate_search`,
   `vonix_affiliate_decide`, `vonix_affiliate_erase` e
   `vonix_affiliate_retention_preview`.
5. Testar concorrência, rollback e exclusão em **dados fictícios** na homologação.
   **Nunca executar** os arquivos `*-qa.sql` no banco de produção.
6. Aplicar as migrações revisadas na base real apenas depois da autorização operacional,
   backup e teste de restauração. Confirmar que a instância produtiva responde aos RPCs.
7. Só então atestar no ambiente do servidor `AFFILIATE_GOVERNANCE_MIGRATED=true`.
   A atestação é uma declaração de operação, não uma migração automática.

## 3. Configuração de variáveis privadas no servidor

Configurar pela interface do provedor de hospedagem, sem colar valores em chats,
commits, GitHub issues ou telas públicas. Não acessar/alterar os segredos de checkout.

| Variável | Finalidade |
| --- | --- |
| `AFFILIATE_SUPABASE_URL`, `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY`, `AFFILIATE_SUPABASE_PROJECT_REF` | **Três variáveis obrigatórias** para o módulo de inscrições; apenas no servidor. O ref deve corresponder ao hostname; a URL não pode ser a do checkout |
| `AFFILIATE_ADMIN_PASSWORD` | Senha de equipe (mínimo 16 caracteres); planejar identidades individuais antes de escalar |
| `AFFILIATE_ADMIN_SESSION_SECRET` | Assinatura da sessão (mínimo 32 caracteres, separada da senha) |
| `AFFILIATE_ADMIN_TOTP_SECRET` | Chave Base32 TOTP obrigatória para login e abertura em qualquer ambiente, mesmo sem `NODE_ENV` |
| `AFFILIATE_TRAFFIC_PEPPER` | Segredo de pseudonimização de IP (mínimo 32 caracteres) |
| `AFFILIATE_TRUSTED_IP_HEADER` | Um de `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`; **testar a borda** |
| `AFFILIATE_QUESTIONNAIRE_KEY` | Chave privada de **32 bytes** (64 caracteres hex ou 43 caracteres base64url canônicos, sem padding); backup seguro separado |
| `AFFILIATE_WORKER_SECRET` | Autorização do worker (mínimo 24 caracteres), **opcional para receber inscrições** |
| `RESEND_API_KEY`, `AFFILIATE_FROM_EMAIL` | Notificações de decisões, **opcionais para receber inscrições**; sem elas, e-mails não são enviados |
| `AFFILIATE_GOVERNANCE_MIGRATED` | `true` só após migração e testes na base correta |
| `AFFILIATE_PRIVACY_POLICY_APPROVED` | `true` só após aprovação do aviso de privacidade e política de retenção |
| `AFFILIATE_PROVIDER_VERIFIED` | `true` só após validar hospedagem, domínio HTTPS e proxy confiável; não atesta Resend nem envio de e-mails |
| `AFFILIATE_RECRUITMENT_OPEN` | **Última chave a ativar**; `true` só após testes do cadastro, banco, criptografia, proxy e aprovação LGPD |

No computador do operador ou no ambiente de homologação, executar
`node scripts/check-affiliate-readiness.mjs`. O script apenas lê variáveis
já presentes no processo e **não imprime segredos**. Ele verifica presença e
formato aproximado; NÃO valida migração real, posse de domínio ou conformidade jurídica.
O script separa os bloqueios de abertura dos alertas **opcionais** de
Resend/worker. Ter e-mails desligados não bloqueia o formulário.

## 4. Fluxos de homologação obrigatórios

- Abrir a URL pública: quando fechada, mostrar prévia e nunca chamar a API de cadastro.
- Ativar apenas em homologação e testar CPF válido/inválido, idade, email repetido,
  profiles, faixas de seguidores, honeypot, rate limit, redes compartilhadas.
- Verificar no banco que os campos completos de endereço e documento existem apenas
  em `questionnaire_encrypted`, nunca no log ou na resposta do navegador.
- Validar login/TOTP, origem, sessão, bloqueio por IP e logout com chamadas concorrentes.
  O servidor **não** permite bypass de TOTP quando `NODE_ENV` está ausente ou incorreto;
  sessões de domínio HTTPS usam cookie `__Host-`/`Secure` no login e no logout.
  Apenas localhost HTTP explicitamente em modo `development` ou `test` aceita cookie local de desenvolvimento.
- Validar decisão atômica, apenas um e-mail enfileirado por candidatura, Resend sandbox
  com domínio permitido, falhas 401/429/500, timeout e situação `incerto`.
- Homologar o `POST /api/internal/affiliate-mail-worker` com agendador autorizado.
  **Não agendar chamadas reais** até o remetente e a política de contato serem aprovados.
- Verificar recebimento e entregabilidade: resposta HTTP de aceitação não prova entrega.
- Solicitação de exclusão: verificar a identidade por processo interno, confirmar
  email exato no painel, executar exclusão, consultar registro técnico e verificar
  que dados, fila e ciphertext desapareceram. E-mail já enviado ao Resend requer
  procedimentos adicionais de privacidade junto ao provedor.
- Aprovar formalmente os prazos de retenção de pendentes e recusadas. No painel,
  consultar a **prévia LGPD** com os intervalos definidos na política aprovada.
  A prévia chama `vonix_affiliate_retention_preview` e retorna só quantidades;
  não remove registros e não inclui candidaturas aprovadas. Alterar os prazos
  invalida a prévia anterior. Não definir prazos arbitrários: alinhar com
  obrigações comerciais e legais. A exclusão de um titular continua separada,
  exigindo verificação de identidade, e-mail confirmado e motivo.

## 5. Limitações que exigem decisões humanas e serviços externos

- Banco de candidaturas dedicado, credenciais privadas no servidor, backup,
  domínio HTTPS e proxy ainda precisam ser confirmados pelo operador/fornecedor.
  O projeto Supabase já provisionado não equivale à conexão ativa no Lovable.
  A checagem de disponibilidade e o recebimento falham de forma restritiva
  até existir a configuração dedicada.
  Resend, remetente e agendador são opcionais para o **recebimento**,
  mas necessários antes de enviar qualquer e-mail de decisão.
- O cadastro não cria cupons nem integra com métricas de vendas ou comissões.
  A sugestão de cupom informada no formulário é apenas uma resposta de triagem.
  O aplicativo de métricas é separado e não faz parte deste escopo.
- Política LGPD, controlador, contato, base legal, retenção e descarte precisam
  de revisão apropriada antes de solicitar documentos pessoais em produção.
- A autenticação compartilhada não é identidade individual por funcionário;
  implantar acesso por usuário e trilha de auditoria atribuível antes de operar
  com equipe maior. A trilha técnica atual registra o que ocorreu, não quem fez.
- Monitoramento de abuso/WAF, entrega de e-mails, falhas e backup devem ser
  verificados no ambiente real, não presumidos por testes sintéticos.

**Liberação:** a abertura só é defensável quando o responsável confirma e documenta
cada etapa, os testes reais passam e `AFFILIATE_RECRUITMENT_OPEN=true` é ativado
intencionalmente. Não afirmar que está em produção com recebimento de candidaturas
com base apenas em build/CI verde.

## 6. Migração experimental anterior (fora do escopo)

Em 09/11/2026 foi instalada na base Supabase dedicada uma migração isolada de
**laboratório de vendas**. Por decisão do proprietário, esse recurso foi removido
do painel e do código ativo e **não participa do fluxo de candidaturas**. As duas
tabelas históricas `vonix_affiliate_sandbox_orders` e
`vonix_affiliate_sandbox_events` permanecem vazias e sem acessos públicos.
Não apagá-las em produção por automação ou sem revisão de backup e impacto.
