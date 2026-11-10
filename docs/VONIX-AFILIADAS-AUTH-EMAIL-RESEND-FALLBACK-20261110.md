# Vonix Hair — contingência de códigos de acesso por e-mail

Data: 10/11/2026. Somente sistema de inscrições/seleção de afiliadas (`lucassilva1175/vonix-hair-care`), banco dedicado `jewbzrbbvxyqmxqbrwrq`.

## Diagnóstico de produção

O formulário público de cinco etapas foi publicado e estava aberto. O Supabase confirmou **uma candidatura pendente**, com questionário cifrado e status de acompanhamento persistido; porém não havia identidade Auth vinculada ao e-mail dessa candidatura. As respostas não foram perdidas. O serviço SMTP padrão do Supabase não entrega códigos livremente para emails fora dos membros da organização, limita a 2 mensagens por hora e **não é adequado à produção**. Consulte https://supabase.com/docs/guides/auth/auth-smtp.

## Alteração aplicada ao código

Quando o servidor possui `RESEND_API_KEY` e `AFFILIATE_FROM_EMAIL` válidos no cofre da hospedagem:
- Somente o backend gera código via `POST /auth/v1/admin/generate_link` da instância Auth dedicada.
- O código numérico é enviado por `POST https://api.resend.com/emails`, sem jamais ser retornado ao navegador ou registrado em log. O provedor deve estar ativo e o domínio remetente verificado.
- O link de autenticação gerado é validado contra a origem exata do Supabase e NÃO é enviado diretamente; a pessoa digita o código na página Vonix e a verificação continua no Supabase. Isso preserva autenticação por e-mail apesar da limitação do SMTP padrão.
- Para candidatas, confirma existência de candidatura no banco antes de gerar identidade. Para equipe, confirma que o e-mail está na lista autorizada. A resposta pública não revela se um endereço consta ou não da lista.
- Exige origem oficial, limite distribuído de tentativas por IP, e limite atômico de **120 segundos por endereço** identificado somente por HMAC (não texto do e-mail). Migração `vonix_affiliate_auth_mail_cooldown_20261110`, RLS e grants somente ao service_role.
- Ao salvar candidatura nova ou duplicidade de e-mail comprovada, o convite pode usar esse serviço imediatamente. Pessoas que já se candidataram podem solicitar novo código no portal sem refazer as cinco etapas. Pessoas da equipe podem solicitar na página de acesso.
- Na ausência das duas variáveis de Resend, preservado o fluxo padrão de OTP do Supabase. **Isso NÃO elimina a necessidade de configurar SMTP, Auth Hook ou Resend real.** Código novo não cria conta sem provedores ativos.

## Segurança e privacidade

Não tocar no checkout, comissões, clientes da loja, e-commerce operacional nem outros projetos. Não acessar/registrar segredos, e-mails reais de candidatas ou o questionário em testes. Não marcar e-mails como confirmados artificialmente, não criar senhas temporárias frágeis e não desbloquear o painel sem verificação. O código de autenticação deve expirar normalmente segundo a política do Supabase.

## Validação

- 342/342 testes Vitest em 40 arquivos; TypeScript, ESLint dos arquivos alterados e build Nitro/Vite aprovados.
- Testes incluem autorização da candidatura antes do código, e-mail de equipe somente convidado, resposta indistinguível para e-mail inexistente, proteção de origem, bloqueio por IP, cooldown de destinatário, rejeição de link para origem errada e nenhuma exposição de token na mensagem.
- A migração aplicou, e teste transacional confirmou primeiro pedido permitido, segundo bloqueado, com rollback e zero resíduos.

## Pendências antes de declarar o e-mail funcionando

1. Verificar presença de `RESEND_API_KEY` e `AFFILIATE_FROM_EMAIL` no Lovable; configurar via painel privado se faltarem.
2. Confirmar domínio remetente, limites da conta, e-mail de destinatário e resultado da requisição real; HTTP 200 da Resend não comprova recebimento da mensagem.
3. Solicitar um código no próprio site para uma candidatura existente e verificar identidade + acompanhamento. **Não reenvie a inscrição**, ela já está gravada.
4. Os quatro e-mails administrativos foram configurados com papel `owner` no banco, mas a ativação individual (e-mail confirmado, senha própria) é obrigatória. Sem uma entrega real não existe sessão administrativa pronta.
5. O painel provisório no Supabase continua disponível enquanto o login é homologado: https://supabase.com/dashboard/project/jewbzrbbvxyqmxqbrwrq/explorer/notebook/2f5b403c-8d69-438e-aecc-ae809b27298f.
