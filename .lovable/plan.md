# Auditoria somente leitura — segredos de afiliados

## Resultado (somente nomes, nenhum valor lido)

| Variável | Situação |
|---|---|
| AFFILIATE_SUPABASE_URL | ausente |
| AFFILIATE_SUPABASE_SERVICE_ROLE_KEY | ausente |
| AFFILIATE_SUPABASE_PROJECT_REF | ausente |
| AFFILIATE_QUESTIONNAIRE_KEY | ausente |
| AFFILIATE_ADMIN_SESSION_SECRET | ausente |
| AFFILIATE_ADMIN_PASSWORD | ausente |
| AFFILIATE_ADMIN_TOTP_SECRET | ausente |
| AFFILIATE_RECRUITMENT_OPEN | ausente |

Presentes hoje no projeto (relacionados): AFFILIATE_APP_URL, AFFILIATE_SITE_SECRET.
A lista de segredos do projeto é a mesma usada pelas funções do servidor na loja publicada; não há visibilidade separada por ambiente além dessa lista.

## Caminhos de configuração
- Segredos: Configurações do projeto → Secrets (o dono cola os valores).
- Supabase externo jewbzrbbvxyqmxqbrwrq: Configurações → General → External Supabase → Connect (login do dono no navegador).

## Bloqueios concretos
1. Conectar o Supabase existente: não consigo pelo chat; exige autorização OAuth do dono na tela acima.
2. Chave service role, senha admin, TOTP, chave do questionário: são credenciais de terceiros/do dono; só posso abrir o campo seguro para o dono colar — não posso obtê-las sozinho.
3. Valores fixos (URL https://jewbzrbbvxyqmxqbrwrq.supabase.co, PROJECT_REF jewbzrbbvxyqmxqbrwrq, RECRUITMENT_OPEN) e um SESSION_SECRET aleatório eu posso cadastrar depois de aprovado, sem ver/revelar valores.

## Próximo passo sugerido (só se aprovado)
Cadastrar os 3 valores fixos + gerar SESSION_SECRET, e abrir campo seguro para os 4 restantes. Sem código, sem banco novo, sem checkout, sem publicar.
