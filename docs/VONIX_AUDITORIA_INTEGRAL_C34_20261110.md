# Vonix Hair — Auditoria geral e rigorosa do e-commerce, checkpoint C34

**Data:** 10 de novembro de 2026. **Código-fonte:** exclusivamente `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR original **#26**. **Base verificada:** C33 `21aa2f0`, worktree limpa, CI 4/4 verde. **Separação obrigatória:** nenhum arquivo do sistema de candidatura de afiliadas, outras worktrees, segredos, banco operacional ou anúncio foi alterado.

## 1. Resumo executivo

O escopo foi a experiência real de compra — navegação, catálogo, produtos, descontos, sacola, informações pessoais, consulta de CEP, frete e checkout — além de SEO, dados estruturados, indexação, feed Meta e integridade do código. **Houve correções e testes reais no código local. Isso NÃO certifica a loja publicada nem prova que problemas de conversão estão resolvidos.**

**Decisão de prontidão: PRODUÇÃO NÃO APROVADA (NOT_APPROVED).** Quatro bloqueios operacionais são intransponíveis por QA sintético: (a) estoque vendável real, por SKU/variante, no Bling; (b) teste autorizado de Appmax Pix/cartão/antifraude e conciliação de pedido pago; (c) dimensões/regras reais de frete em transportadora; (d) homologação do runtime Cloudflare e Supabase isolado. Não mentir sobre disponibilidade, aprovações financeiras ou lucro. Alterações desta auditoria permanecem **somente na branch de PR, sem merge e sem deploy**.

### Resultados comprovados de QA

| Verificação | Resultado | Alcance / limite |
| --- | --- | --- |
| Vitest integral | **690/690 PASS, 83 arquivos** | Código/testes, mocks e fixtures; não confirma terceiros de produção |
| Checkout + servidor, focados | **115/115 PASS em 2 arquivos** | Inclui regressões introduzidas nesta auditoria |
| TypeScript / lint funcional / build | **PASS / PASS / PASS** | 12 avisos legados de React Fast Refresh, 0 erros; build Nitro/Cloudflare local, sem staging |
| Product pages SSR | **42/42 PASS** | Canonical, meta, JSON-LD, resposta HTTP; Plex aposentado 404 |
| Catálogo e assets | **43 cadastros, 42 ativos, 129/129 imagens** | 0 slugs/variantes duplicados, preços inválidos ou imagens ausentes |
| Rotas locais / sitemap | **15/15 HTTP e validação estrutural** | Páginas públicas, privadas sem indexação, 404, robots e sitemap |
| Chrome hidratado | **3/3 vitrine e carrinho; 3/3 checkout** | Viewports 320, 390, 1366 px; rede externa bloqueada; sem pedidos |
| Checkout/carrinho sem JS | **3/3 verificações do HTML `noscript`** | Conteúdo de fallback presente em SSR; visibilidade real no parser com JS desativado **não confirmada** |
| Meta CSV local | **42 itens, 0 divergências/duplicatas** | Títulos, IDs, imagens, preços, links e descrições; sem inventário real |
| Meta CSV público | **42 itens, 0 divergências/duplicatas** | GET read-only do catálogo publicado; 42/42 alegações `in stock` sem Bling validado |
| Site público GET | **6/6 respostas HTTP 200** | `/`, `/loja`, um PDP, carrinho, checkout e CSV Meta; não prova hidratação/conversão |

**Evidências:** `docs/VONIX_SSR_PREFLIGHT_C34_20261110.json`, `docs/VONIX_META_FEED_READINESS_C34_20261110.json`, `docs/VONIX_META_FEED_PUBLIC_C34_20261110.json` e `qa-artifacts/vonix-c34` (logs, screenshots, status e QA). O recibo com hashes está em `docs/VONIX_C34_VERIFIED_RECEIPT_20261110.json`.

## 2. Defeitos reais demonstrados e corrigidos neste ciclo

| ID | Severidade | Achado (prova antes do patch) | Correção local / resultado |
| --- | --- | --- | --- |
| **N141** | **P1 — checkout** | WhatsApp com DDD inexistente ou malformado passava da UI e alcançava o mock de pagamento. Teste RED. | `checkout-input-validation.ts` compartilhado; valida DDDs brasileiros, celular de 11 dígitos, WhatsApp Business fixo de 10 e prefixo opcional `+55`. Campo corrigível e foco. Backend valida/normaliza também. |
| **N142** | **P1 — dados de entrega** | Rua apenas com espaços passava da UI; Zod no servidor aceitaria rua/número/bairro/cidade compostos só por espaços. Teste RED. | `hasDeliveryAddress` na UI e `z.string().trim().min(1)` no servidor; não envia pedido com endereço vazio. |
| **N143** | **P1 — UF** | `XX` era aceito pelo botão de pagamento e pelo esquema que verificava só tamanho 2. Teste RED. | UF precisa pertencer às 27 unidades federativas; servidor normaliza maiúsculas; erro claro e foco. |
| **N144** | **P1 — nome de cliente** | Nome de espaços passava do evento de submit e só seria rejeitado tarde. Teste RED. | Trim/validação antes da tentativa na interface e no Zod; mensagem para corrigir o nome sem cobrar. |
| **N145** | **P1 — frete no produto** | `ShippingCalc` usava `Promise.all` para endereço + transportadora. Se endereço não respondesse, botão `Calcular` ficava desabilitado mesmo com quote pronta. Teste RED. | Consultas independentes; frete concluído não fica esperando consulta postal. Teste GREEN. |
| **N146** | **P1 — resiliência do frete** | Uma promessa de transportadora sem resolução mantinha indicador ativo indefinidamente. Teste RED. | Limite local de 12 segundos; restaura botão, descarta resposta antiga e oferece recalcular. Não cancela eventual operação já recebida pelo provedor; apenas impede resultado obsoleto na UI. |
| **N147** | **P2 — sem JavaScript** | Carrinho/checkout SSR exibiam somente área vazia sem orientação, 3/3 baselines RED. | `<noscript>` com explicação e link para loja nos placeholders SSR; markup verificado no HTML. **Não declarar como prova visual de navegadores com JS realmente desligado:** Chrome CDP mantém conteúdo de `noscript` como texto bruto no DOM. |

As novas verificações de formulário e frete foram executadas com **dados sintéticos e sem chamadas de pagamento**. Os testes alvos passaram **115/115** e o conjunto integral **690/690**. Nenhuma configuração de pagamento, preço comercial nem anúncio foi modificada.

## 3. Integridade de catálogo, SEO e conteúdo

- Produtos: **42 SKUs ativos**, Plex Vonix excluído por configuração explícita, HTTP 404 para `/produto/plex-vonix`, ausente de sitemap e feed local. Não interpretar isso como status de estoque dos outros 42.
- Mídia: **129 referências a arquivos locais presentes**, sem caminho externo ou arquivo vazio nas 43 entradas do JSON. Isso verifica existência, **não** qualidade da fotografia, dimensões de imagem, compressão ideal ou autorização de uso.
- Estrutura: **15 rotas GET** válidas; cabeçalhos básicos de canonical/robots e sitemap no ambiente local.
- Preços e feed: versão pública e local apresentam **42 linhas sem diferenças de identificador, título, imagem, preço, preço promocional ou URL** contra o catálogo lido. A existência de CSV correto **não comprova** atualização em tempo real nem estoque para entrega.
- Conteúdo e avaliações: o PDP possui structured data e avaliações, mas **a procedência individual de depoimentos/estrelas exige comprovação documental antes de campanha baseada em reviews**. Nenhum comentário foi fabricado ou alterado nesta sessão.

## 4. Achados operacionais ainda abertos: nenhum foi declarado resolvido

| ID | Prioridade | Evidência verificada / limitação | Critério mínimo de fechamento |
| --- | --- | --- | --- |
| **P0-ESTOQUE** | **Crítico** | Feed **público e local** publica **42/42 `in stock`**, mas este repositório só exclui estática e manualmente `plex-vonix`. **Não foi consultado saldo vendável atual no Bling**. Não afirmar falta de estoque, apenas que disponibilidade prometida está sem prova. | Exportar/listar SKU e variante, saldo vendável, reservas, sincronização, prazo e mapa de IDs no Bling; comparar 42/42; corrigir `availability` por SKU com aprovação das campanhas e validar GET Meta publicado após o deploy autorizado. |
| **P0-PAGAMENTO** | **Crítico** | CI e mocks estão verdes, mas **não foi feito pagamento homologado Appmax**, antifraude, Pix ou cartão; nenhuma evidência de ordens pagas ou erros reais recuperada. | Aprovar ambiente sandbox; realizar testes isolados de Pix, cartão, recusas, timeouts, duplicidade, cancelamento, webhook, `paid_at`, reconciliação do snapshot e estorno, sem expor dados reais. Documentar recibos e autorização formal. |
| **P0-FRETE** | **Crítico** | Código `melhorenvio.server.ts` contém defaults `16×12×22 cm` e `0,6 kg` por unidade, marcados explicitamente como suposições. Sem medidas por SKU/embalagem e sem cotações reais autorizadas. | Conferir peso/dimensão reais das variantes e kits, multiplicadores, CEP origem, retorno PAC/Jadlog, prazo, frete grátis por condição e consistência final do checkout em staging. |
| **P0-STAGING** | **Crítico** | Build Nitro/Cloudflare local verde. Não há comprovação de Worker/WAF/CPU, Supabase RLS, migrações, restore, idempotência e segurança de produção. A tentativa histórica de `vite preview` do adaptador atual gerou HTTP 500 (expectativa `dist/server/server.js`) — não usar como aprovação de runtime. | Staging isolado com migração e restore, smoke SSR, quotas/timeout, erros 500, antifraude, headers/CSP, observabilidade e rollback. Sem escrita em banco operacional. |
| **P1-PUBLICAÇÃO** | Alta | GET read-only em **10/11/2026** encontrou 6/6 rotas públicas com HTTP 200, mas `/carrinho` e `/conta` não tinham meta `robots=noindex` nem header `X-Robots-Tag`; `/checkout` tinha meta `noindex`. A branch já contém noindex dessas páginas (ciclos anteriores). | Após aprovação de staging e publicação segura, confirmar headers/metas de `/carrinho`, `/checkout`, `/conta` e páginas privadas. Resposta 200 sozinha não prova checkout utilizável. |
| **P1-PUBLICAÇÃO-C34** | Alta | Correções N141–N147 estão no **PR, não no site publicado**. Site público continua distinto do checkout auditado. | Integrar somente após gates P0 + testes da implantação, aprovar rollout e rollback. Não afirmar 'corrigido em produção' antes de smoke do domínio publicado. |
| **P1-MENSURAÇÃO** | Alta | Não foi possível reconciliar os eventos GA4/Meta por sessão, canal, carrinho, checkout e pedidos efetivamente pagos. O CAPI e pixel possuem testes, mas métricas reais de conversão não foram acessadas. | Comparar `InitiateCheckout`, `Purchase`, deduplicação, consentimento e ordens confirmadas por data/canal sem expor PII. Diagnosticar custo por compra e erro de pagamento com dados confiáveis. |
| **P2-COMPLIANCE** | Moderada | Origem/permissão de depoimentos, consentimento LGPD por sessão e revogação pós-pedido ainda não homologados externamente. | Obter consentimentos/autorização e auditar fluxo de retirada, retenção e propagação de eventos; eliminar afirmações sem prova. |
| **P2-QA** | Moderada | 12 warnings históricos de `react-refresh/only-export-components`; 0 erros. A validação de `noscript` no Chrome com JS via CDP bloqueado comprova HTML, **não** renderização visual com o parser JS realmente desligado. | Remover warnings sem regressão; complementar teste manual em navegador configurado para desabilitar JavaScript se esse público for alvo. |

## 5. Comparação local versus público (somente leitura)

HTTP 200 confirmado em **`/`**, **`/loja`**, **`/produto/kit-banana-e-mel`**, **`/carrinho`**, **`/checkout`** e **`/api/public/meta-catalog`** em `https://vonixhair.com`; nenhuma requisição de pagamento, POST, atualização de anúncio, dados de cliente, login ou extração de pedidos foi executada. O feed público contém 42 produtos, com 42 `in stock` e 0 divergências de formato/conteúdo em relação ao catálogo desta auditoria. Esse alinhamento **não confirma integração ERP nem disponibilidade física**.

