# Vonix Haircare Showcase — Workloop de consistência histórica e paginação

**Data:** 09/11/2026 (America/Sao_Paulo)
**Workloop:** `e8067435-0c89-41d9-91bc-60a7ae000dd5`
**Execução:** `fa79b71b-53fc-4ab6-89dc-a0afcdfd0440`

## Identidade, base e isolamento
- **Somente** inscrições de afiliadas, questionário de cinco etapas, resumo limitado de triagem e navegação administrativa.
- Repositório original `lucassilva1175/vonix-hair-care`; Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Worktree `C:\Users\JL\code\vonix-affiliate-workloop-data-consistency-20261109`; branch `feat/vonix-affiliate-data-consistency-20261109`.
- Base inicial `03df19a0507f48d9ae9384b56f8a41b77233989c`, PR #48.
- **Proibido neste ciclo:** ler `.env`/segredos, acessar registros reais ou banco persistente, ativar inscrições, enviar emails/avisos ou efetuar deploy; checkout, pagamentos, vendas, cupons operacionais, app separado de métricas, comissões, expedição e outras worktrees são de escopo separado.

## Defeitos reproduzidos com testes escritos antes do patch
1. O resumo administrativo de questionários previamente criptografados usava `affiliateWizardSchema` integral; a validação de idade atual fazia o resumo de uma candidatura legítima desaparecer após a candidata completar 101 anos, embora sua inscrição tivesse sido válida na data de submissão.
2. Ao aprovar a última inscrição pendente na página final, o painel voltava a buscar a mesma página; quando o total diminuía, o operador via lista vazia e não tinha paginação para retornar.
3. Ao excluir a última candidatura na página final, a mesma falha de paginação era reproduzida.

Os três testes sintéticos falharam na base antes da correção.

## Correções
- Resumo de ciphertext autenticado agora é uma **projeção limitada e explícita** somente dos campos de triagem não sensíveis: nicho, quantidade de seguidores, inscrição municipal sim/não, dependentes, linha preferida e sugestão de cupom. CPF, nascimento, telefone, e-mail e endereço **não** são enviados ao painel nem revalidados para gerar o resumo. Há limites de tipo/comprimento para a projeção.
- A validação completa das respostas continua obrigatória **na submissão inicial**; a mudança não relaxa a porta de entrada, apenas mantém resumos históricos legíveis mesmo após envelhecimento ou mudança de critérios de inscrição.
- Listagem administrativa calcula o índice máximo válido a partir do total verificado. Se uma consulta após aprovação/exclusão aponta para página que deixou de existir, recarrega a última página válida. A lógica de versão das consultas e descarte de resultados antigos permanece ativa.

## Evidências
- Testes de regressão falharam antes, passaram depois (43 testes focados em 2 arquivos), com TypeScript e lint dos arquivos modificados aprovados.
- **Validação local completa:** 274/274 testes em 32 arquivos, `npx tsc --noEmit`, ESLint dos quatro arquivos TS/TSX modificados, build Vite/Nitro e `git diff --check` com exit 0.
- **QA Chrome local:** resoluções 390 px e 1280 px, acesso administrativo com proteção de OTP, formulário público em prévia de cinco etapas, máscara de CPF, política de privacidade em outra aba, confirmação de descarte e cancelamento preservando rascunho. Zero erros JavaScript e zero requisições de gravação local.
- CI independente de PR e da `main` e sincronização do código Lovable ainda devem ser confirmados antes de declarar integração concluída.
- Dados usados nos testes são inteiramente fictícios. A parte privada do questionário só é processada localmente com chave de testes gerada no próprio teste; não usar candidatas nem bancos reais.

## Pendências para operação
- Conexão privada do Supabase dedicado `jewbzrbbvxyqmxqbrwrq` ao runtime Lovable não foi comprovada.
- LGPD, governança da aprovação de inscrições, proxy confiável, MFA operacional e backup/restauração ainda exigem homologação independente.
- `AFFILIATE_RECRUITMENT_OPEN` permanece ausente/desligado; nenhum envio real foi realizado.
