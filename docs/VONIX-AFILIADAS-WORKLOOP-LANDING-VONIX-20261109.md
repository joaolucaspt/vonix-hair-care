# Vonix Hair — Landing premium de inscrição e seleção de afiliadas

Data local: 09/11/2026. Workloop: b8cadd52-39d6-45f1-998e-0384e25d4797. Execução: c6819d82-6455-4a31-9012-d396db43febb.

## Identidade, referência e isolamento
- Projeto correto: Vonix Haircare Showcase, repositório original lucassilva1175/vonix-hair-care, projeto Lovable 203d2f84-1058-4ca4-acc3-41a4a5d4e2b5.
- Worktree exclusiva: C:\Users\JL\code\vonix-affiliate-skence-inspired-landing-20261109. Branch feat/vonix-affiliate-premium-editorial-20261109. Base inicial 430eb079e043660ef65e6f7bec0006c52af3d112 (PR #52).
- Referência visual: https://skence.com.br/pages/skence-creators. Usar somente conceitos genéricos de landing longa, hierarquia de títulos, seções de perfis/formato, percurso de seleção e FAQ; não clonar layout exato, identidade, imagens ou texto comercial.
- Não tocar e-commerce operacional, checkout, pagamentos, cupons operacionais, métricas, comissões, expedição ou worktrees paralelas. Não ler .env, segredos, dados reais ou banco persistente; não abrir inscrições, enviar comunicações nem publicar deploy.

## Exclusões de alegações e ativos de terceiros
- A referência exibe depoimentos, casos, fotos de creators, métricas de alcance, taxas de comissão de 15% e 21%, R$ 30 OFF, PIX dia 10, comunidade, descontos em produtos e Pliv Pro que NÃO são dados, promessas nem benefícios comprovados da Vonix.
- Nenhuma dessas provas sociais ou condições foi importada. Também não foram inventadas avaliações ou colaborações de afiliadas Vonix, kits grátis, contratos automáticos ou prazos de aprovação.
- Imagens usadas: exclusivamente fotos de produtos já versionadas em public/images/products (kit Banana e Mel, Botox Vonix, Nutri Repair, Progressiva Fio de Luz, kit Cronograma Capilar e kit Cachos).
- Legendas informam que fotos ilustram o catálogo Vonix, não candidatas ou collabs efetivamente realizadas. Nenhuma imagem Skence foi adicionada.

## Nova interface e experiência
- Componente editorial autoral src/components/affiliate-landing.tsx inserido na rota pública src/routes/seja-afiliada.tsx, preservando estado do formulário, rechecagem da abertura, prévia sem gravação e controle de descarte.
- Hero editorial premium em creme/vinho/rosé, tipografia já usada pela Vonix e composição com embalagens oficiais.
- Faixa de identidade, 4 cards de critérios, processo de candidatura em 3 etapas, duas possibilidades de perfil (influenciadora e criadora UGC), 4 ideias de formatos de conteúdo capilar, CTAs ancorados na inscrição.
- FAQ em elementos nativos details/summary com seis perguntas: participação 18+, portfólio e seguidores, compra não obrigatória para inscrição, inexistência de promessas automáticas de produtos/cupons/comissão, avaliação, formulário em prévia fechada.
- Não são adicionadas regras de comissões, vantagens, pagamentos, plataforma externa nem qualquer backend novo.

## QA e critérios
- Os 7 testes existentes da página seguem aprovados. Quatro testes novos cobrem identidade e ativos Vonix, ausência de provas/promessas de outras marcas, navegação para inscrição, FAQ acessível e CTAs condicionais.
- Teste focal: 11/11 aprovado; TypeScript e lint direcionado aprovados.
- Chrome local em 390, 768 e 1280 px, AFFILIATE_RECRUITMENT_OPEN=false: HTTP 200, sem overflow horizontal, 11/11 imagens de produtos carregadas, FAQ abre, 5 links para inscrição, âncora funciona, formulário permanece em prévia, 0 erros JavaScript e 0 escritas POST.
- Imagens lazy são explicitamente solicitadas antes de validar o carregamento. Capturas temporárias de QA ficam em AppData/Local/Temp, sem arquivos externos adicionados ao repo.
- **Suíte integral local:** 288/288 testes em 32 arquivos, TypeScript (`npx tsc --noEmit`), lint direcionado aos arquivos modificados, build Vite/Nitro e `git diff --check` com exit 0.
- CI do PR/main e sincronização de SHA do Lovable devem ser verificados independentemente antes de concluir. Testes locais e sync de código não certificam publicação no domínio.

## Produção ainda bloqueada
- Manter AFFILIATE_RECRUITMENT_OPEN desabilitada.
- A configuração privada do Supabase dedicado no runtime Lovable e homologação LGPD, proxy, MFA, backup/restauração e política comercial ainda não estão comprovadas. Sincronização de código não prova deploy no domínio público.
