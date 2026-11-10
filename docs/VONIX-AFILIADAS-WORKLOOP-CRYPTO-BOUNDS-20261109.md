# Vonix Haircare Showcase — Workloop de validação criptográfica e limites da triagem

Data: 09/11/2026 (America/Sao_Paulo). Workloop `b8ab599f-e851-4388-b603-bb551a11ea35`, execução `cb48d69d-63e9-40ef-877a-aeec580fa05a`.

## Identidade e isolamento
- Trabalho restrito ao cadastro em cinco etapas e à triagem administrativa de afiliadas Vonix Haircare Showcase.
- Repositório original `lucassilva1175/vonix-hair-care`; Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Worktree exclusiva `C:\Users\JL\code\vonix-affiliate-workloop-safe-transport-20261109`; branch `feat/vonix-affiliate-safe-transport-20261109`.
- Base `0dc0dd8eeed6dbb13e3249a56a65df1caf11d9cf` (PR #49).
- Nada de checkout, pagamentos, cupons operacionais, comissões, expedição ou app separado de métricas. Não ler `.env`, segredos ou registros reais; não ativar cadastro/avisos, enviar e-mail nem fazer deploy.

## Defeitos demonstrados com testes antes do patch
1. O decodificador Node de base64url aceita caracteres adicionais (`!!`, espaços, padding) e sequências não canônicas, inclusive com bits de preenchimento alterados, decodificando os mesmos 32 bytes e declarando uma chave malformada como pronta. O servidor validava apenas o comprimento do Buffer; teste com chave sintética falhou.
2. O script de prontidão aceitava qualquer base64url com 43 caracteres do alfabeto permitido, sem checar codificação canônica, permitindo falso positivo em chave com bits finais inválidos. Teste sintético falhou.
3. A RPC privada de listagem aceitava `questionnaire_encrypted` com string de tamanho arbitrário. O resumo podia tentar decodificá-la, abrindo espaço para consumo excessivo de memória ou respostas malformadas. Teste com ciphertext fictício de 40.003 caracteres falhou antes da correção.

## Implementação
- Servidor e script verificam 64 caracteres hexadecimais ou exatamente 43 caracteres base64url **canônicos** que decodificam em 32 bytes e reencodificam para a mesma sequência. Variantes não canônicas são rejeitadas de forma fechada.
- Limite explícito de **32.768 caracteres** para `questionnaire_encrypted` antes da projeção de respostas de RPC e também na função de resumo criptográfico. Questionários normais são significativamente menores, de acordo com as restrições do formulário.
- O resumo continua sem expor documentos, data de nascimento, endereço e telefone; novas inscrições continuam sendo validadas antes da criptografia.

## Evidências e critérios de aceite
- Testes escritos antes da correção; três falharam na base. Após correção, 57 testes focados em 3 arquivos passaram, além de TypeScript e lint direcionado.
- **Suíte integral local:** 277/277 testes em 32 arquivos, `npx tsc --noEmit`, ESLint direcionado aos cinco arquivos TS modificados, `npm run build` e `git diff --check`: EXIT 0.
- **Chrome local:** larguras 390 px e 1280 px, formulário de cinco etapas em prévia, OTP protegido no painel, CPF mascarado, política em nova aba, rascunho preservado ao cancelar descarte; zero erros JavaScript e zero requisições de gravação local.
- CI independente de PR e da `main` ainda deve ficar verde antes de declarar integração.
- Ausência de credencial real e de banco operacional não deve ser confundida com conexão de produção do Lovable ao Supabase dedicado `jewbzrbbvxyqmxqbrwrq`.

## Bloqueios preservados
- Configuração privada do Supabase dedicado no runtime Lovable, migrações/backup/restauração, LGPD, proxy e MFA operacional não comprovados.
- `AFFILIATE_RECRUITMENT_OPEN` permanece desabilitado. Nenhuma candidatura ou e-mail real foi enviado.
