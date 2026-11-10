# Vonix Hair — C25: galeria de fotos e sacola vazia (10/11/2026)

**Projeto exclusivo:** e-commerce Vonix Hair, `C:\Users\JL\code\vonix-hair-care`; branch `fix/vonix-ecommerce-auditoria-2026-11-09`; PR #26. **Base certificada:** C24 `916d6e0`. Sem modificar o aplicativo independente de inscrições para afiliadas ou qualquer projeto paralelo. **Produção NOT_APPROVED**.

## O que o cliente consegue ver

| Problema | Local da loja | Antes | Depois |
| --- | --- | --- | --- |
| **N98 — zoom da foto com foco incorreto** | Página do produto, botão **Ampliar** | No desktop, o zoom abria com foco ainda na foto, não no botão de fechar; não havia controle adequado de Tab/Shift+Tab nem restituição garantida do foco | Foto passou a ser **botão HTML nativo**; visor ampliado inicia com foco em **Fechar**, aceita Escape, contém Tab/Shift+Tab no diálogo, restaura a rolagem e devolve o foco ao controle de origem. Botões do visor medem no mínimo 44×44 px |
| **N99 — miniaturas sem estado e estrutura interativa confusa** | Fotos/miniaturas do PDP | Área clicável `role=button` continha botões de navegação internos; miniaturas não anunciavam a foto selecionada | Botão da foto e setas agora são **irmãos**, sem botão dentro de botão; miniaturas identificam `imagem X de N` e `aria-pressed` indica a seleção |
| **N100 — carrinho vazio com saída pouco clara** | `/carrinho`, quando não há itens | Só texto **Seu carrinho está vazio** e um pequeno link genérico | Cartão acessível com título **Sua sacola está vazia**, orientação sem promessas de entrega e botões **Explorar produtos** e **Explorar kits** (link válido para `/loja?tiposProduto=Kits`) |

**Importante:** não houve recalculo inventado de preço, frete, promoção ou produto. Não foram alterados gateways, banco, estoque ou regras comerciais. Um estado vazio melhor não representa pedido confirmado.

## Prova reproduzível

- **Antes (RED):** no Chrome de 1366 px a foto ampliada abriu com foco em **Ampliar imagem do produto** em vez do botão de fechamento; no script inicial de 320/390 o clique antes da hidratação causou timeout (problema de sincronização do roteiro, não atribuído ao produto). O novo teste de carrinho vazio falhou **1 vez antes da correção**, por ausência do título e CTAs.
- **Depois (GREEN):** `qa-artifacts/vonix-c25/final/report.json` confirma **3/3 PASS** (320,390,1366 px), foto modal focada em **Fechar**, Shift+Tab contido, Escape com foco restaurado, botão de fechar pelo menos 44×44, bloqueio/restauração de rolagem, sacola vazia com links, nenhum erro JavaScript e requisições externas bloqueadas. Os arquivos `gallery-open-*.png`, `gallery-closed-*.png` e `cart-empty-*.png` somam **9 capturas finais**.
- **Testes de regressão:** `src/test/product-gallery-audit.test.tsx` verifica semântica da foto e miniaturas, zoom e fechamento. `src/test/checkout-audit.test.tsx` verifica a sacola vazia sem permitir checkout nem iniciar pagamento.
- **Gates C25:** **659/659 testes Vitest em 81 arquivos**, TypeScript 0, ESLint integral com apenas a regra Prettier histórica desligada 0, Prettier dos editados 0, build Nitro/Cloudflare Module 0, SSR **42/42 produtos ativos**, Chrome **3/3**, `git diff --check` 0. O Worker hospedado não foi testado, apenas build local.

## Arquivos de implementação

`src/components/product-gallery.tsx` — zoom, foco e miniaturas.

`src/routes/carrinho.tsx` — estado vazio e caminhos para catálogo.

`src/test/product-gallery-audit.test.tsx` e `src/test/checkout-audit.test.tsx` — regressões.

`scripts/qa-c25-gallery-cart.mjs` e `qa-artifacts/vonix-c25/` — fluxo Chrome e capturas.

## Riscos que ainda impedem produção

**NOT_APPROVED** até validar Appmax sandbox (Pix, cartão, autorização, antifraude, expiração, idempotência e `paid_at`), Supabase staging isolado (RLS, concorrência, backup/restore), Bling (SKUs, estoque, pesos e dimensões), frete real por transportadora/CEP, Worker Cloudflare hospedado, LGPD de consentimento pós-compra, rate-limit/WAF distribuído e reconciliação de conversões pagas GA4/Meta. A dívida antiga de Prettier/CRLF permanece fora do escopo. Isto **não é reformulação premium completa** de home, design de marca e checkout visual; é um ciclo de correções comprovadas em duas áreas.
