# Vonix Hair — Handoff de segurança e integridade de pedidos

**Data:** 09/11/2026

**Escopo exclusivo:** `lucassilva1175/vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`.

**Mudanças NÃO publicadas.** Sem cobranças reais, sem alteração de segredos, sem migração aplicada a banco real.

## Preservação e retorno

- `main` original antes deste ciclo: `5e7d547e868502f5ae448a82bf078ff62344a768`.
- PR existente: https://github.com/lucassilva1175/vonix-hair-care/pull/26 .
- Backup GitHub: https://github.com/joaolucaspt/vonix-hair-care/tree/backup/vonix-2026-11-09-before-github-corrections .
- Backup pré-Lovable: https://lovable.dev/projects/1196c524-6af0-471a-a24a-05dab53ac58d .
- As alterações devem ser revertidas por novo PR/commit de reversão caso não sejam aprovadas; não apagar o histórico.

## Implementações desta rodada

1. **Classificação Appmax:** `autorizado` não conta como pago; `aprovado` e `pendente_integracao` indicam pagamento confirmado; apenas `integrado` libera expedição. Status de estorno/disputa não liberam pedidos.
2. **Pedido Appmax:** usar `unit_value` em centavos por item e não enviar também `products_value` — estratégias mutuamente exclusivas.
3. **Snapshot durável e validado:** após criar o ID de pedido Appmax e **antes** de chamar pagamento Pix/cartão, guardar o endereço, contato e itens precificados no servidor (`vonix_order_snapshots`). Falha de armazenamento **bloqueia o início da cobrança**. A consulta `GET /v1/orders/{id}` não fornece os itens e endereço exigidos pelo Bling.
4. **Outbox persistente:** webhook da Appmax somente valida envelope e inclui ID no banco. Falha no banco responde HTTP 503 para incentivar retry; sem execução do ERP durante a resposta do webhook.
5. **Worker separado:** rota interna `POST /api/internal/order-worker` exige `Authorization: Bearer <ORDER_WORKER_SECRET>`; consulta o status real da Appmax e só tenta Bling após `integrado`. `FOR UPDATE SKIP LOCKED`, `claim_token` e lease evitam processadores concorrentes reutilizarem a mesma tentativa; o backend recusa apagar lease de outro worker.
6. **Bling:** conversão estrita de valores Appmax (centavos) para reais; snapshot (não resposta incompleta do GET Appmax); consulta prévia de `numeroLoja`; falha segura se a referência não vier na resposta. O contrato do filtro Bling deve ser homologado com a conta de teste.
7. **OAuth Bling:** callback usa estado aleatório vinculado ao navegador, com cookie HttpOnly/Secure/SameSite=Lax; não exibe tokens. Renovação do refresh token persiste em tabela protegida com atualização compare-and-swap.
8. **Consulta pública de status:** exige token de capacidade assinado e específico do pedido, emitido após criação; impede consultas por ID isolado.
9. **Cupons de complementos:** promoções `comp5` só são aceitas pelo servidor quando o produto pertence às recomendações para itens reais da cesta.
10. **Avaliações:** não registrar nome/e-mail/comentários em logs quando integração está indisponível; não informar falso sucesso caso a avaliação não tenha sido recebida.
11. **CI:** workflow GitHub executa instalação imutável, testes, TypeScript e build sem publicar.

## Evidências locais

- **157/157 testes PASS (26 arquivos)**, mocks isolados sem gateway/ERP real.
- TypeScript `tsc --noEmit`: PASS.
- Build `bun run build`: PASS.
- ESLint funcional sem regra de estilo Prettier: 0 erros, 2 avisos preexistentes em `src/routes/checkout.tsx` (dependências de useEffect).
- Lint com regra Prettier: falhou devido principalmente a diferença de finais de linha CRLF/LF e estilo herdado. Não alterar centenas de linhas fora do escopo só para limpar esse resultado.
- `git diff --check`: PASS.
- Nenhuma comprovação ainda de um pagamento aprovado ou exportação real ao Bling.

