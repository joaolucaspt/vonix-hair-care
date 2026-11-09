# Sistema de inscrição de afiliadas — checkpoint UX/segurança (09/11/2026)

Projeto exclusivo: Vonix Haircare Showcase, repositório lucassilva1175/vonix-hair-care.
Worktree isolada: C:\Users\JL\code\vonix-affiliate-form-validation.
Base: PR #37 de consistência do formulário já integrada à main; alterações seguintes restritas ao módulo de candidaturas.
Não confundir com Vonix Expedição Fácil, outros aplicativos ou funcionalidades de métricas/comissões.

## Alterações verificadas nesta continuação
- Idade legal de 18 anos calculada pelo calendário de São Paulo; horários UTC próximos da virada de data não antecipam maioridade.
- Formulário público de cinco etapas: resumo final editável com informações de triagem, sem repetir CPF, CNPJ, telefone, endereço completo ou data de nascimento.
- Gestão administrativa: aprovar/recusar exige confirmação separada; cancelar não modifica a candidatura nem chama a API.
- Troca de filtros, expiração de sessão e logout descartam confirmação pendente; testes preservam proteção contra respostas tardias.
- Alterações confinadas ao código do formulário, à validação, à tela administrativa e aos testes.
- Fluxo existente de banco dedicado, criptografia AES-256-GCM, sessão TOTP, rate limit, decisão atômica e fila idempotente permanece intacto.

## Evidências locais
- Vitest focado: 26/26 testes, 3 arquivos.
- Suíte integral: 201/201 testes, 28 arquivos, exit code 0.
- npx tsc --noEmit: exit code 0.
- ESLint focado nos seis arquivos alterados: exit code 0.
- npm run build: exit code 0.
- git diff --check: exit code 0.
- Testes usam exclusivamente dados sintéticos; nenhuma inscrição, exclusão, decisão ou notificação real foi executada.
- O build não representa homologação de ambiente nem prova entrega de e-mails.

## Portões que permanecem fechados
- AFFILIATE_RECRUITMENT_OPEN permanece false por padrão: publicação de código NÃO abre inscrições.
- Conexão do Supabase dedicado à hospedagem Lovable ainda não foi confirmada nesta sessão.
- Não foram acessados segredos de produção, banco real, serviços de e-mail ou dados de candidatas.
- LGPD, autenticador/admin por funcionário, restauração de backup, proxy confiável, HTTPS e teste fim a fim em staging exigem validação operacional antes da liberação.
- Não incluir vendas, comissões, cupons operacionais ou métricas: o proprietário possui aplicativo separado.

Este checkpoint comprova qualidade local dos ajustes, não prontidão para recolher documentos pessoais em produção.
