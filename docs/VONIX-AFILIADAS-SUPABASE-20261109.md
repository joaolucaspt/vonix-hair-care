# Vonix Hair Afiliadas — provisionamento Supabase (09/11/2026)

Esta base pertence **somente ao módulo de candidaturas/seleção de afiliadas**, sem
alteração das credenciais, do checkout, dos pagamentos ou de qualquer outro projeto.

## Projeto provisionado
- Organização: **Vonix Hair Cosméticos** (`yxldidqrbwctlftthpvm`).
- Projeto: **Vonix Hair Afiliadas**.
- Referência pública do projeto: `jewbzrbbvxyqmxqbrwrq`.
- Painel: https://supabase.com/dashboard/project/jewbzrbbvxyqmxqbrwrq
- Região: São Paulo, `sa-east-1`.
- Custo cotado no momento da criação: **US$ 0/mês**, plano Free.
  Os limites, disponibilidade e eventuais atualizações de plano devem ser
  acompanhados no painel Supabase; não significa SLA de produção ou backup garantido.

## Migrações aplicadas (no projeto dedicado)

| Versão Supabase | Migração | Estado |
| --- | --- | --- |
| `20261109174019` | `vonix_affiliate_applications_initial` | Aplicada, sucesso |
| `20261109174032` | `vonix_affiliate_governance` | Aplicada, sucesso |
| `20261109174201` | `vonix_affiliate_audit_fk_index` | Aplicada, sucesso |

A terceira migração é apenas o índice da FK `audit_events.application_id`.
A declaração idempotente correspondente foi incorporada a
`supabase/vonix-affiliate-governance.sql` para instalações novas.

## Verificações diretamente na base recém-criada

- **Quatro tabelas:** candidaturas, fila de e-mails, limites de acesso e auditoria.
- **Todas com RLS ligado**, nenhuma com política pública; acesso direto de
  `anon` e `authenticated` às tabelas negado de propósito.
- **Onze funções internas:** nenhum `EXECUTE` público, todas `SECURITY INVOKER`.
  O `service_role` do servidor detém os acessos necessários.
- Consultas reais de estatísticas, paginação, limite de IP e prévia de retenção: sucesso.
- Teste sintético no projeto com `BEGIN ... SET LOCAL ROLE service_role ... ROLLBACK`:
  aprovação, enfileiramento único, trilha de decisão, negação de exclusão com e-mail
  incorreto, exclusão confirmada e prévia de retenção: sucesso.
- Conferência após rollback: **0 candidaturas, 0 e-mails, 0 limites, 0 auditorias**.
- Security Advisor: quatro avisos informativos de `RLS Enabled No Policy`.
  **Intencionais**: nenhum usuário cliente deve ler ou escrever diretamente na base.
- Performance Advisor: índice FK da auditoria faltante foi criado. Avisos de índices
  não utilizados em uma base sem registros não significam necessidade de remoção.

## BLOQUEIOS PARA RECEBER DADOS REAIS

**A existência do Supabase e de suas tabelas não conecta automaticamente o site.**
O projeto Lovable da loja pode utilizar backend e configurações diferentes.
Jamais inserir a `service_role` ou segredos no frontend, em links públicos ou no Git.

1. Configurar **somente nos segredos do servidor hospedeiro** as variáveis
   `AFFILIATE_SUPABASE_URL`, `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY` e `AFFILIATE_SUPABASE_PROJECT_REF`,
   obtidas no painel do projeto dedicado (ref público `jewbzrbbvxyqmxqbrwrq`). Não substituir credenciais do checkout. O backend nega URLs divergentes ou idênticas à do checkout.
2. Configurar também MFA, sessão, pepper, cabeçalho de proxy confiável e
   `AFFILIATE_QUESTIONNAIRE_KEY` privada de 32 bytes. Manter a chave criptográfica
   em backup separado para evitar perda irrecuperável dos questionários.
3. Revisar e aprovar formalmente a política de privacidade, controlador,
   base legal, minimização de documentos, canal de contato e retenção LGPD.
4. Verificar o remetente Resend, credenciais, domínio, agendador do worker,
   falhas de entrega, antiabuso e monitoramento. Não fazer envios reais ainda.
5. Homologar **todo o fluxo no ambiente de hospedagem** com dados sintéticos,
   RLS, rate-limit, TOTP, decisão, envio de teste autorizado e exclusão.
6. Somente após as evidências, declarar no servidor
   `AFFILIATE_GOVERNANCE_MIGRATED=true`,
   `AFFILIATE_PRIVACY_POLICY_APPROVED=true`,
   `AFFILIATE_PROVIDER_VERIFIED=true` e por **último**
   `AFFILIATE_RECRUITMENT_OPEN=true`.

Nenhum desses segredos ou atestados foi definido pelo provisionamento;
**as inscrições continuam fechadas**. A proposta de cupom do formulário
não emite cupons nem implementa cálculo/pagamento de comissões.

Ver também `docs/VONIX-AFILIADAS-PRODUCAO-RUNBOOK.md` e
https://github.com/lucassilva1175/vonix-hair-care/issues/28.
