# Vonix Hair — recuperação de pedidos e prevenção de dupla cobrança

**Projeto exclusivo:** `lucassilva1175/vonix-hair-care` · branch `fix/vonix-ecommerce-auditoria-2026-11-09`.
**Escopo:** evolução do PR #26, sem merge, sem deploy, sem segredos reais, sem banco operacional nem pagamentos reais.

## Motivo desta rodada

A Appmax tenta entregar webhooks até quatro vezes; depois pode descartá-los definitivamente. O status oficial `autorizado` ainda aguarda análise antifraude. O cliente não deve ser estimulado a repetir cobrança enquanto o gateway estiver em estado desconhecido.

Referências: [webhooks](https://docs.appmax.com.br/guides/webhooks) · [status de pedidos](https://docs.appmax.com.br/guides/status-pedidos).

## Implementado no código

1. **Reconciliação após perda de webhook:** nova RPC `vonix_reconcile_order_outbox` busca apenas pedidos criados pelo checkout (snapshots), com pelo menos dois minutos, até 90 dias, que nunca entraram na fila. Limite de 20 por chamada. Não reinicia pedidos já completados nem atropela o atraso de tentativas pendentes.
2. **Vínculo do webhook com o checkout:** `vonix_enqueue_order` agora só aceita ID que tenha snapshot local. Payload recebido nunca autoriza pagamento nem envio; o worker continua consultando a Appmax autenticada.
3. **Estorno e chargeback após exportação:** evento posterior de reversão em pedido `completed` marca `review_required`, com tipo de evento e instante. Não reabre a fila e **não faz estorno automático**.
4. **Eventos oficiais adicionados:** `order_pending_integration` e `order_refused_by_risk`, além dos já processados.
5. **Endpoints externos limitados por tempo:** autorização da Appmax/Bling (8 segundos) e chamadas autenticadas (10 segundos), evitando travar indefinidamente uma execução da fila.
6. **Corpo de webhook protegido:** leitura com limite de 16 KiB de bytes UTF-8 e prazo de 1 segundo. Retorna erro recuperável para corpo lento e 413 para grande, sem carregar payload sem limite na memória.
7. **Cartão com antifraude:** se a Appmax retorna `autorizado`, o comprador vê `Pagamento em análise`, não uma recomendação de tentar outro cartão. O checkout consulta o status periodicamente e só registra `purchase` e limpa o carrinho após confirmação de pagamento.
8. **Confirmação incerta após tentativa de cartão:** falha de rede no envio ou na consulta subsequente preserva `orderId` e exibe acompanhamento, em vez de afirmar recusa. **Isso não substitui idempotência durável do envio de cartão**, pendência prioritária.
9. **Telemetria de compra:** proteção local contra registrar o evento `purchase` mais de uma vez pela mesma montagem da tela.
10. **Continuidade de cartão/Pix na mesma aba:** a sessão preserva exclusivamente o identificador, o token de consulta de status e dados do QR Pix, sem guardar número de cartão, CPF nem endereço. Após recarregar, o checkout retoma o mesmo pagamento pendente, sem gerar nova cobrança. O registro expira em 24 horas e é apagado após confirmação ou reinício explícito do Pix.
11. **Nova tentativa após decisão final:** estados finais de recusa/cancelamento liberam um botão explícito para reiniciar o checkout; pagamentos ainda em análise não oferecem essa opção.
12. **Proteção contra callbacks duplicados:** uma trava síncrona na aba impede que duas respostas de tokenização enviem duas chamadas de pagamento simultâneas. Isso **não é idempotência persistente entre abas/dispositivos**.
13. **Testes simulados:** novos cenários de perda de webhook, notificação de estorno, limite de corpo, tempo de API, antifraude, aprovação posterior, persistência de sessão e callbacks repetidos, sem chamadas de pagamento real.

## Validações obtidas nesta sessão

- **187/187 testes** aprovados em **30 arquivos**, incluindo webhooks, reconciliação, estado antifraude, confirmação assíncrona do cartão e limites de entrada.
- **TypeScript:** `tsc --noEmit` aprovado.
- **Build:** `bun run build` aprovado, sem publicação.
- **ESLint funcional (sem regra Prettier):** 0 erros e 0 avisos nos arquivos desta rodada. Foram estabilizadas as dependências dos efeitos de evento `begin_checkout` e cotação de frete, sem gerar rastreamento duplicado.
- **Navegador de teste:** fluxo produto → checkout conferido em **390 × 844** e **1366 × 768**; cartão antes do CTA, sem rolagem horizontal ou exceções JavaScript. Os botões de cobrança ficaram desabilitados por ausência de credenciais na prévia local.
- **Sem homologação real:** SQL ainda não foi executado em PostgreSQL staging e nenhum pagamento/ERP autenticado foi chamado.
- **Continuidade após atualização:** `src/lib/pending-card.ts` e `src/lib/pending-pix.ts` armazenam somente ID, token restrito à consulta de status, total e dados de pagamento/QR Pix na `sessionStorage` por até 24 h; nunca número de cartão, CPF ou endereço. A tela restaura o pedido sem abrir uma segunda cobrança. A nova tentativa de cartão só aparece após um estado terminal confirmado pela API autenticada da Appmax. O Pix expirado não gera outro QR até a API confirmar o cancelamento do pedido anterior, com testes de restauração, expiração e callbacks duplicados. O token e o QR devem ser tratados como dados do pedido, acessíveis apenas na sessão da aba.

## Migração SQL — SOMENTE em staging autorizado

O arquivo `supabase/vonix-order-outbox.sql` atualiza a tabela de fila com sinalizadores `review_required`, `review_event`, `review_marked_at`, modifica a RPC `vonix_enqueue_order` e cria `vonix_reconcile_order_outbox`.

**Pré-requisito:** `supabase/vonix-order-snapshots.sql` deve estar aplicado antes, pois as funções consultam `public.vonix_order_snapshots`. As credenciais do banco e da Appmax não ficam no código cliente. Recomenda-se backup, revisão de permissões, transação e teste PostgreSQL isolado antes de produção.

Exemplo de diagnóstico **somente leitura**, com credencial administrativa apropriada:

```sql
select order_id, status, attempts, review_event, review_marked_at
from public.vonix_order_outbox
where review_required = true
order by review_marked_at desc
limit 100;
```

Esse resultado não contém dados pessoais do comprador. A revisão operacional deve consultar o pedido autorizado e seguir o processo de atendimento/reembolso apropriado; não executar mudanças automáticas.

## Pendências críticas que continuam abertas

- Validar o contrato real do Bling (filtro `numerosLojas[]`, criação de pedido, deduplicação e status), usando staging e fixtures homologadas.
- Testar o ciclo real Appmax: Pix, cartão, antifraude, timeout, estorno, reembolso, reversões e cobrança ambígua.
- Implantar migrações, configurar segredos e scheduler autorizado **antes** de habilitar o novo fluxo.
- Implementar idempotência durável na **criação da cobrança**, não apenas na exportação ao ERP. A proteção da sessão do navegador e contra duplo clique não é suficiente contra dois dispositivos ou perda total da resposta.
- Definir política de retenção dos snapshots com CPF, endereço e contato, acessos administrativos e conformidade LGPD.
- Rate limiting compartilhado nos endpoints de checkout; inventário real; pesos/dimensões das embalagens; GA4/Meta Purchase de servidor com deduplicação; relatórios e revisão jurídica.
- O limite de webhook de 16 KiB precisa ser conferido contra um evento real de carrinho grande antes de produção.

**Não executar merge/publicação até homologação.** O rollback do PR #26 continua amparado pela `main` original e pelo backup independente no GitHub.
