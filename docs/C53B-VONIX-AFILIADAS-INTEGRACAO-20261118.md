# C53B — Integração do redesenho do portal Vonix Hair Afiliadas

**Data:** 18/11/2026. **Escopo:** apenas `/seja-afiliada`, componentes de apresentação pública e testes associados.

## Base e referência

- Commit principal do Lovable C53 verificado: `90e84cba0ab8c7f3cb3013a6e62d2e80b76a9c47`.
- Referência de experiência/editorial: https://skence.com.br/pages/skence-creators
- Conteúdo visual **somente da própria Vonix**: `public/images/products` já existente.
- Origem verificada das avaliações públicas: https://vonixhair.com/produto/botox-vonix e https://vonixhair.com/ (consulta externa de 18/11/2026).
- Não reproduz imagens, prova social, métricas, condição comercial ou cupom da Skence.

## Diferenças conciliadas em relação ao C53 do Lovable

1. Quatro cards de temas da seleção voltam a apresentar fotos reais de produtos oficiais com WebP preferencial e JPG de fallback, legendas reais e carregamento lazy. O C53 do Lovable tinha retirado as fotos dos cards, mas mantido a legenda sobre elas.
2. No bloco de produtos editoriais, inseridas **três avaliações publicadas sobre Botox Vonix** (Fernanda Assis, Ayla Muniz e Mariana Andrade), com link direto à página da loja oficial. Datas correspondem às avaliações exibidas nessa página. Os comentários estão explicitamente rotulados **como avaliações de produtos**, nunca como depoimentos de afiliadas ou prova de comissões, ganhos ou desempenho do programa.
3. Fórmula de simulação ilustrativa movida para `src/lib/affiliate-marketing-math.ts`, exclusiva do marketing, evitando warning de Fast Refresh e sem efeito nos sistemas de comissionamento/pagamento reais.
4. Teste de fronteira/marketing C53 atualizado para verificar as quatro imagens dos cards, as três avaliações reais, a fonte e o aviso de que não correspondem a resultados de afiliadas. Teste matemático passa a importar função pura do módulo exclusivo.

## Invariantes de segurança e operação

- Preservados: formulário simplificado real; gates de inscrição aberta/limitada/fechada; prévia sem POST; requisito Instagram; TikTok opcional; verificação por código; Auth, Supabase, dados pessoais, admin e senhas.
- Sem alterações em checkout, pagamentos, frete, carrinho, produtos/preços, banco de dados, integrações, e-commerce e `.env`.
- Não criados depoimentos de afiliadas, fotos de creators, provas de faturamento, cupons, dados fictícios de público ou garantia de aprovação.
- Cálculo de 8%, bônus condicional de R$500 por R$10.000 e supervisão expressamente dependem de aprovação, vendas pagas/confirmadas e regras efetivas; não é promessa de receita.

## Evidências

- Base Lovable `90e84cb`: **722/722 testes aprovados**, TypeScript OK, em clone limpo no computador.
- Após C53B: **723/723 testes (75 arquivos)**, TypeScript OK, lint dos arquivos alterados sem erros/avisos e build aprovado (validar novamente após atualização de import).
- Chrome headless (sem tocar no monitor direito): **360×780, 390×844, 768×1024 e 1440×900**: HTTP 200, `scrollWidth = clientWidth`, zero erros JS, quatro fotos nos cards carregadas após entrar no campo visual, três avaliações corretamente rotuladas, CTA de inscrição no primeiro viewport e simulador funcionando.
- Valor de teste do simulador: R$10.000 em vendas hipotéticas → R$800 comissão ilustrativa, R$500 bônus condicional e R$1.300 soma demonstrativa.
- Evidência local, não commitada: `C53-final-browser-QA.cjs` e `C53-final-browser-screenshots` (tamanhos 360, 390, 768 e 1440).
- O primeiro QA foi intencionalmente corrigido para exercitar **carregamento lazy sob scroll**, sem desativar lazy loading nem alterar o app para acomodar o teste.

## Publicação

Exigir CI do PR, merge seguro da branch de integração, deploy via Lovable e verificação real do bundle + respostas HTTP no domínio `vonixhair.com`. Não anunciar publicação antes do read-back.

## Materiais ainda inexistentes

Não há evidências/autorizações suficientes para incluir fotos de afiliadas atuando, UGC real do programa, depoimentos de participantes, métricas de comissões pagas, capturas de pagamento ou números de afiliadas. Esses elementos só devem ser adicionados após aquisição de material real e consentimento.
