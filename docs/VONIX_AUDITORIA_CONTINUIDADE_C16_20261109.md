# Vonix Hair — checkpoint C16: checkout compacto auditado e jornada recuperável

**Data:** 09/11/2026 · **Projeto exclusivo:** e-commerce `C:\Users\JL\code\vonix-hair-care` · **Branch:** `fix/vonix-ecommerce-auditoria-2026-11-09` · **Base:** C15 `639da50` · **PR:** #26.

## Escopo e alterações verificadas

**N62 — retentativa de frete tinha HTML inválido.** O alerta `<p role="alert">` do checkout colocava `<button>` aninhado dentro do próprio `<p>`, estrutura incompatível com HTML válido e sujeita à correção automática de DOM por navegadores/hidratação. O botão **Tentar calcular frete novamente** agora fica como irmão do parágrafo, dentro de `<div>`. O clique continua apenas refazendo a cotação, sem criar ou renovar pagamento.

**N63 — CPF inválido deixava o comprador sem correção contextual.** A validação própria rejeitava o CPF, mas o erro aparecia apenas no rodapé da página longa. O checkout agora coloca foco no campo, define `aria-invalid=true`, relaciona a mensagem via `aria-describedby` e limpa o erro quando a pessoa edita o CPF. Não envia pagamento quando inválido. Os valores de CPF são usados apenas em testes sintéticos e não foram copiados para o relatório.

**N64 — pouca clareza do total no início do checkout mobile.** O formulário tinha resumo completo depois dos três blocos. Foi adicionada uma faixa compacta no início (apenas telas menores que LG), mostrando quantidade de itens, total atual e aviso explícito **Frete calculado pelo CEP** antes de cotação. Após cotação válida exibe a situação real da opção selecionada e acompanha a mudança de método Pix/cartão. Adicionado atalho **Editar sacola**, que preserva o carrinho existente. O resumo completo e as guardas da compra foram mantidos.

**Escopo financeiro inalterado:** não foram modificadas as funções server-side de pagamento, reserva/idempotência, consulta de status assinada, proteção de tentativa pendente, antifraude, cálculo de preço, PIX, gateway ou Bling. Nenhum arquivo da inscrição de afiliadas foi modificado.

## Evidências e testes

- **Teste RED/GREEN:** três novos cenários inicialmente falharam como esperado antes da correção; adicionada também cobertura de resumo dinâmico. Suíte direcionada do checkout **41/41 PASS**.
- **Vitest integral:** **539/539 testes PASS**, distribuídos em **66 arquivos**, exit code 0 confirmado pela sessão de processo.
- **TypeScript:** `npx tsc --noEmit` exit 0; **ESLint** dos arquivos alterados exit 0; **Vite/Nitro build** exit 0, preset Cloudflare Module.
- **SSR catálogo:** 42 produtos ativos verificados, sem falhas; SKU `plex-vonix` continua excluído do catálogo. Registro histórico do SSR mantido sem timestamp artificial.
- **Chrome local com tráfego externo bloqueado:** `scripts/qa-c16-checkout-flow.mjs` passou nos viewports **320, 390 e 1366 px** (3/3), percorrendo PDP → gaveta → checkout → sacola → retorno. Verificada conservação do carrinho, ausência de overflow horizontal e erros de página. A cobrança permaneceu indisponível sem cotação; nenhuma submissão ao gateway aconteceu. Evidência em `qa-artifacts/vonix-c16/dev/report.json` e seis screenshots.

## Integração main / PR #26: bloqueio mantido

A `origin/main` observada avançou até `4d77dc2`, com o PR #44 de afiliadas. O comando **read-only** `git merge-tree --write-tree HEAD origin/main` reportou cinco conflitos: `src/components/buy-drawer.tsx` (add/add), `src/lib/checkout.functions.ts`, `src/lib/upsell.ts` (add/add), `src/routes/checkout.tsx` e `src/routes/produto.$slug.tsx`. Não executar aceitação automática de `theirs`, merge destrutivo ou deploy. O checkout compacto da `main` e a auditoria exigem reconciliação preservando os mecanismos de pagamento e cookies. PR #26 não está pronto para merge.

## Homologação real continua pendente

Appmax sandbox (Pix/cartão, `paid_at`, falha de conexão, antifraude e cancelamento), Supabase isolado com backup/restore, RLS e concorrência, Bling e estoque dimensional por SKU, consentimento LGPD após pedido, WAF/limite distribuído e GA4 correlacionado a pedidos **efetivamente pagos**. O runtime Cloudflare Worker da build requer validação em staging; `vite preview` falhou no C15 por incompatibilidade de entrada `dist/server/server.js` com saída Nitro `.output/server/index.mjs`.

**Conclusão:** C16 corrige defeitos reproduzidos da UX e preserva as proteções financeiras da branch auditada. Testes locais não provam aumento de vendas nem liberam publicação. Sem dados de funil real ainda não é possível atribuir causalidade à ausência de vendas.
