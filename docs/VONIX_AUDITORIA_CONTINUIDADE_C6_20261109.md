# Vonix Hair — auditoria C6: recuperação conservadora de falha de resposta de pagamento

**Data:** 09/11/2026 · **Escopo exclusivo:** e-commerce `C:\Users\JL\code\vonix-hair-care`, PR #26, base de trabalho `5c48086`. O desenvolvimento das afiliadas na `main` é separado e seus arquivos não foram alterados nesta rodada.

## N32 — Mensagem de retry contradizia idempotência do checkout

**Falha identificada:** quando `createPayment` lançava erro de rede na interface, o navegador mostrava **“Tente novamente em instantes”** e deixava o CTA livre. O gateway pode ter processado uma tentativa mesmo sem devolver resposta ao navegador. A idempotência server-side introduzida anteriormente é uma defesa importante, mas não torna aceitável convidar o consumidor a pagar novamente sem confirmar o estado.

**Correção C6:** antes de solicitar um pagamento, o checkout guarda somente `{method, startedAt}` em `sessionStorage`, sem e-mail, CPF, token ou cartão. Resposta conhecida e segura para nova edição limpa o marcador; resposta de compra conhecida guarda primeiro Pix ou status de cartão e depois limpa o marcador. Erro de rede ou falha ambígua do backend mantém o marcador e mostra uma tela de **“Pagamento em verificação”**, sem botão para repetir Pix/cartão; a tela sobrevive ao refresh na mesma aba e oferece acesso ao atendimento.

O backend passa a diferenciar sua falha ambígua por `retrySafe: false`, sem mexer em cobrança, pedidos, idempotência, outbox, Meta ou Bling. Erros simples e explícitos de validação mantêm o fluxo de correção pelo consumidor.

## N33 — Refresh no meio da requisição não deve convidar nova cobrança

O marcador é salvo **antes da solicitação**, não somente no `catch`: se o navegador for atualizado durante uma requisição pendente, a nova tela mostra verificação em vez de uma nova tentativa. O TTL de 24 h é um bloqueio apenas de experiência no navegador; a idempotência durável do backend continua sendo a salvaguarda que precisa de homologação em staging. O marcador não é identificação do pedido nem prova de pagamento.

**Limitações:** navegadores que bloqueiam `sessionStorage`, troca de dispositivo, aba nova ou expiração do marcador não preservam este aviso; nesses casos a exclusão de cobranças repetidas depende do mecanismo de idempotência server-side e do status autenticado da Appmax. Quando não há `orderId` nem `statusToken` recuperável, **não é correto alegar consulta automática do status**; o suporte precisa verificar a transação. Não apagar o bloqueio automaticamente enquanto não houver confirmação do gateway.

## Evidências C6

- Unitários da persistência e validação do marcador, incluindo corrupção, expiração e APIs de armazenamento bloqueadas
- Integração de checkout com resposta perdida, retorno ambíguo, negativa segura e reabertura depois de recarregar a tela
- Regressão do backend exigindo `retrySafe:false` para erro de transação com estado incerto
- **Vitest completo:** 429/429 testes aprovados em 58 arquivos; **TypeScript, ESLint direcionado e build de produção:** exit 0; **SSR:** 43/43 páginas de produto válidas, exit 0; **Chrome local:** verificações móveis em 320, 390 e 1366 px e fluxo de carrinho, exit 0. O CI remoto ainda precisa ser confirmado para o commit C6 após o push. Evidência: `docs/VONIX_C6_VERIFIED_RECEIPT_20261109.json`.
- Nenhuma transação, envio de mensagens, banco real, merge ou deploy executado

## Pendências anteriores preservadas

**P0:** Appmax sandbox (Pix/cartão/antifraude, timeout e recuperação de status), Supabase staging com backup e validação SQL/concorrência, Bling (pedidos e estoque), dimensões e estoque real por SKU, revogação posterior ao checkout e revisão LGPD do CAPI server-side. **P1:** histórico verificável dos preços de referência, consentimento de depoimentos, testes de entrega/atendimento e métricas de sessões versus pagamentos aprovados.

A correção de front-end C6 reduz o risco de induzir uma segunda cobrança, mas não prova disponibilidade nem homologação do checkout operacional. A referência principal de gates externos é `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`.
