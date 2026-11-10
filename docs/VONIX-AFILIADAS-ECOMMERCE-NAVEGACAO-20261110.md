# Vonix Hair — descoberta do programa de afiliadas no e-commerce

Data: 10/11/2026. Projeto exclusivo **Vonix Haircare Showcase**, repositório `lucassilva1175/vonix-hair-care`. Base de desenvolvimento: merge de V2 `e3e3c59`.

## Objetivo e escopo

Deixar a rota já existente **`/seja-afiliada`** acessível dentro do e-commerce sem tirar prioridade de produtos, preço, frete e checkout. Nenhuma promessa comercial de terceiros, comissão, depoimento fictício, desconto para creators ou prova social de outra marca foi adicionada.

## Posicionamentos

- **Desktop:** menu `Categorias` mantém integralmente as seis categorias comerciais e adiciona no final uma entrada visualmente distinta, porém compacta, **Seja afiliada**. O ícone e fundo neutro diferenciam o destino editorial de produtos.
- **Mobile:** menu rápido mantém itens de produtos, possui card próprio **Seja afiliada** imediatamente após as categorias comerciais e antes dos filtros por necessidade.
- **Rodapé compartilhado de todo o e-commerce:** seção **Comunidade Vonix** com link **Programa de afiliadas**, mais acesso discreto **Seja afiliada** junto aos links auxiliares do rodapé.
- **Homepage:** convite editorial após a seção `Todos os Produtos` e antes da seção de depoimentos, sem competir com a primeira dobra, preços, kits, banner de vendas ou benefícios de frete. CTA: **Conhecer o programa de afiliadas**.
- Link de destino interno, em todas as posições: `/seja-afiliada`. URL canônica para anúncios: `https://vonixhair.com/seja-afiliada`.

## Verificações

- A suíte `npx vitest run` concluiu **293/293** testes em **35 arquivos**, incluindo o teste novo `affiliate-home-invite.test.tsx`.
- Lint rigoroso de componente/teste novos e lint sem apenas a regra de formatação para os dois arquivos legados `site.tsx` e `index.tsx`. O lint escopado do GitHub CI inclui o componente/teste novos.
- Chrome e Edge: navegador desktop em 1280 px encontrou CTA na navegação, dois links no rodapé, home com convite e navegação concluída até landing de afiliadas; sem overflow ou erros JavaScript.
- Chrome e Edge: mobile em 320 e 390 px confirmou acesso pela entrada real do menu até a landing, sem overflow ou erros JavaScript.
- Produtos, precificação, checkout e formas de pagamento: **código operacional inalterado**. Nenhum banco, pedido, envio de e-mail ou inscrição real foi utilizado na QA.

## Cuidado obrigatório de ativação

Publicar a navegação e a landing **não** libera automaticamente o recebimento de candidaturas. `AFFILIATE_RECRUITMENT_OPEN` está fechada por padrão e depende de banco Supabase dedicado, migrações aprovadas, credenciais administrativas e criptográficas, proxy seguro, validação de privacidade e testes reais. Consultar `docs/VONIX-AFILIADAS-PRODUCAO-RUNBOOK.md`. Não ativar/alegar recebimento de candidaturas nem gastar verba Meta Ads com objetivo de inscrição concluída enquanto essa homologação não estiver comprovada.

## Arquivos envolvidos

- `src/components/affiliate-home-invite.tsx` — convite editorial reutilizável.
- `src/components/site.tsx` — cabeçalho, menu mobile, footer compartilhado.
- `src/routes/index.tsx` — posicionamento após vitrines.
- `src/test/affiliate-home-invite.test.tsx` — proteção do CTA e da copy.
- `.github/workflows/vonix-affiliates.yml` — lint permanente dos arquivos novos.

Preservadas as worktrees de e-commerce operacional e outros projetos.
