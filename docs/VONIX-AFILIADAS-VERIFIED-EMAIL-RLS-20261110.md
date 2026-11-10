# Vonix Hair — autorização por e-mail confirmado no portal de candidaturas

Data: 10/11/2026. Somente sistema de candidatas **Vonix Haircare Showcase**, repositório `lucassilva1175/vonix-hair-care` e Supabase dedicado `jewbzrbbvxyqmxqbrwrq`. Não houve operação de vendas, alteração de checkout, comissões ou dados de clientes da loja.

## Falha corrigida

As políticas `affiliate_portal_select_verified_email` e `affiliate_admin_own_invite` antes comparavam o e-mail do registro ao campo `email` do JWT Supabase. Embora a plataforma faça verificações de conta, um JWT não é fonte ideal para atestar a situação atual da confirmação de e-mail ou mudanças posteriores.

As políticas agora permitem leitura somente se `auth.uid()` apontar para uma identidade real em `auth.users`, cujo e-mail atual corresponda ao registro solicitado **e** `email_confirmed_at` não seja nulo. O lookup fica em função `SECURITY DEFINER` com `search_path` vazio em esquema privado `vonix_affiliate_private`, que NÃO está exposto pelo Data API. O papel `authenticated` pode executar apenas a verificação e não recebe `SELECT` direto em `auth.users`.

## Implementação e reprodução

- Migração aplicada no Supabase como `vonix_affiliate_verified_auth_email_rls_20261110`; fonte em `supabase/vonix-affiliate-verified-email-rls.sql`.
- `supabase/vonix-affiliate-auth-qa-scaffold.sql` monta somente a API mínima fictícia de Auth no banco descartável do CI; NUNCA aplicar em produção.
- `supabase/vonix-affiliate-verified-email-rls-qa.sql` cria dois usuários fictícios (um confirmado, outro não confirmado), candidatos e convites fictícios. Confirma nenhum acesso por conta inexistente/não confirmada, acesso a exatamente um registro para a identidade confirmada e impossibilidade de trocar de registro apenas alterando a alegação de e-mail no JWT.
- O CI executa essa prova em PostgreSQL isolado sem rede, após os testes anteriores. Não expõe dados reais nem acessa o Supabase de produção.

## Verificação real no Supabase

Uma transação de teste com candidatura e convite descartáveis foi executada no banco real com um `auth.uid` fictício e e-mail igual ao alegado pelo JWT; as duas tabelas retornaram **0 registros**. O servidor confirmou que a identidade fictícia não tem e-mail validado; a transação foi revertida. Não persistiram candidaturas de teste.

## Dependências operacionais que NÃO foram liberadas

- A hospedagem Lovable ainda precisa da variável privada `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY` ligada somente ao banco `jewbzrbbvxyqmxqbrwrq`. Não colar em chat, código, logs ou frontend.
- Configuração efetiva de SMTP, redirect URLs do Auth e login pessoal dos três administradores ainda não foi homologada; dois usuários Auth não confirmados foram criados, terceiro convite bloqueado por limite de e-mails.
- Comprovação de origem confiável do IP, senha/TOTP do responsável, política LGPD, concordância da operação e backup da chave cifrada são bloqueios independentes.
- **A captação continua deliberadamente fechada** (`AFFILIATE_RECRUITMENT_OPEN=false`). Um HTTP 200 no site ou tela de prévia não comprova uma candidatura gravada; é necessário teste completo formulário publicado → banco → painel → portal antes de tráfego pago.
