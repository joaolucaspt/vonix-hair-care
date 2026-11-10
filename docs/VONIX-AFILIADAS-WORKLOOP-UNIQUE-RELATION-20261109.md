# Vonix Afiliadas — Workloop de integridade de unicidade e notificação

**Data:** 09/11/2026, America/Sao_Paulo.
**Workloop:** `d21b259e-3b00-42e3-909d-fcf64dad309e`
**Execução:** `723f71e2-ee30-42de-ae50-4ad778f4a476`

## Identidade e limites
- Trabalhar exclusivamente em inscrições e seleção de afiliadas da Vonix Haircare Showcase, repositório `lucassilva1175/vonix-hair-care`, projeto Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Base `0dc0dd8eeed6dbb13e3249a56a65df1caf11d9cf` substituída em sequência pela base PR #50 `96296d42ba4c382ec485091139c182726997a60a`.
- Branch isolada `feat/vonix-affiliate-privacy-review-cycle51-20261109` em `C:\Users\JL\code\vonix-affiliate-workloop-review-safety-20261109`.
- Nenhum acesso a dados reais, arquivos `.env`, segredos, candidatas, DB persistente, pagamentos, cupons operacionais, métricas de vendas, expedição ou e-commerce. Manter inscrições fechadas e não disparar mensagens reais ou deploy.

## Falhas reproduzidas antes do patch
1. O backend tratava todo HTTP 409 com SQLSTATE `23505` como candidatura duplicada recebida. Porém, o esquema da tabela possui restrições exclusivas tanto em **e-mail** como em **Instagram** e **TikTok**. Uma pessoa com e-mail novo e perfil social conflitante recebia falso sucesso mesmo sem persistência.
2. A resposta privada da RPC de triagem aceitava múltiplos elementos na relação de notificação por candidatura, em desacordo com a unicidade `application_id` da outbox, e aceitava timestamps `sent_at` inválidos. O frontend poderia renderizar informação inconsistente.

## Correção
- A resposta pública silenciosa de duplicidade exige não só `23505`, mas a identificação exata da restrição `vonix_affiliate_applications_email_key` no retorno PostgreSQL/PostgREST. Conflitos de índice Instagram/TikTok, mensagens ausentes ou nomes similares falham de forma genérica. Nenhum texto SQL é transmitido à candidata.
- A relação `vonix_affiliate_mail_outbox` retornada pela busca privada deve ter no máximo uma linha, com `sent_at` nulo ou ISO com offset; aceita timestamps de microssegundos típicos do PostgreSQL.
- Validações anteriores de PII, limite de 40 inscrições por página, origem e rate limit permanecem em vigor.

## Evidências
- Regressões sintéticas foram escritas primeiro e falharam no código original da base PR #50.
- Após o patch, testes focados de `affiliate-system.test.ts`: 38/38 aprovados.
- **Suíte integral local:** 280/280 testes em 32 arquivos, `npx tsc --noEmit`, ESLint dos dois arquivos alterados, build Vite/Nitro e `git diff --check` com exit 0.
- **Chrome local:** larguras 390px e 1280px, formulário de cinco etapas somente em prévia, OTP da área privada, CPF mascarado, política em nova aba, confirmação e cancelamento de descarte, zero erros JS e zero requisições de escrita.
- CI do PR e da `main` devem ser verificados independentemente antes de considerar o código integrado.
- Nenhuma resposta SQL real, solicitação de candidatura real ou envio de e-mail foi realizado; todos os retornos PostgREST são mocks.

## Pendências de produção
- A configuração privada do Supabase dedicado no runtime Lovable continua sem comprovação independente.
- LGPD, consentimento/retenção, proxy confiável, MFA operacional e backup/restauração exigem validação humana.
- `AFFILIATE_RECRUITMENT_OPEN` permanece desabilitado. Código mesclado não é prova de publicação do build no domínio.
