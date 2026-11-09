# Vonix Hair — Continuidade C5: consentimento comercial no pedido e no CAPI

**Data:** 09/11/2026 · **Projeto único:** `C:\Users\JL\code\vonix-hair-care` · **PR:** #26 · **Base:** `2ca6105`. Nenhuma alteração intencional em afiliadas, operação financeira ou banco real.

## N29 — Purchase server-side sem comprovação de consentimento técnico

**Antes:** mesmo após o controle de cookies do C4, um pedido aprovado poderia disparar `Meta CAPI Purchase` pelo worker de backend sem consultar a preferência do comprador. Esse envio não é necessário para confirmar o pagamento ou entregar a encomenda.

**Correção C5:** o frontend inclui a escolha opcional `marketingConsent` no POST do checkout; o servidor valida esse campo e salva `{accepted:boolean,policyVersion:"v1",recordedAt: ISO8601}` no snapshot durável **antes de solicitar pagamento**. Ausência de campo nos clientes antigos = recusa. O schema do snapshot aceita ausência para ler registros históricos, mas **não a converte em aceite**.

O worker `sendVerifiedPurchase` confere `marketingConsent.accepted === true` e `policyVersion === "v1"` antes de calcular valor, reservar entrega ou chamar a Meta. Pagamentos, faturas, estoque, exportação Bling e conciliação seguem independentes de marketing.

**Defesa em profundidade no PostgreSQL:** a função `vonix_claim_meta_purchase` devolve `claimed:false` se o snapshot não demonstrar aceite v1. A `vonix_meta_recovery_candidates` só agenda e seleciona pedidos elegíveis, impedindo a consulta periódica desnecessária de pedidos históricos/recusados. SQL versionada alterada, **não aplicada em banco real**.

**Compatibilidade:** nenhum novo campo SQL foi exigido, pois snapshots são `jsonb`; antigos são lidos, mas não geram conversões. Nenhuma alteração na deduplicação `purchase-ORDER_ID` ou no mecanismo de cobrança.

## N30 — Promessa de comunicação transacional sem comprovação

Nas telas de confirmação de Pix e cartão, removida a promessa de que detalhes seriam enviados por e-mail/WhatsApp. A orientação agora é guardar o número do pedido e usar a área de acompanhamento/atendimento. A automação de comunicação só pode ser anunciada como funcional após prova de entrega.

## Evidências

- **421/421 testes em 57 arquivos** na validação final C5 (exit 0), incluindo cenários aceito/recusado/legado/versão incorreta, preservação de pagamentos e escolha enviada pelo cliente. A confirmação de cartão usa texto sem prometer mensagens transacionais não homologadas.
- **PostgreSQL 16 real e descartável (duas execuções):** `scripts/qa-meta-consent-synthetic.sql`; quatro pedidos fictícios; só o pedido com aceite v1 entrou na recuperação e recebeu lease; roles públicas sem SELECT/EXECUTE; `ROLLBACK`; contêineres isolados `vonix-c5-consent-qa-20261109` e `vonix-c5-consent-qa2-20261109` removidos. As quatro funções de privilégio elevado foram endurecidas com `search_path = ''`, conforme recomendação de segurança do Supabase; a segunda execução confirmou a configuração no catálogo PostgreSQL.
- TypeScript `EXIT=0`; build de produção `EXIT=0`; ESLint direcionado `EXIT=0`; preflight SSR **43/43 produtos** `EXIT=0`. Chrome em 320/390/1366 px aprovado após reinicializar a prévia `localhost:43972` (primeira tentativa falhou por indisponibilidade temporária do servidor Vite, não por exceção da página). **CI remoto do novo commit ainda precisa ser conferido após o push.**

## Limites explicitamente não resolvidos

1. **Revogação posterior ao pedido:** o snapshot guarda a escolha no instante da criação. A revogação em outro dispositivo/aba depois da compra pode não alcançar o backend antes do envio atrasado de Purchase. Exige ledger de preferências, prova de identidade, atualização autorizada, revisão jurídica e testes de concorrência em staging.
2. **Consentimento jurídico e prevenção de fraudes:** o aceite vem do próprio navegador; timestamp/versionamento técnico não prova integralmente finalidade, transparência, titularidade nem base legal. Validar com assessor jurídico e gestor de dados.
3. **Appmax, Supabase staging, Bling, SKU/estoque, preços e métricas pagas:** pendentes de ambientes autorizados e fatos operacionais. Não foi feita cobrança, reembolso, disparo real de marketing, alteração de pedidos, merge nem deploy.
4. **Efeito no banco:** modificar SQL no repositório não altera Supabase. Reaplicar funções em ambiente homologado após backup/restore e revisão de roles é obrigatório antes de declarar o gate implantado.

Roteiro detalhado para homologação: `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`. Ver matriz completa `docs/VONIX_AUDITORIA_MATRIZ_20261109.md`.
