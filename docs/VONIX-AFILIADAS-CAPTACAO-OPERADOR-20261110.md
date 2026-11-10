# Vonix Hair Afiliadas — recebimento emergencial com comando do proprietário

Data: 10/11/2026. **Somente sistema de candidatura Vonix Haircare Showcase**. Não misturar checkout, vendas e comissões.

## Por que existe
A campanha Meta já está direcionando pessoas ao formulário. O banco dedicado está acessível do servidor publicado e a criptografia foi comprovada, mas as credenciais do painel proprietário antigo (senha/TOTP) e a configuração do provedor de e-mail continuam pendentes. Esses serviços são independentes da capacidade de **armazenar** uma candidatura.

Uma nova tabela de controle privada permite que o responsável habilite *somente o recebimento* após aceitar a política específica do programa e comprovar as pré-condições técnicas, sem criar uma exceção permanente no código.

## Segurança da abertura

- `public.vonix_affiliate_operator_intake`: uma única linha, RLS ativa; `anon` e `authenticated` não podem ler nem escrever. Somente a chave privada do servidor pode ler, e o responsável com acesso administrativo ao Supabase pode alterar por SQL.
- `enabled=false` e `owner_acknowledged_at=NULL` por padrão. A interface só anuncia inscrições se a linha estiver habilitada e houver confirmação registrada.
- O servidor também exige: URL/chave do projeto dedicado corretas; migração de governança; criptografia do questionário; segredo HMAC mínimo; cabeçalho IP validado na Cloudflare; consulta read-only ao banco funcionando; RPC de rate limit respondendo. O endpoint de envio mantém validação Zod de cinco etapas, consentimento explícito, verificação de origem e consumo de quota antes da escrita.
- O fluxo continua aceitando candidatura mesmo que **o convite por e-mail falhe**; avisa que o armazenamento foi concluído e o envio do convite não foi confirmado. Nunca anuncia entrega não comprovada.
- O administrador tradicional continua exigindo senha + TOTP; a abertura de candidaturas **não cria uma conta administrativa ou privilégio novo**. Contas de equipe continuam sujeitas à confirmação do e-mail e à criação de senha pessoal.
- Toda resposta completa do questionário permanece criptografada, com projeto Supabase **separado do checkout**. Não se deve perder nem trocar `AFFILIATE_QUESTIONNAIRE_KEY`.

## Política de privacidade

Foi acrescentada seção específica sobre candidaturas à política pública da Vonix Hair, com categorias de dados, finalidade, seleção, compartilhamento necessário, limites de retenção e contato para direitos do titular. O formulário exige aceite explícito. A publicação do texto **não é parecer jurídico**; o controlador deve revisar a política e atender aos pedidos dos titulares.

## Controle do responsável

Após verificar o fluxo de ponta a ponta (envio fictício no site publicado → leitura do registro no banco → consulta de status → decisão), o responsável pode autorizar a coleta com esta instrução no **Supabase dedicado**, dentro de conta administrativa:

```sql
UPDATE public.vonix_affiliate_operator_intake
SET enabled=true, owner_acknowledged_at=now(), updated_at=now()
WHERE singleton=true;
```

Para **interromper imediatamente** o recebimento:

```sql
UPDATE public.vonix_affiliate_operator_intake
SET enabled=false, updated_at=now()
WHERE singleton=true;
```

Nenhum navegador público pode acionar o controle. O próprio status do formulário será fechado se o banco, limite de tentativas ou a criptografia falhar.

## Restrições que permanecem

Acesso de três revisores não pode ser presumido sem confirmação de e-mail; até a ativação, somente a conta administrativa do Supabase pode consultar registros via painel do provedor, sem abrir acesso a candidatos ou ao público. O dono deve configurar SMTP/URLs de redirecionamento, login da equipe, backup externo recuperável da chave de criptografia e manutenção da LGPD. Não é permitido declarar esses itens concluídos sem teste real.
