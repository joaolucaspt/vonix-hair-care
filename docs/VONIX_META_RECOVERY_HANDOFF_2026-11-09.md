# Vonix Hair — recuperação independente de conversões pagas na Meta

Data: 09/11/2026
Projeto exclusivo: `lucassilva1175/vonix-hair-care`, PR #26.
Base verificada: commit `f402c1db7ba5738084048f370d397e47df4cf718`.

## Falha que esta etapa corrige

O worker principal de pedidos era capaz de registrar `Purchase` quando a Appmax confirmava pagamento. Mas, se a exportação do pedido fosse concluída no Bling enquanto a Meta estivesse indisponível, o pedido saía da fila operacional e **a conversão não tinha um mecanismo separado de recuperação**.

A nova rotina não depende mais da fila ainda estar pendente e não interfere com pagamentos ou expedição. Ela **só envia `Purchase` após consultar novamente o pedido pela API autenticada da Appmax**, verificar a condição de pago, localizar o snapshot local e obter uma reserva exclusiva na tabela de entregas da Meta.

## Implementação nesta rodada

- `supabase/vonix-meta-purchase-delivery.sql`: ampliação da migração com `next_check_at`, índice de pendências, RPC de candidatos recuperáveis e RPC de adiamento. Recuperação limitada a cinco IDs por consulta, pedidos entre 2 minutos e 6 dias após criação no outbox. Eventos já entregues ou com lease ativo ficam excluídos.
- `src/lib/meta-purchase-delivery.server.ts`: RPCs tipadas e validadas com Zod, `service_role` somente no servidor, timeout e rejeição de IDs duplicados.
- `src/lib/meta-purchase-recovery.server.ts`: rotina serial, em lotes pequenos. Consulta o status real via Appmax e encaminha os pagamentos aprovados a `sendVerifiedPurchase`. Adia pedidos em análise por 60 minutos e cancelados por 24 horas. Falhas usam novo intervalo de 15 minutos; não bloqueiam os demais pedidos.
- `src/routes/api.internal.meta-recovery.ts`: endpoint `POST /api/internal/meta-recovery`, protegido por `META_RECOVERY_SECRET` com no mínimo 32 caracteres, distinto do segredo usado pelo worker do Bling. Resposta restrita a contadores `checked/sent/skipped/deferred/failed`, sem CPF, nome, endereço, ID individual ou tokens.
- `src/lib/meta-capi.server.ts`: respostas HTTP 200 só são tratadas como entregues quando o JSON da Meta informa `events_received: 1`. Quando a Appmax fornece `payment.paid_at` ISO com fuso horário, usa o horário real da aprovação; pagamentos declarados há mais de seis dias não são falsamente classificados como vendas de hoje. O `event_id` continua `purchase-ORDER_ID` para deduplicação com o Pixel.

## Como homologar e depois operar

A ordem das migrações de staging, com backup, continua sendo:

1. `supabase/vonix-order-snapshots.sql`
2. `supabase/vonix-checkout-idempotency.sql`
3. `supabase/vonix-order-outbox.sql`
4. `supabase/vonix-bling-token-store.sql`
5. `supabase/vonix-meta-purchase-delivery.sql` (versão atualizada)

Todas as migrações devem ser aplicadas num Supabase **staging** autorizado e com dados fictícios, antes de qualquer deploy.

É necessário configurar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, credenciais da Appmax no sandbox e o token `META_CAPI_TOKEN` apenas no servidor de staging. Criar um segredo novo e forte para `META_RECOVERY_SECRET`. Não expor o segredo em URLs, ferramentas públicas, repositório ou navegador.

O endpoint está pronto para ser chamado por um agendador administrativo. **Nenhum agendador foi ativado nesta sessão**. Só configurar execução recorrente após aprovação da infraestrutura, testes integrados e controles de observabilidade/privacidade. O processamento do Bling não depende deste endpoint.

## Evidências de segurança e confiabilidade

- Testes com dependências simuladas: candidatos pagáveis, em análise, cancelados, erros de Appmax/Meta, checagem de ID devolvido, falhas isoladas por pedido, segredo ausente, retorno estritamente agregado e reenvios bloqueados.
- SQL testado em `@electric-sql/pglite` **in-memory**, sem banco persistente nem credenciais. Foram executadas as cinco migrações; a RPC respeitou limite, janela de idade, exclusão de lease ativo, adiamento, exclusão de envio concluído e permissões negadas a `anon`/`authenticated`.
- Reaplicação da última migração preservou os registros do teste.
- A resposta HTTP 200 da Graph API sem `events_received:1` não gera ACK da entrega; eventos antigos com `paid_at` inequívoco não são reatribuídos ao momento atual.
- Verificações automatizadas locais e GitHub Actions registradas no PR antes de qualquer merge.
- Não foram realizados pagamentos, reembolsos, acesso a segredos reais, consultas a dados de clientes, modificações em outros projetos ou deploy.

## Limitações importantes

- Um evento recebido pela Meta não significa conversão atribuída ou contabilizada: a atribuição exige validação no Events Manager e testes de consentimento/deduplicação.
- Um ACK perdido após Meta aceitar o evento pode causar nova tentativa com o mesmo `event_id`. Deduplicação auxilia, mas não fornece transação distribuída exatamente-uma-vez.
- Se Appmax não devolver `paid_at` com fuso, o horário do envio ainda é usado como aproximação. Este contrato deve ser homologado com a API da Appmax antes da ativação.
- Pedidos criados há mais de seis dias ficam fora da reconciliação automática, para não enviar conversões históricas como se fossem novas. Reconciliação financeira e de Bling permanece separada.
- O worker está desenvolvido mas **não está agendado**; é necessário configurar seu disparo recorrente, monitoramento e acesso seguro.
- P0: Appmax sandbox, Supabase staging/PostgREST, concorrência em processos distintos, Bling com dados fictícios, revisão de segurança/consentimento e dados reais de embalagem/estoque.
- Nenhuma mudança foi mesclada na `main` ou publicada neste ciclo.

## Diagnóstico administrativo de exemplo (somente staging autorizado)

```sql
select status, count(*)::integer as total,
       min(next_check_at) as proxima_verificacao
from public.vonix_meta_purchase_delivery
group by status
order by status;
```

### Reversão

Backup anterior ao merge da política de frete: `backup/vonix-pr26-before-free-shipping-merge-20261109`. Este ciclo deve receber novo commit na branch de revisão, sempre com `main` e os backups preservados.
