# Vonix Hair — proteção persistente contra cobrança duplicada

**Data:** 09/11/2026
**Escopo:** somente `lucassilva1175/vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26.
**Estado:** código e migração preparados; **nenhuma publicação, cobrança real ou banco operacional alterado**.

## Problema e correção

Antes, a trava `paymentInFlight` ficava restrita à aba. Duas abas, dispositivos ou retries após timeout podiam criar dois pedidos/cobranças antes da Appmax confirmar a primeira transação.

Agora `checkoutFingerprint` cria um HMAC-SHA256 **apenas no servidor** sobre CPF normalizado, destino essencial e SKUs/variantes + quantidades físicas do carrinho. **Não** inclui método Pix/cartão, cupom, preço, frete, e-mail ou dados do cartão — trocar a forma de pagamento, mudar cupom ou selecionar outro serviço de frete **não** desbloqueia uma segunda cobrança para a mesma compra.

A função `vonix_checkout_claim` utiliza `pg_advisory_xact_lock` com chave derivada da impressão digital da compra e um registro persistente. Só a primeira requisição obtém um `claim_token`; demais recebem o pedido já iniciado (quando existe) para **acompanhamento**, sem chamar os endpoints de pagamento. O token de posse **não** é enviado ao navegador.

Antes de `createCustomer` o servidor marca o estado `creating_order`. Depois de receber `orderId`, registra `order_created`; salva o snapshot de expedição e marca `charging` **antes** de pedir pagamento; ao confirmar a resposta, registra `submitted`. Cada avanço exige o token original e a fase esperada. Qualquer falha no armazenamento bloqueia novos efeitos externos.

Quando a resposta do gateway desaparece, a tela passa a consultar o mesmo `orderId`; para Pix, se o QR não puder ser recuperado, exibe pedido em verificação em vez de emitir outro. A API autenticada da Appmax, e não o evento do navegador, permite marcar `completed` ou `cancelled`. O worker de reconciliação confirma essas fases mesmo quando o cliente fecha a página.

## Arquivos

- `src/lib/checkout-idempotency.server.ts`: HMAC, RPCs, schema estrito e transições protegidas.
- `supabase/vonix-checkout-idempotency.sql`: tabela com RLS, claim atômico, transição com fencing e finalização.
- `src/lib/checkout.functions.ts`: reserva antes da Appmax, recuperação de resposta ambígua, token de status e bloqueio fail-closed.
- `src/lib/order-outbox.server.ts`: reconciliação das tentativas após confirmação autenticada.
- `src/test/checkout-idempotency.test.ts`, `src/test/checkout-security.test.ts`, `src/test/order-outbox.test.ts`: regressões e simulações sem pagamentos reais.

## Migrações necessárias — somente staging autorizado

Aplicar nesta ordem, após **backup verificado**, nunca automaticamente no deploy:

1. `supabase/vonix-order-snapshots.sql`
2. `supabase/vonix-checkout-idempotency.sql`
3. `supabase/vonix-order-outbox.sql`
4. `supabase/vonix-bling-token-store.sql`

Validar que `anon` e `authenticated` não podem consultar as tabelas nem executar RPCs de segurança. Somente `service_role` acessa o armazenamento. Não colocar a service role no navegador.

## Configuração exigida no servidor

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` do **ambiente homologado**.
- `CHECKOUT_IDEMPOTENCY_SECRET`: chave aleatória forte, com pelo menos **32 caracteres**, compartilhada pelas instâncias do backend.
- Credenciais **merchant** da Appmax, com `APPMAX_ENV=sandbox` durante homologação; `APPMAX_EXTERNAL_ID` para tokenização de cartão.

**ATENÇÃO:** mudar/rotacionar `CHECKOUT_IDEMPOTENCY_SECRET` enquanto há pedidos pendentes altera as impressões digitais e pode permitir a criação de uma segunda tentativa. Rotacionar apenas com checkout bloqueado, reconciliação concluída e migração aprovada.

Sem o segredo forte, os métodos Pix e cartão são apresentados como indisponíveis. Se faltar a migração/RPC, a operação falha **antes** de chamar a Appmax e deve direcionar o cliente ao suporte.

## Testes concretamente executados

- **214 testes aprovados (32 arquivos)** na suíte Vitest do repositório.
- TypeScript `tsc --noEmit`: PASS.
- Build `bun run build`: PASS na validação anterior à documentação.
- Banco de teste isolado: `@electric-sql/pglite@0.5.15` instalado somente em diretório temporário, in-memory. Quatro migrações SQL executadas: PASS. Testes de claim, bloqueio de duplicata, sequência de fases, recusa de claim antigo, cancelamento que libera retry, bloqueio de pedido concluído, webhook de pedido inexistente e privilégios de acesso: PASS.
- Nenhuma alteração foi aplicada em Supabase, Appmax, Bling ou outros serviços de produção.
- O ambiente PostgreSQL em memória **não substitui** testes de PostgREST, rede, concorrência entre instâncias e transações do gateway em staging.

## Operação e diagnóstico

O diagnóstico `POST /api/internal/order-health` continua somente leitura, protegido e sem dados de clientes. Para identificar tentativas antigas que exigem reconciliação humana, executar **apenas em staging/consulta administrativa autorizada**:

```sql
select phase, count(*)::integer as attempts,
       min(updated_at) as oldest
from public.vonix_checkout_intents
group by phase
order by phase;
```

Uma linha antiga em `creating_order` (sem `order_id`) pode significar que a Appmax recebeu a criação, mas a resposta se perdeu. **NÃO** liberar ou apagar essa tentativa sem conferir a transação no painel/API do merchant. Em `charging` ou `submitted`, confirmar pagamento/estorno com o mesmo cuidado.

O fluxo deliberadamente bloqueia comprar novamente o mesmo conjunto de produtos para o mesmo CPF/destino enquanto a tentativa estiver ambígua; após compra confirmada, permite repetir a mesma cesta **24 horas depois**. Uma compra nova com itens/destino diferentes usa outro fingerprint. Esse comportamento é conservador e merece validação comercial antes de produção.

## Bloqueios de produção que ainda não foram resolvidos

- Homologação Appmax sandbox ponta a ponta com Pix, cartão, antifraude, timeout e estorno, **sem** compras reais.
- SQL no Supabase staging, inclusive duas requisições simultâneas em processos distintos e perda de resposta após criação de pedido.
- Validação do contrato Bling para exportação fiscal/estoque e deduplicação em caso de perda de resposta.
- Ferramenta operacional segura de intervenção em pedidos órfãos, com auditoria e exigência de verificação externa.
- Rate limiting compartilhado por IP/CPF, gestão de segredos, política LGPD dos snapshots, monitoramento e alarmes.
- Estoque e dimensões por SKU, aprovação jurídica e métricas de compra deduplicadas.
- **PR #26 permanece sem merge; loja publicada e branch `main` não foram alteradas.**

Fontes oficiais: https://docs.appmax.com.br/guides/status-pedidos e https://docs.appmax.com.br/guides/webhooks.
