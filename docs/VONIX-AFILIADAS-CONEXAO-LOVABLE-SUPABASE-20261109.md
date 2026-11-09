# Vonix Hair Afiliadas — conexão dedicada Supabase/Lovable (09/11/2026)

## Identidade e isolamento
- Aplicação: Vonix Haircare Showcase no Lovable, projeto 203d2f84-1058-4ca4-acc3-41a4a5d4e2b5.
- Banco AUTORIZADO para candidaturas: Supabase "Vonix Hair Afiliadas", ref jewbzrbbvxyqmxqbrwrq, região sa-east-1.
- URL não sigilosa: https://jewbzrbbvxyqmxqbrwrq.supabase.co.
- Supabase próprio registrado ACTIVE_HEALTHY; banco nativo Lovable desabilitado.
- NÃO alterar nem substituir SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY usados no checkout.
- NÃO habilitar AFFILIATE_RECRUITMENT_OPEN nem envios reais até homologação.

## Evidência de diagnóstico somente leitura
- Tabelas presentes (todas com RLS): vonix_affiliate_applications, throttles, mail_outbox, audit_events, sandbox_orders e sandbox_events; todas estavam vazias no momento da verificação.
- Migrações presentes: 20261109174019, 20261109174032, 20261109174201, 20261109184221.
- RPCs de candidaturas e governança presentes: stats, search, decide, erase, retention_preview, claim_mail, finish_mail, consume_rate_limit e rate_limit_allowed.
- O role anon e o authenticated não possuem EXECUTE nessas RPCs; service_role possui, como previsto no fluxo server-only.
- Aviso do security advisor: RLS ativado, sem políticas explícitas. Para tabelas exclusivamente de servidor isso representa bloqueio de acesso direto para outros roles, não autorização pública.
- Nenhuma leitura de dados de candidatas, chave privada, e-mail operacional ou banco de checkout.

## Integração segura prevista
1. No projeto Lovable correto, Settings → General → External Supabase permite vincular uma organização e escolher projeto existente. O dono/admin do workspace precisa autorizar a organização pelo fluxo OAuth. Esse vínculo é de projeto inteiro, não apenas do módulo.
2. CUIDADO: a loja já usa credenciais SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Não conectar o projeto inteiro sem confirmar que Lovable preservará esses valores e o checkout; se houver risco, preferir os segredos separados abaixo.
3. No gerenciador de segredos **somente do servidor Lovable**, definir os três valores **obrigatórios**: AFFILIATE_SUPABASE_URL com a URL acima; AFFILIATE_SUPABASE_SERVICE_ROLE_KEY com a chave privilegiada exclusiva desse projeto; AFFILIATE_SUPABASE_PROJECT_REF com jewbzrbbvxyqmxqbrwrq. Nunca compartilhar chaves em chat, código ou logs. O backend recusa o cadastro se o identificador não corresponder ao hostname, estiver ausente ou se a URL coincidir com SUPABASE_URL do checkout.
4. Não usar publishable/anon key no lugar da service_role: as RPCs são privadas. Não copiar chave do checkout. Manter AFFILIATE_RECRUITMENT_OPEN ausente/false.
5. Somente após conexão, executar node scripts/check-affiliate-readiness.mjs em ambiente autorizado, verificar acesso de servidor às RPCs sem dados reais e validar proxy, backups, autenticação, criptografia e LGPD antes de habilitar inscrições.

## Estado e bloqueio constatados nesta sessão
- A extensão Supabase está autenticada neste ChatGPT e confirmou o projeto, mas isso NÃO conecta a execução do Lovable automaticamente.
- A chamada de agente ao projeto Lovable foi rejeitada porque o workspace estava sem créditos. Não foram criados segredos ou links OAuth.
- A interface Lovable também não confirmou uma ligação externa; portanto a conexão Supabase→runtime Lovable permanece NÃO VERIFICADA.
- A checagem obrigatória AFFILIATE_SUPABASE_PROJECT_REF foi adicionada ao código para impedir usar outro hostname e, ainda, impedir usar a URL de checkout. Sem o ref válido e a chave dedicada, o cadastro fica fechado.
- Documentação oficial: https://docs.lovable.dev/integrations/supabase.

Este documento comprova auditoria de metadados do banco e preparação do código; não afirma implantação ou recepção de candidaturas reais.
