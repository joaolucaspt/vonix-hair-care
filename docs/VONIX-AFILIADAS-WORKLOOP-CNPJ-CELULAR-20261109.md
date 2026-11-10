# Vonix Haircare Showcase — validação de identidade e contato (pós-PR51)

Data: 09/11/2026 (America/Sao_Paulo)
Workloop: `808d9e86-a1a3-4915-a8f4-e21e66a28e4b`
Run: `0df0d680-92f2-4e31-9713-a28ebd687135`

## Projeto e escopo isolado
- **Somente** inscrições de afiliadas de cinco etapas e triagem da Vonix Haircare Showcase.
- Repositório `lucassilva1175/vonix-hair-care`; editor Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Worktree exclusiva `C:\Users\JL\code\vonix-affiliate-workloop-consent-audit-20261109`; branch `feat/vonix-affiliate-consent-audit-20261109`.
- Base inicial `dd1fae0886424f40fdee7b522a072618604a1670` (PR #51).
- Nenhuma edição nas worktrees paralelas, no e-commerce, checkout, pagamentos, vendas, comissões, cupons operacionais, Expedição Fácil ou aplicativo independente de métricas. Não ler `.env`, banco operacional, segredos ou registros de candidatas; não ativar inscrições, notificações reais ou deploy.

## Problemas reproduzidos com regressões antes da alteração
1. `validCnpj` extraía dígitos antes de validá-los: um CNPJ com dígitos verificadores corretos, mas contendo letras e pontuação arbitrária, passava como documento válido. O campo do formulário não formatava o valor.
2. O campo celular conferia apenas uma sequência de 11 dígitos ou a máscara, aceitando DDD inexistente (`00`, `20`, `30`) e número local não iniciado em `9`, embora solicite explicitamente **celular** brasileiro.

## Alterações
- `validCnpj` primeiro exige a representação de 14 dígitos puros ou exatamente `00.000.000/0000-00`; somente depois confere os dígitos verificadores.
- Validação estrita de celular no schema da primeira etapa: DDD brasileiro da lista de códigos reais, nove dígitos locais iniciando com `9` e representação de 11 dígitos ou máscara `(DD) 9XXXX-XXXX`.
- Componente de CNPJ opcional com máscara progressiva, preservando validação no servidor e permitindo limpeza do campo sem manter dados sensíveis.
- Testes novos cobrem valores válidos e inválidos, máscara, associação dos avisos aos controles (`aria-invalid`) e bloqueio da navegação quando os dados são incorretos.

## Evidências e limites
- Dois testes de regressão falharam na base antes do patch; após correção, testes de esquema/componente passaram, junto com TypeScript e ESLint direcionado.
- **Suíte integral local:** 284/284 testes em 32 arquivos, `npx tsc --noEmit`, ESLint direcionado aos quatro arquivos TS/TSX alterados, build Vite/Nitro e `git diff --check`: todos com exit 0.
- **QA Chrome local:** larguras 390 px e 1280 px, formulário de cinco etapas somente em prévia, acesso OTP protegido, CPF mascarado, política em nova aba, proteção do rascunho ao cancelar descarte; zero erros JavaScript e zero requisições de gravação local.
- O CI independente do PR e da `main` ainda precisa ser confirmado após publicação da branch. O build local não comprova a publicação da versão no domínio.
- Dados usados são fictícios; não houve candidatura, e-mail ou gravação real.

## Pendências de operação
- Não há comprovação independente de credenciais privadas do Supabase dedicado no runtime do Lovable nem homologação LGPD, proxy, MFA, backup/restauração.
- `AFFILIATE_RECRUITMENT_OPEN` deve permanecer ausente ou desligado. Sincronização de código não equivale a deploy produtivo aprovado.
