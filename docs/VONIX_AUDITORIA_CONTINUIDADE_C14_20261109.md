# Vonix Hair — auditoria C14: retentativa de frete e valor confirmado no checkout

**Data:** 09/11/2026 · **Projeto:** e-commerce exclusivamente em `C:\Users\JL\code\vonix-hair-care` · **PR:** #26 · **Base da auditoria:** `18155e9` (C13).

## N55 — erro transitório de frete prendia o comprador

O checkout mostrava uma falha na cotação do CEP, mas sem uma ação direta de recuperação. Agora exibe **Tentar calcular frete novamente** quando o CEP tem oito dígitos. A ação atualiza exclusivamente a cotação; não chama Appmax nem cria pagamento. Ela respeita a proteção já existente contra respostas defasadas de cotação e mantém a escolha de frete válida.

Regressão React Testing Library: primeira cotação falha, botão aparece, segunda cotação traz serviço, e nenhuma chamada de pagamento ocorre.

## N56 — cotação podia mudar após ser exibida, antes de gerar pagamento

O cliente passa `quotedTotalCents` calculado sobre o total apresentado no momento do clique. O servidor continua recalculando preços, descontos e frete por fontes próprias. Antes de reservar o pagamento, compara a quantia em centavos com o total confirmado. Havendo divergência, retorna `retrySafe: true` com `reason: "price_changed"` e mensagem explícita, sem reservar nem cobrar; a UI solicita nova cotação automaticamente para o cliente rever o valor.

Se já existe uma tentativa reservada da mesma compra, o servidor prioriza a recuperação **somente de leitura** do pedido e do valor original persistido, sem emitir cobrança duplicada — aproveitando o C13. O campo é opcional para preservar clientes legados: até atualizar todas as versões, navegadores antigos não têm essa barreira adicional, embora a precificação server-side e a idempotência permaneçam vigentes.

## Evidências verificadas nesta continuação

- Vitest integral, após a refatoração do erro: **528/528 testes PASS em 64 arquivos**, exit 0.
- Vitest dirigido após essa refatoração: **90/90 PASS**, três arquivos de checkout, incluindo os novos casos.
- `npm run build`: exit 0; Vite/Nitro compilou cliente e servidor localmente.
- Prettier `--check` nos arquivos alterados: exit 0; lint/TypeScript sem erros na revisão direcionada.
- SSR local: **42/42 produtos ativos**, produto `plex-vonix` excluído e rota inexistente HTTP 404; falhas registradas: 0.
- Nenhum pagamento real, migração, edição do sistema de afiliadas, merge da `main` ou deploy.

## Bloqueio de integração com main oficial

O PR #26 está aberto, mas o GitHub informou `mergeable: CONFLICTING`. A `main` avançou até `6ce6952`, introduzindo a nova `buy-drawer.tsx` e alterações profundas em `checkout.tsx` e `produto.$slug.tsx`. A nova interface ainda não foi conciliada com as proteções de checkout/frete/consentimento da auditoria. Não realizar merge destrutivo ou anunciar que a nova gaveta está homologada com o PR.

## Portas P0 não resolvidas

Permanecem pendentes Appmax sandbox real para Pix/cartão/antifraude/`paid_at`; Supabase staging isolado com backup, SQLs, RLS e concorrência; Bling e estoque físico por SKU; revogação tardia do consentimento LGPD; rate-limit distribuído/WAF; propriedade GA4; e conciliação de funil de pedidos efetivamente pagos com sessões, tráfego e dispositivos. Sem isso, testes locais não provam recuperação de vendas nem liberam produção.

## N57 — riscos verificáveis na nova interface da main, sem edição da main

Inspeção **read-only do código de `origin/main` em `6ce6952`**: `src/components/buy-drawer.tsx` exibe `Você ganhou frete grátis!` sempre que a cesta passa do piso monetário, sem CEP/cobertura; isso contraria a regra já auditada de que frete grátis depende de cotação válida. A gaveta também tem botões de quantidade com área de toque de 28 px e fechamento de 36 px, que merecem correção de acessibilidade ao integrar.

O checkout compacto atual de `origin/main` não contém os marcadores `statusToken`, `savePendingPix` e `UncertainPayment` usados na branch de auditoria para acompanhar o pedido original e bloquear novas cobranças após resposta ambígua. **Isso é uma divergência de código que precisa de reconciliação**, não prova isolada de que o site publicado já perdeu esses mecanismos.

Integração segura exige preservar os bloqueios C11–C14 de pagamento, consentimento e idempotência; ajustar copy e testes de cobertura do frete na gaveta; e executar regressões de Pix/cartão, frete, carrinho, cookies, mobile e SSR antes de liberar a versão compacta.
