# Vonix Hair — Afiliadas C54 — acabamento de conversão fiel à referência

Data: 18 de novembro de 2026. Escopo EXCLUSIVO: `/seja-afiliada` e seus componentes de marketing, sem alterar operações do e-commerce.

## Baseline
- C53B publicado: PR #238, merge `9d013c2a166c14194dbc8f8272fefb03fcda36db`.
- Site oficial: https://vonixhair.com/seja-afiliada
- Referência de arquitetura editorial: https://skence.com.br/pages/skence-creators
- Identidade local: Playfair Display, vinho, champagne e produtos do catálogo `public/images/products/`.
- Preservadas as três avaliações de PRODUTOS comprovadas anteriormente, com aviso explícito de que não pertencem a afiliadas.

## Mudanças C54
1. Substituída a seção estática de duas personas por `AffiliateCreatorPaths`: duas abas acessíveis, uma para rotina/comunidade e outra para fotos/vídeos UGC, com pequenas inspirações de conteúdo, imagens reais do catálogo e CTA interno de candidatura. Operação 100% local/visual, sem POST, sem salvar escolha, sem promessa de trabalho/contratação.
2. Adicionado `AffiliateApplicationPrep` antes da seção com âncora `#inscricao`: resumo editorial das informações exigidas (contato, endereço completo, Instagram e seguidores, TikTok opcional), sem criar campo extra e sem bloquear a inscrição. Link para a política real, reforço de gratuidade e lembrete de guardar o código.
3. Hero agora apresenta a disponibilidade indicada pelo backend: aberta / em verificação / temporariamente limitada / em preparação. A status API e as salvaguardas de prévia e de envio permanecem idênticas.
4. Testes `affiliate-c54-conversion.test.tsx` cobrem abas e teclado, estado da candidatura, links internos e ausência de falsas promessas. O teste anterior de fotos oficiais aceita tanto WebP como JPG porque ambos são recursos reais já no catálogo.

## Limites conscientemente preservados
- Nenhuma imagem ou dado de creators, comentários, UGC e métricas da Skence copiados.
- Não inventar cases de afiliadas, pagamentos, seguidores, fotos de parcerias, contratos, kits gratuitos, descontos VIP, cupom garantido, prazo de aprovação ou promessas de ganhos.
- Comissão publicada de 8%, bônus condicional anunciado e eventual supervisão permanecem com ressalvas e regras exibidas no C53.
- Formulário original e APIs, cadastros, Auth, storage, limites, recuperação e painéis administrativos **sem alteração**; nenhum candidato real usado para QA.
- E-commerce (preço, checkout, catálogo, carrinho, frete, pagamentos) **sem alteração**.

## Validação
- Prettier e TypeScript `--noEmit`: aprovados.
- ESLint dos arquivos alterados: zero erros/avisos.
- Suíte integral: **730/730 testes PASS em 76 arquivos**, build de produção PASS.
- Chrome headless, visões 360×780 / 390×844 / 768×1024 / 1440×900: **4/4 PASS**, HTTP 200, sem erros JS ou rolagem horizontal; CTA inicial na primeira tela; ambas abas funcionam no clique e teclado; painel e checklist visíveis; nenhum POST de candidatura no QA.
- Evidências de QA visuais no computador, não em Git: `C54-browser-QA.cjs`, `C54-browser-qa.log`, `C54-browser-shots/`.
- Primeira execução QA acusou CTA fora do viewport porque a inspeção ocorria depois do auto-scroll do teste para a seção inferior. Corrigido o teste para medir o topo do site antes de avaliar a visibilidade; 4/4 PASS, nenhum ajuste de produto foi necessário para esse alerta.\n- Em auditoria de conversão, o checklist de preparação foi movido para antes de \`#inscricao\`, para que o clique em ‘Enviar minha candidatura’ salte diretamente ao cabeçalho do formulário, sem precisar atravessar a lista de preparação. O navegador comprovou a âncora visível abaixo do header fixo nos quatro viewports.\n- Em uma execução com navegação muito rápida de testes no viewport 360, a asserção de mudança de imagem ficou na condição intermediária; segunda execução completa no Chrome: 4/4 PASS, nenhum erro JS ou POST.
- Durante a auditoria, rótulos visuais foram refinados para “itens do catálogo da loja Vonix Hair” sem assumir fabricação própria.

## Portões finais
Exigir confirmação de PR/CI verde, merge e read-back da versão servida em `vonixhair.com`, com smoke de rotas públicas e teste de onboarding sem candidaturas reais. Não alegar conclusão da publicação antes da evidência.