As diferenças de indexação indicam que a branch em revisão ainda não substitui integralmente o site publicado. A meta `noindex` ausente em carrinho e conta públicos é problema de higiene SEO, mas `robots.txt` ainda pode impedir rastreamento e os mecanismos de busca não necessariamente indexaram essas páginas. Não declarar dano em ranking sem dados do Search Console.

## 6. Go / no-go e sequência recomendada

**NO-GO** para afirmar operação "100% resolvida hoje". A ordem de execução autorizada em ambiente seguro deve ser: (1) conciliação de estoque Bling↔Meta por SKU; (2) Appmax sandbox real e pedido pago simulado; (3) peso/dimensões e frete de transportadora; (4) staging Cloudflare/Supabase e rollback; (5) medição GA4/Meta reconciliada com financeiro; (6) deploy/merge **somente com autorização operacional**; (7) smoke no domínio público e liberação monitorada.

A correção dos bugs locais não substitui essas etapas. Nenhuma margem, ROAS ou causa específica da ausência de vendas foi inferida sem evidência. As evidências do C34 são reproduzíveis com os scripts `scripts/qa-c34-*.mjs`, logs de 690 testes e relatórios estruturados. **Não houve merge, deploy, pagamentos, pedidos, cotação externa real, acesso a segredos ou alteração no sistema independente de afiliadas.**
