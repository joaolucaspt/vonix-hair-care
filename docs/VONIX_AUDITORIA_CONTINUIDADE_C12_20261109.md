# Vonix Hair — auditoria C11–C12: horário de compra e recuperação financeira fiel

**Data:** 09/11/2026 · **Projeto exclusivo:** `C:\Users\JL\code\vonix-hair-care` · **PR:** #26 · **Base:** `d0e64db`.

## N48 — evento Meta Purchase poderia ser atribuído ao horário do worker

O Appmax `GET /v1/orders/{id}` pode confirmar o status pago sem retornar `data.payment.paid_at` (campo opcional no contrato de código). Antes, `sendVerifiedPurchase` enviava o evento sem `eventTime`, e `sendMetaEvent` usava `Date.now`. Isso podia registrar uma venda antiga como conversão recente.

**Correção:** o helper puro `src/lib/paid-event-time.ts` exige `paid_at` em ISO com fuso explícito, instante válido e dentro de até seis dias anteriores (tolerância de 60 segundos no futuro). O `Purchase` nunca usa o horário de recuperação como substituto. Falta de horário, horário local ambíguo, horário vencido e falsificação de horário futuro **não adquirem claim nem enviam à Meta**. Eventos comerciais de checkout/fulfillment não dependem de marketing.

**Importante:** confirmar no ambiente Appmax homologado se `payment.paid_at` está disponível no formato esperado. Se o provedor não entregar horário verificável, a opção conservadora é não registrar o evento opcional, **não inventar o instante**.

## N49 — recuperação Meta podia reconsultar continuamente pedidos sem data confiável

`recoverMetaPurchases` agora faz a verificação de `paid_at` antes de `sendVerifiedPurchase`. Se o campo estiver ausente, o worker adia a verificação por 60 minutos (pode chegar depois da confirmação). Se já contiver uma string não vazia, mas for inválida ou antiga, adia por 24 horas. O worker não divulga PII nem contabiliza esse caso como enviado; o estado de pagamento e a fila ERP não são alterados.

**Limite:** esse backoff ainda requer a SQL de recuperação em Supabase staging e revisão do comportamento real do Appmax.

## N50 — reconsulta de pedido idempotente podia mostrar um total novo como valor original

O fingerprint de deduplicação ignora intencionalmente cupom, método Pix/cartão e cotação de frete: o mesmo comprador, itens e destino não podem gerar uma segunda cobrança. Antes, o retorno de acompanhamento usava `totals.net + option.price` da **nova** cotação, que pode diferir do valor efetivamente enviado na tentativa inicial.

**Correção:** quando existe `intent.orderId` e a compra não pode ser reservada novamente, o backend carrega `loadOrderSnapshot(intent.orderId)`, verifica que o `orderId` corresponde, calcula o valor com `snapshotTotalCents` e retorna somente o total do pedido original. Se o snapshot estiver faltando, for inválido, tiver outro pedido ou apresentar valor zero/overflow, falha de forma conservadora com `retrySafe:false` e orientação para atendimento, **sem iniciar uma segunda cobrança nem mostrar preço inventado**.

O cálculo de centavos centralizado também é usado no CAPI, garantindo a mesma fonte do valor comercial.

## N51 — serialização defensiva de complemento opcional no snapshot

O `paySchema` preenche `complemento` ausente com string vazia na validação real, mas o mock de server function dos testes não aplicava defaults Zod. O snapshot agora usa explicitamente `data.address.complemento ?? ""` nos dois pontos de serialização. Os mocks testam snapshots completos e o valor final passa no `orderSnapshotSchema`. **Não há evidência de falha real em produção causada por esse default**; é robustez adicional e um teste de contrato.

## Evidências C11–C12

- **Vitest:** **495/495 PASS em 63 arquivos**, execução integral após as duas correções.
- **Testes direcionados:** 72/72 em cinco arquivos na etapa financeira, cobrindo `paid_at` ausente/ambíguo/antigo, deduplicação, meta consent, valor original, mudança de frete e método, snapshot indisponível/outro pedido e overflow.
- **TypeScript, lint direcionado, build Vite/Nitro:** exit 0.
- **SSR catálogo:** 42/42 páginas ativas; `plex-vonix` HTTP 404; disponibilidade física dos demais não comprovada.
- **Nenhum contato com Appmax, Meta, Bling ou Supabase reais**, nenhuma cobrança/pagamento, nenhuma alteração SQL, deploy ou merge da `main`. Não modificar arquivos do sistema separado de afiliadas.

## Pendências P0/P1 preservadas

Appmax sandbox (contrato de `payment.paid_at`, estados Pix/cartão/antifraude/timeout, reembolso), Supabase staging com backup/restore e migrações C5/C8, RLS e concorrência, Bling homologado e inventário/pesos/dimensões por SKU, LGPD com revogação tardia do Purchase, WAF/rate limit distribuído, propriedade GA4 e métricas reais de pedidos pagos versus sessões. Ver `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`. **CI verde não equivale à homologação operacional.**
