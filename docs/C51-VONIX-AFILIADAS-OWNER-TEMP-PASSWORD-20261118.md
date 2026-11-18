# Vonix Afiliadas — C51 — credenciais temporárias de administradores

Escopo **exclusivo**: sistema de candidaturas de afiliados, Supabase dedicado
`jewbzrbbvxyqmxqbrwrq`. Não altera checkout, pedidos ou e-commerce.

## Função
- Painel do proprietário autenticado: gerar uma credencial aleatória individual para
  as três contas administrativas preexistentes (Isabela, Giovana e Lucas).
- Usa Supabase Auth Admin UPDATE para o UUID já existente, nunca cria conta duplicada.
- A senha retorna somente uma vez ao proprietário, por resposta privada `no-store`.
  O servidor não registra, salva ou envia a senha por e-mail.
- O usuário deve trocar a senha antes de receber cookie administrativo.
- A interface apaga credenciais quando a aba fica oculta e após copiar.
- Se perder uma senha provisória ainda não alterada, o proprietário pode reemiti-la,
  respeitando a trava exclusiva de quatro minutos.
- A operação exige owner ativado, origem validada, allowlist de três e-mails e
  controle de tentativas. O titular de cada conta deve ser previamente validado
  pelo proprietário responsável.

## Banco de dados
Migrações registradas no Supabase dedicado:
1. `vonix_affiliate_owner_temporary_password_rotation_20261118`
2. `vonix_affiliate_secure_admin_temp_rotation_v2_20261118`
3. `vonix_affiliate_owner_only_temporary_provision_20261118`

As RPCs de reivindicação/conclusão do provisionamento foram verificadas com
EXECUTE=true apenas para service_role; anon e authenticated comuns=false.
A impressão digital da senha temporária permanece na tabela privada.
O login administrativo não é liberado enquanto `must_rotate_password=true`.

## Validações locais
- 708/708 testes em 74 arquivos aprovados.
- TypeScript, ESLint dos arquivos alterados e build de produção aprovados.
- Não foram criadas credenciais reais nos testes; Auth e REST foram simulados.

## Validação operacional obrigatória
Confirmar publicação do commit, verificar nova interface no domínio,
executar provisionamento via sessão owner real, verificar no banco que as
três contas existentes têm e-mail confirmado, senha, ativação e rotação
obrigatória. Não alegar conclusão até registrar essas evidências.

**Nunca incluir senhas em commits, logs, métricas, tickets ou documentação.**
