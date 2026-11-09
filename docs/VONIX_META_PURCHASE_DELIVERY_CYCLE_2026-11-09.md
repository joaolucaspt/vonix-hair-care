# Vonix Hair — CAPI Purchase com entrega registrada e proteção contra duplicatas

**Data:** 09/11/2026
**Repositório exclusivo:** `lucassilva1175/vonix-hair-care`
**Base de continuidade:** PR #26, commit `3256346cf95b6aec50a7a36dbb1a403b3e375b69` (já integra a `main` até `e6fb7ae`).
**Execução:** branch e worktree isoladas, sem Workloop, sem alterações em outros projetos, sem merge/deploy ou uso de credenciais reais.

## Por que a alteração foi necessária

O PR #26 já passou a registrar `Purchase` na Meta CAPI apenas após consulta autenticada à Appmax, com `event_id=purchase-ORDER_ID`. Entretanto, a fila de expedição consulta pedidos aprovados repetidamente enquanto espera `integrado`; por isso, a conversão poderia ser enviada novamente mesmo após sucesso.

O objetivo desta rodada é registrar de forma **persistente** se a conversão foi entregue, com trava de concorrência e confirmação protegida, sem depender da memória de uma única instância.

## Implementação

- `supabase/vonix-meta-purchase-delivery.sql`: tabela `vonix_meta_purchase_delivery` com `order_id`, `status`, `claim_token`, prazo de reserva, tentativas e instante de confirmação, **sem dados pessoais**.
- `vonix_claim_meta_purchase(order_id)`: cria uma única reserva atômica por pedido já inscrito no outbox local; bloqueia envios paralelos e repetição de eventos `sent`. A reserva expira em cinco minutos para recuperação após falhas.
- `vonix_ack_meta_purchase(order_id, token)`: confirma como `sent` **somente** se a mesma execução ainda mantém uma reserva válida. Uma execução antiga não pode confirmar a entrega de outra.
- `src/lib/meta-purchase-delivery.server.ts`: chamadas servidor→PostgREST com chave `service_role`, Zod estrito, validação de UUID/ID e prazo de rede.
- `src/lib/meta-capi.server.ts`: `sendVerifiedPurchase` só chama a Graph API após confirmação Appmax e snapshot local; agora também exige reserva persistente. Registra `sent` somente após resposta HTTP de sucesso e confirmação no banco. Se o evento já foi confirmado, devolve `skipped` sem emitir novo `Purchase`.
- O envio para Meta continua **best effort** e não interfere na expedição ou no tratamento de pagamentos reais.

## Migrações — somente após backup e homologação em staging

Aplicar no Supabase staging, nessa ordem:

1. `supabase/vonix-order-snapshots.sql`
2. `supabase/vonix-checkout-idempotency.sql`
3. `supabase/vonix-order-outbox.sql`
4. `supabase/vonix-bling-token-store.sql`
5. **`supabase/vonix-meta-purchase-delivery.sql` (nova)**

A nova tabela e as funções só podem ser acessadas por `service_role`; sem permissão para `anon` ou `authenticated`. Não inserir a chave service role no navegador, nos logs ou no código do repositório. Não habilitar migrações automáticas durante o build.

## Evidência real obtida nesta sessão

- **235/235 testes Vitest aprovados, em 36 arquivos**, sem chamadas de gateway reais.
- `tsc --noEmit`: PASS.
- `bun run build`: PASS, sem deploy.
- Migrações das cinco etapas executadas em **PGlite in-memory isolado**, sem tocar no Supabase operacional.
- Testes SQL: bloqueio de IDs sem pedido local, segunda reserva negada, ACK com token correto, evento definitivamente marcado como `sent`, reaquisição após vencimento da reserva, rejeição de ACK antigo e permissões de banco negadas aos perfis públicos.
- Testes unitários: `Purchase` só para status pago da Appmax, sem envio se já estiver marcado como entregue; falha do Graph não gera ACK; falha no banco não é falsamente tratada como sucesso.
- Nenhuma compra, anúncio, pagamento, webhook externo, banco de produção, serviço real ou credencial foi alterado nesta execução.

## Limitações e pendências que permanecem

**P0 — sem autorização de produção:** validar no sandbox da Appmax e Supabase staging, confirmar estados de pagamento, autenticação, concorrência real e contrato da Meta/Graph (resposta semântica, não apenas HTTP 2xx).

**P1 — confiabilidade e privacidade:**
- Se a Meta aceitar um evento, mas a confirmação no banco falhar, a próxima tentativa poderá reutilizar o mesmo `event_id`. Isso permite deduplicação na Meta, mas **não garante entrega exatamente uma vez** entre dois sistemas distribuídos.
- Se a expedição já estiver marcada como concluída, uma falha anterior de CAPI pode ficar sem nova tentativa automática. É necessário um job independente para revisar e recuperar entregas pendentes e vencidas, com limites e alerta administrativo.
- Auditoria de consentimento, base legal, minimização de dados, configurações de CAPI e retenção LGPD antes de enviar eventos em produção.
- Rate limiting compartilhado, estoques/pesos reais e demais pendências já listadas nos handoffs anteriores.

## Consulta administrativa de diagnóstico (somente leitura)

```sql
select status, count(*)::integer as total, min(updated_at) as mais_antigo
from public.vonix_meta_purchase_delivery
group by status
order by status;
```

Expor apenas agregados em painéis; não distribuir identificadores de pedidos ou tokens para visitantes.

## Preservação

O backup do PR anterior à integração, a `main` original e os trabalhos da aplicação de afiliadas permanecem independentes. Nenhuma mudança deste ciclo deve ser publicada diretamente. Avaliar em PR e mesclar somente após homologação dos bloqueios P0.
