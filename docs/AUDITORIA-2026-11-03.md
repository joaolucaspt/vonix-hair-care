# Auditoria do vonixhair.com — 03/11/2026

Cobertura: home, loja, 3 produtos, carrinho, checkout, Sobre, Contato, Trocas (desktop e 375 px), cabeçalhos HTTP, SEO, rastreamento. Não passei por todos os 43 produtos um a um.
Livros: Gatilhos Mentais (trechos: autoridade, prova social, escassez, garantia, simplicidade), Larrossa e Brunson (sumário + capítulos de pixel, tráfego próprio, follow-up), Cialdini (princípios; não reli o texto inteiro).

## 1. Crítico

1. **Não dá para comprar.** O checkout diz "Ambiente de testes" e "Estamos ativando os pagamentos", mas mostra "Compra 100% segura · Appmax". Ativar Appmax antes de reabrir; tirar o aviso.
2. **Sem Pixel da Meta.** Só GA4 e Clarity. Sem pixel não há remarketing nem otimização dos anúncios (Larrossa: Pixel e públicos; Brunson: retargeting).
3. **IDs do rastreio ≠ catálogo da Meta.** O site envia `progressiva-fio-de-luz`; o catálogo usa `VONIX-PROGRESSIVA-FIO-DE-LUZ`. Mesmo erro do diagnóstico de 12/10, ainda não corrigido.
4. **Prévia ao compartilhar quebrada.** `og:image` das páginas de produto é caminho relativo (`/images/...`); WhatsApp/Facebook precisam de URL completa. A da home é PNG de 622 KB em servidor externo (WhatsApp tende a ignorar acima de ~300 KB). Isso enfraquece o botão Compartilhar.

## 2. Importante

5. **Preço "de/por"** (ex.: R$ 197,90 → R$ 164,90, −17%): o "de" precisa ser preço realmente praticado antes (CDC/Procon). Confirmar.
6. **Card de produto poluído**: até 5 selos (−%, frete grátis, Leve 2/3, Pix −5%, vendidos). Gatilho da simplicidade: menos é mais. Estrelas vazias (☆☆☆☆☆) em produto sem nota parecem "ninguém gostou": esconder.
7. **Repetição na home**: Banana e Mel 3×, Fio de Luz e Botox Vonix 2×.
8. **Garantia escondida.** Troca só aparece dentro do acordeão "Entrega e troca". Gatilhos (cap. Garantia/reversão de risco): colocar "7 dias para devolver" perto do botão Comprar.
9. **Autoridade fraca.** Sobre: "Feita para quem busca realçar sua beleza" — sem história, tempo de mercado, nº de cabeleireiras atendidas, CNPJ/endereço.
10. **Prova social curta.** "58 vendidos" é ótimo (número real). Só 4 depoimentos, de texto. Há 3 vídeos de depoimento (um com 11 MB); usar na página do produto. Estrutura que funciona: quem é, como era, como ficou.
11. **Cadastro 5%** está bom (reciprocidade), mas sem follow-up (Brunson): e-mail/WhatsApp de boas-vindas e lembrete do cupom. Confirmar se `LEAD_WEBHOOK_URL` está configurado.
12. **Avaliações na hora** dependem do banco (Supabase) que ainda não foi ligado.

## 3. SEO e técnico

13. Meta description muito curta (24–51 caracteres) nos produtos e institucionais.
14. Sem `canonical` na home, loja, Sobre, Contato e políticas.
15. H1 da /loja muda conforme a audiência ("Para Mim — Cuidados em Casa"): ruim para Google.
16. JSON-LD do produto: imagens relativas; sem nota agregada, frete e devolução.
17. Cabeçalhos de segurança ausentes: CSP, X-Frame-Options, Permissions-Policy.
18. Desempenho: Clarity (12/10) LCP 4,7 s, INP 420 ms, CLS 0,35. Hoje medi CLS 0,069 e LCP 0,6 s só com cache (sem teste frio). Imagens: 14,2 MB; banners PNG de 370–530 KB (usar WebP); foto de 1080 px num quadro de 181 px; vídeo de 11,4 MB.
19. Mobile: ~30 alvos de toque abaixo de 32 px na home/loja (ideal 44 px); texto de 9,5–10 px nas bandeiras de pagamento.
20. Sem página 404 própria conferida (retorna 404 correto; visual não avaliado).

## 4. Pontos fortes (manter)

Preço, Pix e parcelamento claros; desconto por quantidade (contraste/âncora); frete grátis visível; compra sem login; WhatsApp flutuante; vendas reais mostradas; sitemap e robots corretos; HTTPS com HSTS; nenhuma imagem quebrada; sem rolagem lateral; textos alternativos em todas as imagens.

## 5. Comparação (Lola, Wella)

Nenhum dos dois mostra avaliações na vitrine; a Lola usa cupom de 1ª compra fixo na barra do topo, cashback e conteúdo educativo (glossário). Ideias para copiar: cupom 5% na barra do topo; página "Como usar / dúvidas" por tipo de cabelo; feed do Instagram no site.

## 6. Dicas de crescimento (livros)

- **Cliente-sonho** (Brunson): separar cabeleireira (profissional) de consumidora final, com mensagens diferentes.
- **Gancho, história, oferta** nos anúncios: antes/depois real + oferta Leve 2/Leve 3.
- **Tráfego próprio**: lista de e-mail/WhatsApp com o cadastro dos 5%.
- **Dream 100**: parcerias com cabeleireiras e salões grandes.
- **Escassez só se real** (Gatilhos): "frete grátis até domingo", estoque real. Nada de contador falso.
- **Pós-venda**: pedir avaliação pelo WhatsApp 7 dias depois (único jeito honesto de subir a nota).
- **Conversa no WhatsApp** (Larrossa): catálogo + resposta rápida + roteiro de fechamento.

## 7. Feito na branch `fix/auditoria-melhorias` (nada publicado)

- Rastreio: código do catálogo da Meta (`VONIX-...`) em todos os eventos; Pixel da Meta pronto, só falta o ID em `META_PIXEL_ID` (src/lib/analytics.ts). Kits usam `VONIX-COMBO-...` (suposição pelo padrão do catálogo; conferir).
- Prévia ao compartilhar: og:image com endereço completo nos produtos; imagem nova da home (74 KB, `public/og-vonix.jpg`).
- SEO: canonical em home, loja e páginas institucionais; descrições mais completas; JSON-LD com imagens completas, nota real (só onde há avaliações) e política de devolução de 7 dias.
- Home: "Todos os Produtos" não repete os produtos das vitrines de cima. Cards sem as cinco estrelas vazias.
- Produto: linha "7 dias para desistir da compra, conforme a lei" ligada à política.
- Sobre: "milhares de pessoas" trocado por "mais de 480 produtos vendidos" (número real).
- Segurança: cabeçalho que impede o site de ser embutido em sites de terceiros (a prévia da Lovable continua liberada) e limita câmera, microfone e localização.
- Corrigido erro meu: acentos quebrados ("Ã£") na tela de erro 404 e na roleta de ofertas.

## 8. Não feito (depende de você ou de decisão)

- Ativar a Appmax e tirar o aviso de "Ambiente de testes" (precisa das chaves, que você digita).
- Confirmar que o preço "de" é real. Confirmar "Cada produto é testado" e "sustentabilidade" na página Sobre (não consegui verificar).
- Pixel da Meta: informar o ID do Pixel.
- Banco das avaliações (Supabase) e e-mail de boas-vindas do cupom.
- Imagens pesadas (banners PNG, vídeo de 11 MB), alvos de toque pequenos e CSP completa: ficam para uma próxima rodada.