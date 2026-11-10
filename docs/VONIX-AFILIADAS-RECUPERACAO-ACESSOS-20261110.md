# Vonix Hair Afiliadas — recuperação de acesso por convite administrativo

Data: 10/11/2026. Apenas `lucassilva1175/vonix-hair-care` e sistema de candidaturas; nenhum código de checkout, pedidos, pagamentos ou comissões foi alterado.

## Problema atendido

A inscrição armazenada continua válida mesmo que o serviço de e-mails falhe ao enviar um convite de acompanhamento. Antes deste ciclo, faltava ao painel um caminho explícito para **tentar novamente** o convite sem obrigar a candidata a repetir as cinco etapas.

## Implementação

- Nova ação protegida `resendAffiliateApplicantInvite` em `src/lib/affiliate-functions.ts`.
- Exige origem igual à do site, sessão administrativa válida e consumo da cota de limite de requisições. Não abre cadastro público nem altera a decisão da candidata.
- O navegador envia exclusivamente o **UUID da candidatura**. O backend consulta o e-mail no registro persistido via uma consulta privilegiada com `select=id,email`, sem buscar CPF, endereço ou questionário criptografado. Não aceita e-mail livre em uma ação de reenvio.
- O convite é emitido pelo Supabase Auth privado por `invitePersistedAffiliateApplicant`; **resposta HTTP aceita não significa entrega confirmada**.
- A equipe pode abrir a confirmação em candidaturas **pendentes, aprovadas e recusadas**, porque a página de acompanhamento permanece acessível após a decisão.
- A operação exige segundo clique explícito para enviar. Permite cancelar sem chamar o provedor e mostra mensagens específicas de sucesso da solicitação, rejeição do provedor ou falha de conexão.
- Respostas que chegarem depois do logout não restauram dados pessoais ou notificações no painel.
- Quando a conta de Auth já existe e o Supabase recusar outro convite, a equipe deve orientar a pessoa a usar `https://vonixhair.com/acompanhar-inscricao` para pedir código ao e-mail da candidatura.

## Qualidade

- **321/321 testes em 37 arquivos** aprovados em Vitest.
- Casos novos: e-mail consultado exclusivamente pelo UUID existente, ID inexistente/divergente, duas confirmações antes do convite, cancelamento sem envio, rejeição do provedor sem mensagem de entrega e resultado atrasado após logout.
- TypeScript, lint e build de produção executados sem erros no ambiente isolado.
- Não foram enviados e-mails reais nem foram criadas candidaturas reais.

## Bloqueios operacionais

A disponibilidade dessa recuperação no painel **depende** de:
1. Variável privada `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY` configurada no cofre da hospedagem e vinculada somente ao banco de afiliadas `jewbzrbbvxyqmxqbrwrq`.
2. Proxy/IP validado e `AFFILIATE_TRUSTED_IP_HEADER` corretamente configurado para a limitação segura de requisições.
3. SMTP/URLs de redirecionamento do Supabase Auth homologados, com verificação de e-mail pelo destinatário.
4. Administradores que passaram pela verificação do e-mail e criaram senha pessoal (ou proprietário com senha + TOTP configurados).
5. Aprovação de privacidade/LGPD, backup seguro da chave de criptografia e teste fim a fim no domínio público antes de abrir `AFFILIATE_RECRUITMENT_OPEN`.

**O formulário público deve continuar fechado enquanto qualquer dependência de segurança e persistência permanecer pendente.**
