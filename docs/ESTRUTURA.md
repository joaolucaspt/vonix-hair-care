# Vonix Hair: estrutura do site novo e regras de negócio

Repositório: `lucassilva1175/vonix-hair-care` (branch `feat/clarity-analytics`, pull request 1, ainda sem merge).
Site publicado hoje: o antigo (`vonixhaircosmeticos.com.br`). **Não fazer merge antes de ligar pagamento e frete.**

## Como rodar a prévia
`npm install` e `npm run dev -- --port 5173`. Os testes: `npx vitest run` (38 testes).

## Mapa do código (`src/`)
| Pasta / arquivo | Para que serve |
|---|---|
| `routes/index.tsx` | Página inicial: banner, vantagens, Mais Desejados, Todos os Combos, tratamento ideal, depoimentos |
| `routes/loja.tsx` | Loja: fileiras por categoria (carrossel); grade quando há busca ou filtro |
| `routes/produto.$slug.tsx` | Página do produto: galeria com lupa, preços, Leve 2/3, frete, abas de detalhes, avaliações |
| `routes/carrinho.tsx`, `checkout.tsx` | Carrinho e checkout (frete Melhor Envio, Pix e cartão Appmax, cupons) |
| `routes/api.public.appmax-webhook.ts` | Recebe avisos da Appmax (reconfirma o pedido na API) |
| `routes/sitemap[.]xml.ts`, `public/robots.txt` | SEO |
| `components/site.tsx` | Cabeçalho, rodapé, cartão de produto, carrossel, estrelas, formas de pagamento |
| `components/product-details.tsx` | Grade de informações e abas do produto |
| `components/product-gallery.tsx` | Galeria com lupa (zoom no mouse, tela cheia no celular) |
| `components/reviews.tsx` | Depoimentos reais (vídeo e foto) |
| `components/prize-wheel.tsx` | Roleta de ofertas |
| `lib/store.ts` | Regras de preço, áreas casa/salão, ordem dos produtos, carrinho |
| `lib/coupons.ts` | Cupons e chances da roleta |
| `lib/checkout.functions.ts` + `*.server.ts` | Servidor: recalcula preços, cupom, frete, pagamento |
| `lib/analytics.ts` | Eventos do Google Analytics e do Clarity |
| `data/products.json` | 43 produtos (textos profissionais) |
| `data/reviews.json` | Avaliações reais (só as que têm vídeo ou foto) |
| `public/depoimentos/` | Vídeos e foto dos depoimentos |

## Regras de negócio
- **Duas áreas** (escolha por visita): *Para mim* e *Para cabeleireiras*. As duas listam os 43 produtos; muda a ordem (casa: progressivas e botox por último; salão: produtos profissionais primeiro).
- **Área das cabeleireiras:** Leve 2 com 12% e Leve 3 com 15% em todos os produtos. Sem os 5% de antes. Não soma com Pix nem cupom.
- **Pix:** 5% de desconto nos itens sem outra oferta. **Cartão:** até 6x sem juros.
- **Frete grátis:** acima de R$ 150 em produtos, calculado **antes** dos descontos (vale a opção mais barata).
- **Roleta:** abre 8 s após a entrada, 1 giro por aparelho, cupom por 7 dias.

| Cupom | Desconto | Mínimo | Chance |
|---|---|---|---|
| GIRA3 | 3% | nenhum | 25% |
| GIRA4 | 4% | R$ 99 | 25% |
| GIRA5 | 5% | R$ 150 | 25% |
| GIRA6 | 6% | R$ 250 | 25% |
| BT10 (Bela, digitado à mão) | 10% | nenhum | fora da roleta |

  O cupom incide só em itens sem oferta e soma com o Pix. Testado contra os 43 produtos: nenhuma combinação dá prejuízo (pior caso: Combo Monovonix 500 ml, preço baixo).
- **Estrelas:** só mostram nota onde há avaliação real. Nunca inventar nota.
- Textos de produto: só fatos do guia do atendente e do catálogo; ingredientes (INCI) ficam no rótulo.

## Pendências antes de publicar
1. Segredos no Lovable: `APPMAX_*`, `MELHORENVIO_TOKEN`, `STORE_ORIGIN_CEP` (ver `.env.example` e `INTEGRACOES.md`) e teste em sandbox.
2. Confirmar com a fábrica: quais produtos têm formol, lista INCI e notificação Anvisa de cada um.
3. Medidas e pesos reais das embalagens (frete).
4. Autorização escrita de quem aparece nos depoimentos. **Contrato da Bela Tiozzo:** não republicar vídeos dela (cláusulas 5.2 e 6); o cupom **BT10** (10% para o cliente, sem mínimo, fora da roleta) vale só para o tráfego e os criativos dela.
5. Subir o preço do Combo Monovonix (planilha `precificacao-vonix.xlsx`).
6. Migrar Meta Pixel e Utmify do site antigo.
7. Confirmar com o contador a regra da roleta (promoção com sorteio).
8. Bandeiras de cartão e boleto: confirmar na Appmax antes de mostrar.
9. Banner do Kera+ (precisa da arte).
