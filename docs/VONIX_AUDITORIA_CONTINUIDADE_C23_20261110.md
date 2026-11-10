# Vonix Hair e-commerce — C23: vitrine com filtros claros e Favoritos utilizáveis

**Data local:** 10/11/2026. **Projeto:** exclusivamente `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09` (PR #26). **Base C22:** `6fb6a8e`. **Produção:** NOT_APPROVED.

## O que foi corrigido e onde o comprador vê

| ID | Local | Antes | Agora |
| --- | --- | --- | --- |
| **N90** (média/UX) | `/loja?categoria=kits` | O título dizia **Todos os Produtos** mesmo mostrando só kits | Mostra **Kits**, com contador de resultados atualizado |
| **N91** (média/conversão) | `/loja?q=banana&categoria=quimica` | Exibia só “Nenhum produto encontrado.”, sem indicar como recuperar a busca | Mostra filtros ativos, **links individuais para removê-los** e uma orientação clara. Remover **Categoria: Química** mantém **banana**, revelando o Kit Banana e Mel. Se estiver vazia, há botão **Ver todos os produtos** |
| **N92** (média/robustez) | URLs `/loja?tiposProduto=tipo-invalido&ordem=nao-existe` | A rota podia mostrar **tipo-invalido como H1** sem filtrar nada, apesar de o validador isolado estar correto | O valor da URL é validado **na entrada e na leitura da tela**; parâmetros desconhecidos não simulam filtros ativos ou ordenação |
| **N93** (média/UX) | `/favoritos` | Lista vazia tinha só um parágrafo e um link discreto; lista com produtos sem contador | Cartão vazio destacado, explicando que os favoritos ficam neste navegador, CTA **Explorar produtos** e contador de salvos quando houver itens |
| **N94** (média/resiliência) | Chips de filtros em `/loja` | Botões de remoção dependiam da hidratação JS, podendo não funcionar se clicados imediatamente em celular | **Links reais** com URL do filtro restante, funcionalidade navegável antes de o JavaScript terminar de carregar; foco e toque acessíveis |

## Evidência antes/depois e segurança

- **TDD RED:** testes de títulos, remoção individual de filtros, estado vazio de Favoritos e URL inválida falharam antes das correções. Também houve reprodução no Chrome do H1 **tipo-invalido**, com `qa-artifacts/vonix-c23/debug-headings/report.json`.
- **TDD GREEN:** 9/9 testes direcionados em `src/test/storefront-search-audit.test.tsx` e `src/test/favorites-page-ux.test.tsx` depois de converter chips para links. `npx tsc --noEmit` exit 0.
- **Chrome real local:** 3/3 em **320, 390, 1366 px**, 15 screenshots e `qa-artifacts/vonix-c23/link-safe/report.json`. Confirma categoria Kits, recuperação de busca banana, rejeição de parâmetros falsos, Favoritos vazio e preenchido, ausência de overflow/erros JS. Todas as requisições para fora de localhost são abortadas. Nenhum cadastro, avaliação, venda, Pix, cartão ou pedido real foi usado.
- **Gates da versão de código original C23:** 648/648 Vitest em 78 arquivos, TypeScript 0, ESLint integral ignorando apenas a regra Prettier histórica 0, build Nitro Cloudflare Module 0, Prettier dos arquivos alterados 0, SSR 42/42 produtos ativos.
- **Arquivos de produção alterados:** `src/routes/loja.tsx`, `src/routes/favoritos.tsx`; novos testes e roteiro Chrome. **Nenhuma alteração a produto, preço, cupom, frete autoritativo, status de pagamento, Appmax, Bling ou banco operacional.**

## Sincronização com upstream e limites

Durante o C23, o repositório original incorporou o **PR #55** (`90d527d`) com link do programa **Seja afiliada** na navegação e seção editorial na home. Essa mudança pertence ao próprio e-commerce (não ao aplicativo independente de inscrições). A tentativa de merge read-only detectou conflito em `src/components/site.tsx` porque a branch auditada conserva alterações extensas no cabeçalho, menu e rodapé. É necessário **reconciliar manualmente**, sem aceitar `theirs` nem apagar a auditoria; somente após isso repetir CI e conferir PR #26. O aplicativo de inscrições de afiliadas externo permanece intocado.

**Não é um redesign completo nem homologação operacional.** Permanecem Appmax sandbox (Pix, cartão, idempotência, expiração e `paid_at`), Supabase staging isolado (RLS, backups e restore), Bling (estoque/SKUs), transportadora/frete real, Worker Cloudflare hospedado, LGPD pós-pedido, WAF e mensuração de compra paga. O repositório tem dívida global antiga Prettier/CRLF; não foi reformatado em massa. Nenhum merge/deploy na main original ou cobranças reais.

## Conciliação controlada com PR #55 (programa de afiliadas presente no e-commerce)

O upstream `90d527d` (PR #55) adicionou uma entrada editorial de afiliadas na home, links em menu desktop/mobile e no rodapé, além de testes e documentação do mesmo repositório. O merge inicial de `src/components/site.tsx` acusou **6 blocos de conflito**, causados pela formatação/estrutura auditada da branch original. Foi comparado previamente o diff do upstream **linha a linha**. Cada uma das quatro referências `/seja-afiliada` (menu desktop, menu móvel, comunidade no rodapé, rodapé jurídico) e o ícone `Sparkles` foram incorporados manualmente ao componente auditado, com layout responsivo que permite quebra de linha. Foram preservados `Preferências de cookies` e o disparo do evento LGPD já auditados, além de atalhos de sacola, pedidos, favoritos e checkout. O arquivo após conciliação foi reconstruído a partir desse código auditado já atualizado, **não** usando resolução cega `theirs/ours`; foi verificada paridade de quatro destinos entre os dois históricos antes de marcar os 6 conflitos como resolvidos.

Os demais arquivos de PR55 (`src/components/affiliate-home-invite.tsx`, `src/routes/index.tsx`, teste e workflow de afiliadas) foram integrados automaticamente. **Nenhum arquivo do aplicativo independente de inscrição de afiliadas foi acessado**; trata-se da vitrine do e-commerce. Nenhum formulário de inscrição, campanha, pagamento ou publicação foi acionado.

**QA após PR55:** 649/649 Vitest PASS em 79 arquivos, TypeScript 0, ESLint não-formatação 0, build Nitro Cloudflare Module 0, SSR 42/42 ativos, Prettier dos arquivos editados 0, Chrome **3/3** em 320/390/1366, com screenshots adicionais em `qa-artifacts/vonix-c23/after-pr55/`. O navegador confirmou os filtros do C23, Favoritos vazio/preenchido, convite editorial na home, link de afiliadas no menu móvel/desktop e no rodapé, todos com rede externa bloqueada. **NOT_APPROVED**: essas provas não são staging ou deploy.

## Conciliação adicional com PR #56

Após integrar o PR55, a `main` avançou para **`15acf96` (PR #56)**, trazendo melhorias de integridade de dados e apresentação da administração de afiliadas já existente no repositório original. O merge incremental foi realizado **apenas na branch de auditoria**, **sem conflitos**, sem acessar o aplicativo independente de inscrições e sem tocar no catálogo, carrinho, checkout ou nas correções do C23.

**Gates repetidos após PR56:** **653/653 Vitest em 79 arquivos**, `npx tsc --noEmit` exit 0, ESLint integral sem a regra histórica de Prettier exit 0, `npm run build` exit 0, Prettier dos arquivos alterados exit 0, SSR **42/42 produtos ativos**. Chrome real local em **320/390/1366: 3/3 PASS**, 20 capturas adicionais e `qa-artifacts/vonix-c23/after-pr56/report.json`, com filtros da loja, Favoritos e links de afiliadas no cabeçalho/rodapé/home. Requisições externas bloqueadas, nenhum pagamento, inscrição, review ou envio operacional real. Os checks de produção seguem não homologados.
