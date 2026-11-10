# Vonix Hair — compatibilidade com chaves privadas modernas do Supabase

Data: 10/11/2026. Apenas projeto de candidatas Vonix Haircare Showcase e seu banco Supabase dedicado `jewbzrbbvxyqmxqbrwrq`.

## Falha identificada e corrigida

O código anterior sempre enviava a variável privada `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY` em dois cabeçalhos: `apikey` e `Authorization: Bearer ...`.

A partir das chaves modernas `sb_secret_...`, **isso é incorreto**: a chave é opaca e não um JWT. Conforme documentação oficial atualizada do Supabase, chaves secretas e publicáveis devem ser enviadas em `apikey`, não em `Authorization: Bearer`. Essa configuração causaria falhas de API Auth/REST mesmo se a chave fosse cadastrada corretamente no Lovable.

Agora `affiliateDatabaseConfig()` usa:
- `sb_secret_...` no **cabeçalho apikey apenas**, estritamente no servidor; sem qualquer `Authorization` de chave opaca.
- `service_role` legada (JWT) continua com `apikey` e `Authorization: Bearer`, preservando compatibilidade.
- `sb_publishable_...` e demais `sb_...` desconhecidas são rejeitadas antes de liberar acesso privilegiado.
- O URL continua fixo ao projeto dedicado, HTTPS obrigatório; nunca reutilizar URL/chave do checkout.

Fonte: https://supabase.com/docs/guides/getting-started/api-keys — seção **Known limitations / Authorization headers**.

## Testes

Os testes novos garantem que a chave moderna não apareça no cabeçalho Bearer e que uma chave pública introduzida por engano seja recusada. Testes de credenciais antigas, fixação do projeto, prevenção de mistura com checkout, erros de URL e env continuam ativos.

O acesso real de produção permanece FECHADO até que o dono configure a chave secreta correta no cofre Lovable, prove conectividade, valide SMTP/OTP/backup/LGPD e faça uma candidatura fictícia completa pelo domínio público.

## Configuração pendente do dono

Copiar no painel privado do Supabase **somente do projeto `jewbzrbbvxyqmxqbrwrq`** uma Secret API key `sb_secret_...`. Abrir o gerenciamento privado de Secrets do projeto Lovable e cadastrar a chave em `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY`. Jamais colar em chat, GitHub, fonte, logs ou capturas de tela. Não habilitar `AFFILIATE_RECRUITMENT_OPEN=true` antes do teste real e das liberações legais e técnicas.
