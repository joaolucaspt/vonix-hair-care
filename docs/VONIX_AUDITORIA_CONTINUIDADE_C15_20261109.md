# Vonix Hair — C15: experiência de compra da main conciliada com checkout seguro

**Data:** 09/11/2026 · **Escopo:** e-commerce (não sistema de afiliadas) · **Branch:** `fix/vonix-ecommerce-auditoria-2026-11-09` · **Base C14:** `b61087c` · **PR:** #26.

## Resultado verificável

A evolução C15 portou **seletivamente** o componente de gaveta `Comprar agora` e o helper de sugestões por afinidade da `main` mais recente para o e-commerce auditado. O acionamento na página do produto passou a abrir a gaveta com itens e opções de quantidade; somente o botão explícito **Ir para o pagamento** navega para `/checkout`. O checkout da auditoria **não foi substituído**: mantém token assinado de status, armazenamento local de tentativas pendentes, cotação server-side, idempotência, proteção de duplicação de cobrança, snapshot de valor original e regras de consentimento.

### N58 — gaveta tinha promessa de frete sem cobertura verificada

A versão de origem anunciava **Você ganhou frete grátis!** apenas com o total do carrinho, sem cotar CEP, e calculava o progresso sobre `netSubtotal` embora a regra comercial use `subtotal` bruto de produtos. A gaveta adaptada usa **subtotal bruto**, informa apenas o alcance do mínimo e exige **cotação do CEP para cobertura, valor e prazo**. Nenhum valor ou prazo é inventado. O checkout continua consultando transportadora antes da compra.

### N59 — consentimento interceptava o pagamento no mobile

Na primeira execução Chrome real, a faixa de privacidade `z-[100]` impediu clicar no botão inferior da gaveta `z-[90]` em 390 px (Playwright detectou interceptação de ponteiro), enquanto um ensaio inicial em 320 px não encontrou a gaveta após clique em ambiente dev. Alteramos a gaveta para `z-[110]`, mantendo aviso de privacidade disponível quando o modal é fechado. Repetição com fluxo explícito de **Recusar opcionais** no viewport 320 e consentimento ainda aberto nos outros viewports: **3/3 PASS**.

### N60 — acessibilidade e compras adicionais

Controles de fechar, incrementar/reduzir quantidade e adicionar sugestões têm alvos de aproximadamente 44 px; Escape fecha, Tab/Shift+Tab circula entre controles, foco retorna ao acionador. Sugestões por afinidade excluem SKUs não vendáveis, itens já no carrinho e repetições. Testes preservam a correspondência da progressiva com o shampoo relacionado; isso **não é** comprovação técnica de compatibilidade química, nem recomendação profissional.

### N61 — integração com `main` ainda não pode ser mesclada automaticamente

A `origin/main` local avançou até `e70dbe8` (o commit mais recente nessa observação incorpora PR #43 de afiliadas, sem alteração nossa). `git merge-tree --write-tree HEAD origin/main` detectou **três conflitos de conteúdo**: `src/lib/checkout.functions.ts`, `src/routes/checkout.tsx` e `src/routes/produto.$slug.tsx`. A versão nova de checkout compacto de `main` não inclui as proteções financeiras que a auditoria reforçou em C11–C14. Resolver os conflitos simplesmente escolhendo `theirs` ou substituindo o checkout da auditoria seria inseguro. C15 entrega a gaveta e o funil seguro **na branch do PR**, mas **não declara a integração do PR à main pronta**.

## Evidências C15

- **Vitest completo:** **535/535 PASS em 66 arquivos**, exit 0. Inclui dois arquivos novos de teste da gaveta e do helper de upsell.
- **Verificação direcionada:** 10/10 testes PASS; TypeScript `npx tsc --noEmit` exit 0; ESLint direcionado e Prettier dos arquivos alterados exit 0.
- **Build Vite/Nitro Cloudflare:** exit 0, local, sem deploy.
- **SSR catálogo:** script `scripts/audit-ssr-storefront-c3.mjs` retornou exit 0, **42 produtos vendáveis**, sem falhas; `plex-vonix` continua excluído. Recibo C3 gerado por script teve apenas timestamp restaurado ao valor rastreado anterior, sem alterar o conteúdo funcional.
- **Chrome sintético na prévia de desenvolvimento:** `scripts/qa-c15-buy-drawer.mjs`, larguras **320/390/1366 px**, 3 PASS/0 FAIL; seis screenshots `drawer-*.png` e `checkout-*.png`; nenhum erro JS de página, overflow horizontal ou perda do carrinho. Requisições externas do navegador foram **bloqueadas**. Nenhum gateway recebeu submissão de compra.
- **Limite de prévia de produção:** `vite preview` devolveu HTTP 500 nas três larguras porque espera `dist/server/server.js`, enquanto Nitro gerou `.output/server/index.mjs` para **Cloudflare Module Worker**. O preset recomenda Wrangler local, que **não está instalado**. Erro de compatibilidade da prévia, **não evidência de erro de produção**; um browser smoke do **bundle Cloudflare** permanece não verificado. Relatório negativo mantido em `qa-artifacts/vonix-c15/production-preview/report.json`.

## Portas operacionais P0 ainda abertas

Appmax sandbox (Pix, cartão, antifraude, `payment.paid_at`, timeout/estorno); Supabase staging com backup/restore, RLS, migrações e concorrência; Bling homologado e estoque/peso/dimensões reais por SKU; conformidade LGPD e revogação tardia de consentimento; WAF/rate limit distribuído; propriedade GA4 e conciliação de pedidos **pagos** versus sessões e abandono do funil. **Testes sintéticos e interface premium não comprovam recuperação de vendas.** Não executar merge da main, deploy, cobranças reais ou SQL de produção com esta evidência.

## Arquivos alterados por C15

`src/components/buy-drawer.tsx`, `src/lib/upsell.ts`, `src/routes/produto.$slug.tsx`, `src/test/buy-drawer-safety.test.tsx`, `src/test/upsell-safe.test.ts`, `scripts/qa-c15-buy-drawer.mjs`, `qa-artifacts/vonix-c15/` e esta documentação. **Nenhum arquivo exclusivo de afiliadas modificado.**
