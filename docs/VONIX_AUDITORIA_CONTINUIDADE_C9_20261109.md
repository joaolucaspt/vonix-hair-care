# Vonix Hair — auditoria C9: revalidação de carrinhos persistidos e falhas seguras do checkout

**Data:** 09/11/2026 · **Repositório exclusivo:** `C:\Users\JL\code\vonix-hair-care` · **PR:** #26 · **Base do C9:** `9934332` (integração C8, main até `0bd0643`).

## N43 — carrinhos salvos continham itens agora indisponíveis

**Causa:** o catálogo ativo passou a excluir `plex-vonix`, mas o carrinho persistente ainda podia manter o slug, inclusive junto de outros produtos. A tela filtrava os itens inexistentes silenciosamente; o registro local continuava divergente e a situação piorava ao reutilizar ofertas antigas.

**Correção:** `migrateCart` valida formato, quantidade inteira positiva, variante vigente e presença do produto no catálogo ativo; elimina itens e variantes indisponíveis, preservando produtos válidos, consolidando unidades de combos legados e limitando quantidade por linha a 99. A versão normalizada substitui a versão anterior no `localStorage`, e uma marca não pessoal em `sessionStorage` ativa um aviso no carrinho. O comprador confere o total antes de prosseguir; o aviso pode ser dispensado.

A normalização também roda após ações de adição, remoção e alteração de quantidade, não só no primeiro carregamento. Em modos privados/armazenamento indisponível o estado em memória funciona, mas a persistência após recarregar continua sujeita às restrições do navegador.

## N44 — promoção de complemento sobrevivendo sem item-base elegível

Uma promoção `comp5` em carrinho antigo pode perder a condição quando o produto base fica indisponível ou o cliente o remove. Anteriormente, o desconto ainda aparecia no cliente, enquanto o servidor podia rejeitar a compra. Além disso, a lista geral de mais vendidos podia tornar um complemento `comp5` elegível **mesmo sem nenhum item-base**.

**Correção:** cliente e servidor só mantêm `comp5` quando existe pelo menos um item-base ativo e o complemento faz parte das recomendações para o carrinho atual. Caso contrário, o item válido é mantido **sem esse desconto**, e linhas iguais são consolidadas. Uma tentativa forjada de complemento isolado também é negada antes de reservar qualquer cobrança.

## N45 — erro de catálogo confundido com resultado financeiro incerto

Antes, `buildLines` lançava erro quando o produto estava indisponível ou a promoção era inválida, e `createPayment` tratava a exceção no mesmo bloco de falha ambígua de pagamento. Isso produzia uma orientação de conciliação mesmo sem contato com a Appmax.

**Correção:** `quoteShipping` e `createPayment` validam o carrinho **antes de consultar frete, criar reserva idempotente ou contatar gateway**. Produtos e descontos inválidos retornam uma mensagem específica para revisar a sacola, com `retrySafe:true` no checkout. Erros realmente incertos após chamada financeira continuam protegidos por `retrySafe:false` e não desencadeiam novas cobranças.

## Provas sintéticas da rodada

- **Vitest:** **475/475 testes em 62 arquivos, exit 0**, incluindo novos testes de catálogo indisponível, promoção órfã e desconto forjado em produto mais vendido; sem regressões nos módulos anteriores.
- **TypeScript e ESLint direcionado:** aprovados, inclusive após normalização da entrada `unknown` e ajuste JSX do aviso.
- **Chrome headless**, rede externa interceptada:
  - Antigo carrinho apenas com Plex: sacola vazia, notice de ajuste, nenhuma ação de pagamento
  - Plex + Sérum Argan com complemento órfão: Plex removido, sérum mantido sem oferta, checkout acessível somente para o item válido
  - Plex + Combo Banana e Mel + Sérum Argan: itens ativos mantidos e complemento válido preservado
  - Remoção do item-base ao vivo: desconto do Sérum retirado imediatamente, com aviso, sem overflow a 390 px
- **Backend em simulação:** tentativa com Plex e com complemento isolado é rejeitada antes de frete, reserva, cliente, pedido ou Pix. Simulações de estado ambíguo de gateway continuam cobertas por testes separados.
- **SSR:** 42/42 páginas ativas, Plex 404. Este indicador não garante estoque real de outros produtos.
- **Separação dos projetos:** arquivos de afiliadas não são modificados. Nenhum pagamento, webhook, postagem de marketing, migração, merge do PR para `main` ou deploy foi executado.

## Pendências anteriores mantidas

**P0 operacionais:** Appmax sandbox (Pix/cartão/antifraude e recuperação), Supabase staging com backup/restore, migrações C5/C8, RLS e concorrência, Bling/estoque e peso/dimensões físicos por SKU, conformidade LGPD e revogação tardia de Purchase, WAF/rate limit e reconciliação real de pedidos. **P1:** histórico de preços comparativos, consentimento para provas sociais, comunicação transacional efetiva, acessibilidade/Lighthouse e funil real de sessões versus pedidos pagos.

Revisar `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`. **Não confundir testes sintéticos ou CI verde com homologação para produção.**
