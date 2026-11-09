# Vonix Hair — continuidade da auditoria de conversão (09/11/2026)

**Projeto único:** `lucassilva1175/vonix-hair-care` / Lovable **Vonix Haircare Showcase**. Branch de trabalho: `fix/vonix-ecommerce-auditoria-2026-11-09`; PR #26. **Não é** o sistema de afiliadas, nem “Vonix — Expedição Fácil”.

## O problema de negócio e o limite da evidência

Objetivo: localizar e corrigir falhas do funil que podem impedir vendas. A auditoria anterior observou, no período 02–09/11, aproximadamente 593 visitantes, 1.168 visualizações de página, rejeição informada de 47%, permanência média de 11 s, 50 visualizações em /carrinho e 32 em /checkout. **Não se pode calcular a taxa de conversão ou atribuir uma causa única apenas dessas contagens**: faltam sessões por etapa, consentimento/atribuição do GA4, tentativas da Appmax, taxas de recusa e vendas efetivamente pagas.

As correções do PR #26 ainda não estão comprovadamente no site publicado. A página pública consultada em 09/11 ainda mostra “Entrar”, embora a correção anterior da branch tenha renomeado esse link para “Pedidos/Acompanhar pedido”. O ambiente público não deve ser tratado como equivalente ao estado da branch.

## Estado preservado antes desta continuidade

- PR #26: checkout direto, CEP/frete, cobrança segura, revalidação Appmax, snapshots, idempotência persistente, reconciliação e Bling, CAPI Meta; CI registrada como aprovada no início desta sessão.
- PR #27 das afiliadas: mesclado por outro fluxo; nada foi editado neste sistema de afiliadas.
- Atualização local feita por **fast-forward** a partir da branch remota do PR #26, sem reset/rebase ou alteração da main.
- Nenhuma credencial, `.env`, base de dados real, transação ou deploy foi acessado.

## Correções feitas nesta continuidade

| Área | Problema reproduzível / encontrado | Mudança |
| --- | --- | --- |
| Checkout cartão | CTA podia estar disponível mesmo sem inicialização do SDK da Appmax, deixando o usuário sem retorno | Estado de carregamento/erro do SDK, desabilitação do CTA até estar pronto, recarga manual, erros explícitos |
| Segurança cartão | Callback tardio/inesperado do SDK poderia alcançar a rotina de pagamento sem uma submissão ativa | Janela controlada de tokenização, timeout de resposta e bloqueio de callbacks sem tentativa ativa |
| Diagnóstico de conversão | Abandono técnico sem sinal específico para diferenciar indisponibilidade de método, erro de frete, tokenização ou gateway | Eventos GA4/Clarity `checkout_error` com `step` e `reason` fixos, sem CPF, telefone, endereço, número do cartão ou mensagem crua do provedor |
| Confiança / conteúdo | Termos e Política de Privacidade mencionavam outro domínio como site, embora a loja use `https://vonixhair.com` | Referências ao site corrigidas, mantendo os contatos existentes |
| Regressões | Falha do SDK podia passar despercebida nos testes | Casos para carregamento falho, API ausente, tentativa de recarga, callback sem envio e disponibilidade dos métodos; testes para domínio nos textos |

## Prioridades de liberação por área (sem publicação automática)

| Prioridade | Área | Confirmação necessária |
| --- | --- | --- |
| **P0** | Pagamentos | Appmax sandbox: Pix aprovado/cancelado/expirado, cartão aprovado/recusado/em análise, indisponibilidade do SDK, perda de resposta e repetição segura |
| **P0** | Persistência | Migrações e política RLS em Supabase staging com backup, lock/claim concorrente, estado órfão e intervenção humana auditada |
| **P0** | ERP/expedição | Contrato real da API Bling v3, dedupe de pedidos, itens, SKU, quantidade, custo, peso/dimensões, estoque e frete |
| **P0** | Observabilidade | Confirmar GA4 `purchase` apenas após pagamento validado, com `transaction_id` deduplicado; CAPI Meta via Appmax autenticada e entrega única |
| **P1** | Vitrine | Revisar imagens, preços, ofertas, regras Pix/kit/cupom, cálculo consistente no carrinho/PDP/checkout, responsividade e acessibilidade em aparelhos reais |
| **P1** | Confiança | Conferir fonte dos contadores de “vendidos”, depoimentos e promessas publicitárias; manter textos comerciais comprováveis |
| **P1** | Política e SEO | Domínio canônico, dados e canais de contato, termos, política de frete, metadados e canonical em todas as rotas |
| **P2** | Crescimento | Com pagamentos homologados, medir o funil por sessões/coortes e canal; testar hipóteses de oferta, tráfego e frete antes de atribuir responsabilidade ao design |

## Eventos e medição

No GA4, acompanhar `view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase` e `checkout_error`. O último usa apenas códigos de falha e **não** inclui dados pessoais. Analisar sessões/usuários únicos por etapa e por origem de tráfego, além dos logs de pedidos iniciados e status Appmax. Os totais de visualizações anteriores não representam um funil de conversão válido.

Os `checkout_error.reason` inicialmente gerados são:
- `pix_unavailable`, `card_unavailable` (métodos desativados);
- `no_options`, `quote_rejected`, `network_or_server` (frete, onde indicado por `step`);
- `load_timeout`, `load_error`, `missing_api`, `init_failed`, `tokenization_failed`, `tokenization_timeout` (cartão);
- `invalid_cpf`, `gateway_or_validation`, `network_or_server` (contato/pagamento, desambiguados por `step`).

## Portas de saída

**Não liberar PR #26 nem migrar SQL de produção somente porque unit tests, TypeScript, lint e build passaram.** Necessário staging isolado, credenciais próprias de homologação, testes ponta a ponta, revisão de segurança, confirmação de dados reais de produto/estoque e janela de publicação com rollback. O PR de código e a loja no ar continuam sendo estados distintos.

Fontes do próprio projeto: `docs/VONIX_CHECKOUT_IDEMPOTENCY_2026-11-09.md`, `docs/VONIX_PR26_MERGE_MAIN_2026-11-09.md`, `docs/VONIX_APPMAX_BLING_ORDER_INTEGRITY_2026-11-09.md`; verificação pública: `https://vonixhair.com/` e `https://vonixhair.com/termos-de-uso`.
