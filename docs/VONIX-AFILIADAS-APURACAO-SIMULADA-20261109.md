# Vonix Hair — laboratório de apuração de vendas de afiliadas

## Limite funcional e contexto

Este módulo avança o sistema **Vonix Hair** após o PR #32. Ele
**não** conecta a Appmax, credita comissões reais, emite cupons nem autoriza
pagamentos. Não interfere em rotas de checkout, pedidos, webhooks existentes
ou no catálogo da loja. O painel privado de candidatas inclui um simulador
interativo com dados **sintéticos e efêmeros**, sem chamadas de rede ou
armazenamento persistente. Nenhuma inscrição é aberta por este trabalho.

O porcentual inicialmente exibido é **10% apenas como cenário de demonstração**:
não é remuneração contratada, regulamentada nem prometida pela Vonix Hair.
O cálculo é realizado em centavos inteiros, com arredondamento de meio
centavo para cima, somente sobre um valor fictício de pedido.

## Regras determinísticas testadas

1. Cada pedido fictício é criado no estado `pendente` com código e valor
   positivo. Evento `pago` sem um pedido conhecido **não** gera crédito.
2. Apenas uma transição `pendente -> pago` gera comissão hipotética.
   Repetições de webhook ou pagamento são idempotentes.
3. Mudanças posteriores do código de indicação ou do valor original são
   rejeitadas; impedem substituição oportunista da afiliada.
4. `pago -> estornado` e `pago -> cancelado` encerram o crédito vigente.
   `pendente -> cancelado` nunca produz comissão nem reversão fictícia.
5. Um pedido cancelado/estornado não volta a `pago` sem novo processo
   formal de venda; não existem reativações implícitas.
6. A simulação local aceita no máximo 500 eventos e pedidos de até R$ 5 milhões
   para evitar entrada malformada e números imprecisos.
7. Não há dados de comprador, documentos, cartões ou conta bancária
   em exemplos, relatórios ou tabelas de simulação.

## Estrutura no PostgreSQL

`supabase/vonix-affiliate-sale-simulation.sql` adiciona duas tabelas
**exclusivamente para eventos de simulação**, sem conexões com a base
de pedidos real ou com candidaturas:
- `vonix_affiliate_sandbox_orders` — referência fictícia, valor inteiro,
  status e timestamps; sem regra de pagamento ou saldo.
- `vonix_affiliate_sandbox_events` — eventos sintéticos únicos e imutáveis
  para rastrear mudanças de estado.

RPCs `vonix_affiliate_sandbox_record` e
`vonix_affiliate_sandbox_report` requerem `service_role`; RLS ON e
nenhum `EXECUTE`/`SELECT`/`INSERT` para `anon` ou `authenticated`.
A RPC recusa eventos fora da ordem, reatribuição de referência, mudança
retroativa de valor e colisões de identificador. Os registros no banco
são apenas de testes simulados; o painel **não acessa essas RPCs**.

Na base dedicada **Vonix Hair Afiliadas**, referência
`jewbzrbbvxyqmxqbrwrq`, a migração foi aplicada como
`20261109184221 vonix_affiliate_sandbox_sales_ledger`.
A execução transacional do teste e a consulta de controle confirmaram
**zero pedidos e zero eventos persistidos**, RLS ativo e EXECUTE público
negado. A base de checkout da loja não foi modificada.

A prova de qualidade está em
`supabase/vonix-affiliate-sale-simulation-qa.sql`: executa dentro de
`BEGIN ... ROLLBACK`, sem persistência. O CI verifica a migração em
PostgreSQL descartável, rede desativada.

## Contrato necessário ANTES de registrar uma venda real

O servidor confiável deve confirmar o pagamento com a fonte Appmax
autenticada; o cliente nunca pode enviar livremente `pago`, `ref`,
preço ou porcentual. Os seguintes itens **ainda precisam ser definidos
e homologados pelo responsável comercial e jurídico**, antes de criar
um ledger financeiro real:

- Identidade única de cada afiliada aprovada, código/link/cupom associado
  e política de suspensão e fraude.
- Regras de atribuição por clique, cookie, sessão e cupom; prioridade entre
  os canais e período de atribuição; prevenção de pedidos de afiliadas
  não habilitadas e de autorreferência.
- Base elegível da comissão (ex.: produtos líquidos, exclusão de frete,
  descontos e tributos, devoluções parciais) e percentual aprovado.
- Reconciliação de webhooks reais com assinatura, retries, eventos fora de
  ordem, idempotência, reconciliação diária com Appmax e auditoria.
- Prazo de carência, chargebacks, estornos e saldo negativo; relatórios
  auditáveis e pagamentos apenas após validação tributária e bancária.
- Política LGPD de retenção, finalidade, identificação de titulares,
  acesso por usuário e processo de exclusão; definição de SLA e backup.
- Integração segura via credenciais privadas do servidor e tests em
  homologação com gateway sandbox; jamais liberar o envio com base
  em um evento criado no navegador.

**Não há ativação silenciosa**. A existência do schema sandbox não deve
ser interpretada como autorização para operar com dados reais.

Veja o checklist de produção em
`docs/VONIX-AFILIADAS-PRODUCAO-RUNBOOK.md` e a issue #28.
