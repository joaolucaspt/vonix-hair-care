# Vonix Hair — landing de afiliadas V2 | checkpoint verificado (10/11/2026)

## Identidade e limite de escopo

- Projeto único: Vonix Haircare Showcase, `lucassilva1175/vonix-hair-care`, Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Base verificada: main origin `c0d78a7`, PR #53 da landing original já mesclado.
- Branch V2: `feat/vonix-affiliate-v2-final-20261110`.
- Worktree de integração: `C:\Users\JL\code\vonix-affiliate-v2-final-20261110`.
- Referência Skence Creators usada somente para avaliar hierarquia e experiência: **não** foram copiadas fotos, logos, depoimentos, números, taxas, comissões, descontos, cupons ou benefícios.
- Fonte das fotografias: `public/images/products` da própria Vonix. Seis caminhos distintos verificados e todos existentes. Instagram oficial consumido de `INSTAGRAM` já definido na loja.

## Problema visual observado na V1 e correção

No Chrome mobile de 390 px, o cabeçalho comercial da loja consumia aproximadamente 300 px antes da narrativa de afiliadas; o CTA de candidatura ficava fora da primeira tela. A V2 utiliza um shell próprio para a rota de inscrição, sem menu comercial, banner de promoções, pesquisa, seletor de público, roleta ou popup.

Novo cabeçalho exclusivo: 73 px nas larguras testadas, com logo Vonix oficial, navegação por seções, CTA direto e rodapé da seleção. Mantida saída clara para a loja. **O Shell comercial do e-commerce não foi modificado.**

Na landing, galerias de critérios e formatos aceitam rolagem horizontal com snap no mobile e navegação por teclado; desktop mantém grid. Âncoras recebem margem de rolagem sob header fixo. Ajustados espaçamentos da primeira dobra e títulos de SEO.

## Checks executados

- `npx tsc --noEmit`: PASS.
- `npx prettier --check` em arquivos alterados: PASS.
- ESLint focado em 6 arquivos: PASS.
- `npm run build` (Vite/TanStack/Nitro): EXIT 0. Warnings de `inputValidator` depreciado somente em módulos existentes fora do escopo.
- `npx vitest run`: 292 de 292 testes, 34 arquivos, sem falhas.
- Browser QA real: Chrome e Edge, larguras 320/390/768/1280, oito cenários. Header 73 px; 0 overflow do documento, 0 erros de página, 0 POSTs de candidatura; 6 perguntas de FAQ; FAQ abriu; âncora da inscrição em 96 px sob header.
- No celular (390 px) o CTA do hero fica aproximadamente a 581 px em uma viewport de 844 px, acima da dobra; em 320 px fica aproximadamente a 707 px. Prévia do wizard abriu sem submissão e exibiu bloqueio explícito.
- Galeria de critérios oferece overflow horizontal intencional no celular, sem extrapolar a largura da página.

## Proteções preservadas e limitações

- O questionário de cinco etapas e sua validação não foram reescritos; admin, email worker, migrações SQL, banco e integração de vendas permanecem inalterados.
- Flag `AFFILIATE_RECRUITMENT_OPEN` permanece false na QA; não foram enviados cadastros reais, dados pessoais ou notificações.
- Aprovação, comissões, cupons, pagamento, alcance, patrocínios e produtos de parceria **não são prometidos** pela landing; detalhes dependem de comprovação e de acordo posterior.
- Não houve leitura de `.env`, segredos, banco operacional, checkout, pagamentos ou outras worktrees.
- Browser QA e build local não constituem homologação de produção nem publicação da página. CI/PR precisam de validação própria após envio.
- Fluxos de consentimento, banco dedicado, credenciais de administração, atendimento e LGPD ainda exigem checklist de produção próprio, sem ativar inscrições nesta evolução.

## Arquivos alterados

`src/components/affiliate-shell.tsx` (novo), `src/components/affiliate-landing.tsx`, `src/routes/seja-afiliada.tsx`, `src/test/affiliate-shell.test.tsx` (novo), `src/test/affiliate-landing-v2.test.tsx` (novo), `src/test/affiliate-recruitment-page.test.tsx`.

A nova rota dedicada não interfere em layout, preços, checkout nem pedidos do e-commerce.
