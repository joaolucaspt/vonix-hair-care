# Vonix Hair — integridade da identidade do pedido Appmax e confirmação de exportação no Bling

**Data:** 09/11/2026
**Escopo exclusivo:** e-commerce `lucassilva1175/vonix-hair-care`, PR #26; não se aplica ao aplicativo de afiliadas/expedição nem a projetos de outros clientes.
**Ponto de partida:** commit `39deace5045c32b135823a6bb16eaea47838a983`.
**Backup GitHub antes desta mudança:** `backup/vonix-pr26-before-appmax-order-validation-20261109`.

## Contexto e falhas encontradas

1. O `getOrder(orderId)` da Appmax aceitava como retorno uma resposta HTTP 200 sem verificar se `data.order.id` era idêntico a `orderId`. Assim, o processador poderia avaliar o status de outro pedido enquanto tratava uma venda local, o que não é uma autorização válida para exportação.
2. `sendPaidOrder` consultava a API do Bling com filtro de `numeroLoja`. Se a API retornasse uma lista de pedidos que incluísse apenas referências diferentes, o código concluía que a venda ainda não existia e executava o POST. Uma consulta de duplicidade que ignora ou interpreta mal o filtro não pode ser usada para decidir enviar novamente.
3. O retorno do POST de criação no Bling era considerado sucesso só por HTTP 2xx, mesmo quando não trazia `data.id`. Em caso de resposta incompleta, a outbox poderia ser marcada como concluída sem comprovação da criação.

## Correções implementadas

- `src/lib/appmax.server.ts`: `assertAppmaxOrder` valida o ID solicitado, a identidade do pedido retornado e o status não vazio e legível; `getOrder` rejeita ID inválido antes da chamada de rede e usa essa validação antes de devolver uma resposta ao restante do sistema. Uma resposta inconsistente falha **sem converter outro pedido em venda confirmada**.
- `src/lib/order-outbox.server.ts`: camada adicional confere a identidade/status antes de finalizar a tentativa de checkout, encaminhar eventos Meta ou exportar ao Bling. Em caso de inconsistência, a tentativa volta à fila com atraso; nenhuma venda é criada no ERP.
- `src/lib/bling.server.ts`: se uma consulta explicitamente filtrada por referência da loja trouxer apenas pedidos diferentes, o sistema falha de forma conservadora, sem realizar POST. Após o POST de criação, exige um ID numérico inteiro positivo confirmado pela API para considerar a exportação concluída.
- **Retentativas:** uma resposta ambígua após o POST não significa que a operação não ocorreu. O próximo ciclo consulta primeiro `numeroLoja`; se o pedido já existir, é tratado como enviado sem nova criação.
- Novos testes isolados cobrem IDs diferentes, payload sem status, valores malformados, resposta filtrada com pedido de outra referência, POST 200 sem `data.id` e recuperação após resposta ambígua.

## O que não foi feito

- Nenhuma compra, pagamento Pix/cartão, exportação real ao Bling, atualização de banco de dados de clientes, publicação ou deploy.
- Nenhum segredo, arquivo `.env` ou token de produção foi aberto.
- Nenhuma mudança na `main` original ou em projetos de afiliadas/expedição.

## Validações e riscos remanescentes

**Testes simulados não homologam o contrato real da Appmax nem do Bling.** Antes de publicar o PR:

- Homologar em **Appmax sandbox** os formatos de `data.order.id`, `status`, autorização, aprovação, cancelamento e retorno incompleto. Se o ID for representado de outra maneira oficialmente, adaptar **somente após comprovar o contrato**.
- Testar o filtro de número da loja e os retornos de criação da **API Bling v3** usando pedidos fictícios em conta de homologação, especialmente busca vazia, retorno de outro pedido, consulta lenta e POST cuja resposta se perdeu.
- Validar as migrações no **Supabase staging** e jobs em múltiplos processos, inclusive recebimento de webhook repetido e timeout depois do POST Bling.
- Revisar manualmente pedidos que fiquem pendentes por inconsistência de resposta; não criar pedidos duplicados para contornar o bloqueio.
- Manter validações de peso e tamanho de cada SKU, estoque real, gestão de consentimento LGPD e reconciliação financeira.

## Rollback

Este ciclo é reversível por novo PR sobre a branch do backup, sem reset ou reescrita do histórico. A aplicação principal e os dados operacionais permanecem como estavam.

**Arquivos da mudança:** `src/lib/appmax.server.ts`, `src/lib/order-outbox.server.ts`, `src/lib/bling.server.ts`, `src/test/appmax-order-integrity.test.ts`, `src/test/order-outbox.test.ts`, `src/test/bling-mapping.test.ts` e este relatório.
