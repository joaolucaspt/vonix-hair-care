# Vonix Hair — monitoramento seguro de pedidos (continuidade PR #26)

**Data:** 09/11/2026. **Escopo único:** `lucassilva1175/vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`.

## Entrega

Esta etapa preserva as alterações anteriores de segurança de pagamento, integrações, reconciliação, recuperação de Pix/cartão e backups. Implementa um **diagnóstico operacional agregado**, somente leitura, para a fila Appmax → Bling.

- `supabase/vonix-order-outbox.sql` adiciona a função `vonix_order_health_summary()`. Retorna apenas contadores; sem pedido individual, cliente, CPF, endereço ou credenciais.
- `src/lib/order-health.server.ts` acessa a função com a chave `service_role` apenas no servidor e valida o resultado por esquema estrito.
- `src/routes/api.internal.order-health.ts` expõe `POST /api/internal/order-health` protegido por `Authorization: Bearer <ORDER_MONITOR_SECRET>` (mínimo 32 caracteres); segredo separado do scheduler.
- `src/test/order-health.test.ts` verifica acesso negado, segredo fraco, conteúdo sem dados sensíveis e falhas seguras sem vazamento de erros.
- O checkout só habilita **cartão** quando possui também `APPMAX_EXTERNAL_ID` e a configuração de servidor exigida; Pix é controlado separadamente. A tela mostra como comprar pelo atendimento quando o método não está pronto.

## Campos do diagnóstico

`pending`, `leased`, `completed`, `awaitingReview`, `readyToRetry`, `expiredLeases`, `multipleAttempts`, `completedLast24h`, `oldestPendingMinutes`.

Estes são **contadores técnicos** e não indicadores de receita ou conversão. Um pagamento em análise pode permanecer pendente sem ser erro de negócio. `awaitingReview` sinaliza reversões posteriores à exportação e requer atuação humana.

## Como homologar sem liberar vendas

1. Criar um backup de um PostgreSQL **staging** autorizado, isolado da loja em produção.
2. Aplicar em staging, na ordem, `vonix-order-snapshots.sql`, `vonix-order-outbox.sql` e `vonix-bling-token-store.sql`.
3. Verificar que os perfis `anon` e `authenticated` **não** possuem `EXECUTE` na função de diagnóstico, e que as tabelas de snapshots/credenciais não podem ser lidas pelo navegador.
4. Configurar em staging `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e um `ORDER_MONITOR_SECRET` forte em armazenamento seguro do host (não no GitHub e não em código cliente).
5. Enviar um POST autenticado por ferramenta administrativa, sem expor o cabeçalho em logs, navegador público, conversas ou screenshots. Confirmar que a saída contém **somente os nove campos acima**.
6. Testar pedidos pendentes, exportação concluída, tentativas repetidas e reversão de pagamento usando cenários simulados.
7. Manter migrações, scheduler e pagamentos reais desativados até homologação com Appmax e Bling.

## Evidência da sessão

- **195/195 testes PASS** (31 arquivos), incluindo testes de monitoramento e meios de pagamento.
- TypeScript `tsc --noEmit`: PASS.
- Build `bun run build`: PASS.
- ESLint funcional focado (sem regra Prettier): PASS, zero erros nos arquivos modificados.
- Git `diff --check`: PASS.
- **Não executado**: testes de função SQL em Postgres real/staging, chamadas autenticadas à Appmax/Bling, deploy, migração em produção, leitura de segredos.
- Docker local consultado apenas para verificar disponibilidade; daemon não estava ativo, sem containers criados.

## Pendências de prioridade máxima

- Homologação do fluxo completo Appmax → snapshots Supabase → outbox → Bling com pedidos de sandbox.
- Idempotência durável **na criação da cobrança** entre abas/dispositivos e após perda de resposta do gateway.
- Automação protegida do worker, alertas por limiar e painel operacional de revisão humana.
- Estoque e peso/dimensões reais dos produtos; preço e aprovação fiscal, consentimento de dados, política de retenção LGPD.
- Reconciliação de comissões de afiliadas por fluxo autenticado/confirmado, sem confiar em reaberturas de tela.
- Nenhum histórico ou commit de trabalho sobre LEVORA, Stefany Rifas, EV+ ou LeadPage Studio deve ser alterado.

**Publicação:** proibida nesta etapa. PR #26 permanece em revisão; `main` e o ponto de backup não foram alterados.
