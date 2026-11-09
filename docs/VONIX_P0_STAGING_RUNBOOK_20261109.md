# Vonix Hair — roteiro de homologação operacional P0/P1 (sem produção)

**Escopo:** e-commerce Vonix Hair, PR #26. O sistema de afiliadas não faz parte deste roteiro. A automação não deve tocar contas reais, segredos, pedidos, estoque nem banco de produção.

**Condição atual:** a auditoria de código e os testes sintéticos avançaram até C5. O CI verde valida o software testado, **não** a operação com provedores reais. Nenhuma aprovação para merge ou deploy decorre deste documento.

## Portas P0 que ainda exigem ambiente homologado

| Porta | Evidência concreta necessária | Critério de aprovação |
| --- | --- | --- |
| Supabase de staging | Projeto isolado, snapshot/restore testado, migrações aplicadas em ordem, RLS por perfis, funções com permissões mínimas | Sem acesso a PII por roles públicas; worker e checkout passam; rollback documentado |
| Appmax sandbox — Pix | Pedido fictício e respostas aprovado/pendente/cancelado/expirado; perda de resposta e falha do provedor em cada etapa | Nenhum duplo pagamento; comprador recupera estado e entende próxima ação |
| Appmax sandbox — cartão | Tokenização segura, recusa, 3DS/antifraude se aplicável, timeout da confirmação e status autenticado | Não armazenar PAN/CVV; não declarar pago antes de confirmação; sem duplicar cobrança |
| Bling homologado | SKU, variação, valor, peso/dimensão, estoque e número da loja; pedido de teste e reenvio idempotente | Exportação fiel 1:1; repetição após timeout não cria pedido duplicado; conciliação funciona |
| Logística | CEPs válidos de várias regiões e CEP sem cobertura, prazos, opções gratuitas, dimensões reais | Frete não inventa preço, prazo nem cobertura; totais finais coincidem com o provedor |
| Estoque | Listagem de estoque reconciliada por **SKU e variante** com data e responsável | Feed Meta/JSON-LD não anuncia disponibilidade não comprovada |
| Dados de consentimento | Revisão LGPD, registro/versionamento, retirada de consentimento antes da compra e **após compra pendente**, retenção e prova de aceite | Nenhum evento opcional sem base legal; revogação propagada ao servidor antes de eventos futuros |
| Meta CAPI | Opt-in/opt-out sintéticos em staging, evento Purchase só após Appmax aprovado, deduplicação com Pixel e Graph confirmado | Sem Purchase falso ou repetido; pedido sem aceite não gera eventos nem recuperação recorrente |

**As SQLs de produção não devem ser executadas automaticamente.** A alteração C5 em `supabase/vonix-meta-purchase-delivery.sql` muda funções para exigir consentimento antes de reservar ou selecionar Purchase, mas **precisa ser aplicada/validada em staging** para produzir efeito no banco. Não fazer migração somente porque o PR passou. A atualização C8 de `supabase/vonix-checkout-idempotency.sql` endurece `search_path` das três funções `SECURITY DEFINER`; o roteiro sintético reproduzível está em `scripts/qa-checkout-idempotency-hardened.sql`. **Testes sintéticos não substituem aplicação e validação em staging com backup.**

## Validação sintética que já pode ser reproduzida sem contas reais

A fonte `scripts/qa-meta-consent-synthetic.sql` contém guarda por nome de banco `vonix_synthetic`, exemplos de pedidos fictícios 1001–1004, verificação de seleção e reserva, RLS/permissões e `ROLLBACK`.

Em 09/11/2026 o script foi executado no PostgreSQL 16 isolado da rede (`--network none`), com sistema de arquivos em memória, schema de snapshots e SQL do CAPI, sem porta publicada. **PASS**: legados, recusados e versão antiga excluídos; somente aceite v1 selecionado/claim; `anon` e `authenticated` não receberam acesso às funções/tabelas. O contêiner foi removido após o teste. Essa prova **não substitui** staging da loja.

## Revisão de conversão P1

**Não concluir que correções técnicas recuperaram vendas sem transações confirmadas.** Para atribuir as perdas no funil, levantar uma janela comum com dados agregados, por canal e dispositivo: visitas na landing, cliques em compra, sessões com carrinho, sessões iniciando checkout, falhas de CEP, métodos disponíveis, respostas Appmax e pedidos **pagos**. Como opt-out reduz eventos de analytics, usar a fonte financeira para conferir denominadores, jamais presumir 100% de rastreamento.

Obter também histórico dos preços de referência, autorização de depoimentos, comprovação de SLA de atendimento, acessibilidade com teclado/leitor de tela, Lighthouse em rede móvel fria, Search Console e consentimento para comunicação por e-mail.

## Gate final antes de produção

Exigir responsáveis do negócio, jurídico, pagamentos, ERP, dados e operações assinarem cada porta P0 com evidência datada. Preparar plano de reversão em PR e backup, janela de monitoramento de cobranças duplicadas e falha de pedidos, revisão de domínio e permissões. **Sem esses registros, PR #26 continua em revisão.**
