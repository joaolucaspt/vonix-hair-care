# Vonix Hair — checkpoint crítico de afiliadas e liberação segura

Data: 10/11/2026. Projeto **Vonix Haircare Showcase** (repositório `lucassilva1175/vonix-hair-care`); não confundir com o e-commerce operacional, formulário isolado de outra worktree ou painel externo de comissões.

## Links oficiais
- Candidatura / landing: https://vonixhair.com/seja-afiliada
- Painel privado da seleção: https://vonixhair.com/admin/afiliadas
- Editor do projeto: https://lovable.dev/projects/203d2f84-1058-4ca4-acc3-41a4a5d4e2b5

## O que foi corrigido neste ciclo
- O rodapé da landing não coloca mais a logo em uma placa branca. A forma original da marca é aplicada como máscara dourada metálica sobre o fundo escuro, seguindo o padrão já usado no rodapé da loja.
- O painel tem consulta individual `Ver todas as respostas`: as informações completas do questionário criptografado são recuperadas somente após autenticação administrativa com senha/TOTP, validação de origem, limite de acesso por IP e solicitação deliberada por candidata.
- O servidor lê apenas um registro por identificador UUID válido, descarta colunas não solicitadas, autentica ciphertext AES-256-GCM e valida tipos/tamanhos antes de responder. Não expõe conteúdo de documentos na listagem pública nem no dashboard padrão.
- Respostas completas ficam apenas na memória da aba enquanto visíveis, são descartadas ao ocultar, sair, mudar filtros ou na expiração de sessão. Nenhum armazenamento local, exportação automática ou log de PII foi criado.
- Confirmação duplicada de e-mail e checkbox de termos não fazem parte do texto cifrado por design; o aceite possui data registrada no envelope cifrado. Os campos enviados do questionário são preservados e acessíveis conforme regras de retenção.
- Aprovação/recusa continua individual e com confirmação. A decisão persistida não é prova de entrega do e-mail (Resend opcional).

## Verificações e limitações importantes

Existe um projeto externo Supabase dedicado e ativo chamado `Vonix Hair Afiliadas` (não é o banco nativo do Lovable). A auditoria de metadados sem leitura de PII confirmou tabelas e a coluna `questionnaire_encrypted`, RLS ativado e ausência de SELECT/INSERT para `anon` e `authenticated` nessas tabelas. No horário consultado eram **zero candidaturas**.

**Isso não garante que o servidor publicado esteja conectado à instância.** A landing está deliberadamente em modo prévia enquanto a prontidão de produção não for comprovada. Os testes locais e CI com Postgres descartável comprovam o comportamento do código, não persistência ao vivo.

Não ativar `AFFILIATE_RECRUITMENT_OPEN=true` até confirmar de forma independente:
1. Credenciais de servidor para o Supabase dedicado, sem reutilizar chaves do checkout: `AFFILIATE_SUPABASE_URL`, `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY`, `AFFILIATE_SUPABASE_PROJECT_REF`.
2. Migrações de inscrições e governança aplicadas; RLS/grants; política de backup/restauração, capacidade, integridade e monitoramento verificadas.
3. `AFFILIATE_QUESTIONNAIRE_KEY` privada de 32 bytes, com backup seguro separado. **Perder essa chave pode tornar todas as respostas cifradas irrecuperáveis.** Não rotacioná-la sem migração planejada.
4. Login configurado: `AFFILIATE_ADMIN_PASSWORD` (mín. 16 caracteres), `AFFILIATE_ADMIN_SESSION_SECRET` (mín. 32), `AFFILIATE_ADMIN_TOTP_SECRET` (chave válida, cadastrada em um autenticador) — cada um diferente.
5. Rate limit/borda: `AFFILIATE_TRAFFIC_PEPPER`, `AFFILIATE_TRUSTED_IP_HEADER`, domínio HTTPS real e origem confiável.
6. Política LGPD e retenção aprovadas; responsável pelo tratamento definido. Somente depois atestar `AFFILIATE_GOVERNANCE_MIGRATED=true`, `AFFILIATE_PRIVACY_POLICY_APPROVED=true`, `AFFILIATE_PROVIDER_VERIFIED=true`.
7. Executar teste sintético isolado em homologação: submeter uma candidatura fictícia, confirmar persistência no banco, reabrir painel, ler o questionário integral, aprovar e recusar pessoas de teste diferentes, confirmar histórico e tratamento de duplicidade/queda de conexão.
8. Apenas após testar o fluxo no próprio domínio, liberar `AFFILIATE_RECRUITMENT_OPEN=true`. Checar resposta `getAffiliateRecruitmentStatus` e **não** presumir que preview seja inscrição real. As credenciais devem ser configuradas diretamente na hospedagem, jamais em chat/commit.

Resend e envio de e-mail são opcionais **para receber** candidaturas, mas precisam de configuração/homologação para enviar respostas automáticas. O app separado de métricas, cupons e comissões não foi alterado.

## Manual breve do painel
1. Acesse `/admin/afiliadas`; informe a senha administrativa e o código de seis dígitos do aplicativo autenticador previamente configurado.
2. Clique em **Verificar preparação**. Se banco ou governança aparecer como não confirmado, não abra o recebimento.
3. Nas abas **Pendentes**, **Aprovadas**, **Recusadas** e **Notificações**, use busca e paginação.
4. Em uma candidata, leia dados públicos e o resumo. Para consultar documento, telefone, endereço e demais campos, pressione **Ver todas as respostas**, confira e use **Ocultar respostas**.
5. Use **APROVAR** ou **RECUSAR** e confirme a decisão. Notificação `aceita pelo provedor` não prova entrega ao destinatário.
6. Use **Sair** após a sessão. Exclusão LGPD requer identificação da titular, confirmação do e-mail e motivo; não use exclusão como atalho de triagem.

## Parecer de campanha
Não afirmar que a campanha do Meta já pode captar inscrições enquanto a tela indicar **Inscrições em preparação** ou a autenticação/banco não estiverem homologados. Uma landing acessível não garante recebimento, persistência, backup nem leitura de novos cadastros. Nunca prometa 100% de entregas sem monitoramento e resposta explícita de confirmação.
