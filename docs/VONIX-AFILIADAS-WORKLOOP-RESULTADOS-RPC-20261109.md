# Vonix Haircare Showcase — integridade do painel e das notificações

Data da execução: 09/11/2026 (America/Sao_Paulo).
Workloop: `c76b443b-a3e9-4084-baba-bbbfedb2dfc3`.
Run: `84a2c37d-0fe3-401f-a27b-1e5fc65ee3b8`.

## Identidade e isolamento
- **Somente** candidaturas e triagem de afiliadas Vonix Haircare Showcase; projeto Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Repositório `lucassilva1175/vonix-hair-care`, worktree exclusiva `C:\Users\JL\code\vonix-affiliate-workloop-integrity-20261109`, branch `feat/vonix-affiliate-integrity-workloop-20261109`.
- Base `origin/main` após PR #46: `cd9178433a47cc1c3539de0f6903af7b860ae381`.
- Preservadas as demais worktrees, o e-commerce/checkout operacional, as vendas, os pagamentos, o outro app de métricas, cupons operacionais e comissões. Sem ler `.env`, chaves, cadastros reais ou banco persistente. Sem registrar/avisar candidatas, deploy ou ativação de produção.

## Falhas demonstradas com testes que falhavam antes do patch
1. **RPC privada de busca:** o backend aceitava uma resposta com mais de 40 candidaturas para uma página limitada a 40. Também aceitava datas inválidas (`created_at`, `reviewed_at`) e as devolvia à interface.
2. **Resend (fila de notificações):** o backend considerava qualquer `id` de string não vazia como comprovante de aceitação, incluindo somente espaços, 2.048 caracteres e caracteres de controle. Isso podia registrar falsamente uma comunicação como enviada.

## Correções
- Validação de cardinalidade `applications.length <= 40` e datas ISO com offset antes de projetar campos da resposta privada. Preservada a proteção anterior contra vazamento de colunas extras e documentos pessoais.
- Retorno do provedor aceita apenas identificadores formatados com caracteres seguros e tamanho máximo de 128. Recibos inválidos ficam em estado de **resultado incerto**, com necessidade de reconciliação, sem tentar enviar novamente no mesmo ciclo.
- Teste positivo confirma que uma página de 40 candidatas com timestamp PostgreSQL de microssegundos e offset é aceita, evitando falsos bloqueios para formatos legítimos.

## Verificação e limites
- Todos os testes usam objetos fictícios e `fetch` simulado; nenhuma candidata ou mensagem real foi consultada ou enviada.
- Regressões falharam na versão anterior e passaram após correção; testes de backend `src/test/affiliate-system.test.ts` passaram. Teste positivo de página no limite de 40 registros com timestamp PostgreSQL de microssegundos e `+00:00` também passou.
- **Suíte integral local:** `265/265` testes em 32 arquivos; `npx tsc --noEmit`, ESLint direcionado aos arquivos TS alterados, `npm run build` e `git diff --check` com exit 0.
- **QA de interface Chrome:** fluxo de cinco etapas em 390px e 1280px, cadastro em prévia, controle OTP desabilitado até seis dígitos, aviso de rascunho, confirmação de descarte, documento de privacidade em outra aba. Zero erros JavaScript e zero chamadas de escrita ao host local.
- O lint global do repositório Windows já apresenta milhares de divergências CRLF/LF de Prettier em arquivos preexistentes; o lint **dos dois arquivos TS modificados** passou sem falhas. O CI Linux do GitHub é a verificação independente do conjunto.
- Registrar CI do PR e CI da `main` depois da integração; não declarar sucesso remoto até obter os dois jobs verdes.
- **Não ativar** `AFFILIATE_RECRUITMENT_OPEN`; conexão de segredos privados Supabase dedicado `jewbzrbbvxyqmxqbrwrq` no servidor Lovable ainda não foi homologada. Pendem LGPD, MFA, proxy confiável e backup/restauração.
