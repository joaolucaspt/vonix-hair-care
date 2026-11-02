# Regra de tipografia (somente 2 formatos)

Todo o site usa **apenas duas fontes**. Nenhuma outra pode ser adicionada.

| Formato | Fonte | Pesos | Onde usar |
|---|---|---|---|
| 1. Títulos | **Playfair Display** | 500 (700 só no preço em destaque dos banners) | h1, h2, h3, nome do produto na página, títulos de seção e preço dos banners (`font-display`) |
| 2. Texto | **Inter** | 400, 500, 600 | menus, botões, cards, preços, formulários, rodapé e qualquer outro texto |

Tamanhos: use só as classes `text-h1`, `text-h2`, `text-name`, `text-price`, `text-body` e `text-small` (definidas em `src/styles.css`).

Imagens (fotos de produto e categorias) **não levam texto desenhado**: o texto fica no código, em uma das duas fontes. Única exceção: a arte dos banners da home (`public/images/banners/*-home.webp`), enviada pela dona da loja, que traz o título dentro da imagem; preço e desconto continuam em HTML.

O teste `src/test/typography.test.ts` falha se alguém usar outra família (`font-mono`, `Georgia`, `Arial` etc.) ou carregar outra fonte no Google Fonts.