## Migrações necessárias (não executadas)

Aplique **em staging autorizado**, depois de backup e revisão, nesta ordem:
1. `supabase/vonix-order-snapshots.sql`
2. `supabase/vonix-order-outbox.sql`
3. `supabase/vonix-bling-token-store.sql`

Todas as tabelas restringem acesso a `service_role`, sem acesso direto para `anon` ou `authenticated`. Os snapshots contêm dados pessoais; definir retenção, acessos e descarte com adequação à LGPD antes de produção.

## Configuração necessária (somente em ambiente autorizado)

Nunca escrever valores reais de segredo neste repositório nem colocar `SUPABASE_SERVICE_ROLE_KEY` em código cliente.

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para snapshots/outbox/tokens;
- Credenciais **merchant** `APPMAX_CLIENT_ID`, `APPMAX_CLIENT_SECRET` e `APPMAX_ENV` de ambiente apropriado;
- `APPMAX_WEBHOOK_SITE_ID` obrigatório (e `APPMAX_WEBHOOK_APP_ID` recomendado) para rejeitar webhooks de outra loja/app;
- `ORDER_WORKER_SECRET` longo e aleatório, somente backend e scheduler autorizado;
- `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_SETUP_SECRET` longo e aleatório e, na migração inicial, `BLING_REFRESH_TOKEN` quando aplicável; `BLING_LOJA_ID` conforme conta;
- Agendar invocação autorizada do worker, sem divulgar a credencial. Nenhum scheduler foi criado nesta sessão.

**IMPORTANTE:** com a nova arquitetura, na ausência de Supabase ou credenciais Appmax, o checkout exibe pagamentos indisponíveis e não realiza cobrança. Não mesclar/publicar antes de configurar, testar e decidir explicitamente o rollout.

## Homologação obrigatória antes da publicação

- Sandbox Appmax: Pix pendente/aprovado, cartão autorizado (antifraude), aprovado/integrado, recusa, reembolso, timeout e retries sem transação real.
- Bling de testes: verificar endpoint/filtro `numerosLojas[]`, formato retornado, `numeroLoja` persistido, duplicatas após timeout, mapeamento de cliente/itens/impostos/frete/desconto, ID da loja e estoque.
- Banco staging: executar SQL, testar duas invocações simultâneas do worker, expiração/reclamação de lease e liberação de recursos.
- Preço/estoque: homologar estoque real, medidas/peso de kits, frete grátis e cupons por contexto.
- Métricas: enviar apenas `Purchase`/GA4 depois de confirmação de pagamento, com deduplicação, consentimento e sem expor dados pessoais.
- Revisar segurança, rate limiting, tratamento de chargeback, políticas e teste mobile E2E.
- Confirmar comportamento de integração com Lovable/release e manter plano de rollback.

## Bloqueios atualmente conhecidos

- **Não homologado:** contrato vivo da Appmax/Bling e comportamento em banco Postgres, pois não houve autorização para usar credenciais nem alterar banco real.
- **Não configurado nesta sessão:** serviço de outbox, scheduler e OAuth real do Bling.
- **Não resolvidos:** estoque conectado, embalagem exata, ferramentas de consentimento, relatórios de compras confirmadas, rate limiting distribuído e auditoria jurídica.
- **Atenção:** ausência de evento de afiliado fora do fluxo de consulta do usuário precisa de conciliação por webhook/worker antes de contar comissões automáticas.

Referências oficiais: https://docs.appmax.com.br/guides/status-pedidos ; https://docs.appmax.com.br/api-reference/orders/calculo-valor ; https://docs.appmax.com.br/api-reference/orders/consultar-pedido ; https://docs.appmax.com.br/guides/webhooks ; https://developer.bling.com.br/aplicativos .
