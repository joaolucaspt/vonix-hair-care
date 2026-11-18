# C58 — Vonix Afiliadas: confiança verificável e conversão mobile

**Data:** 18/11/2026. **Projeto exclusivo:** portal de afiliadas Vonix Hair (não alterar e-commerce). **Base:** merge C57 `c2dd11190cbd5a9237d224e2d82b74cb89ad04ee` na `main`.

## Auditoria de referências (sem copiar a outra empresa)

- A referência indicada pelo usuário `https://skence.com.br/pages/skence-creators` tem narrativa forte, etapas para creators, fotos e incentivos próprios, depoimentos e exemplos. **Nenhum conteúdo, foto, percentual, criador ou programa da Skence foi reutilizado**.
- A marca real `https://vonixhair.com/sobre` descreve catálogo, atendimento humano e entregas nacionais; `https://vonixhair.com/loja` disponibiliza produtos; `https://vonixhair.com/politica-de-frete` esclarece frete. A página do Botox Vonix reúne avaliações reais **de clientes sobre produtos**, registradas anteriormente na C53.
- Diagnóstico C57: páginas informativas longas com credibilidade ancorada em reviews de produtos muito abaixo do hero, sem caminho de navegação de confiança que pudesse ser consultado antes de ler comissões. Cabeçalho fixo continha chamada genérica `Ver inscrição` também com seleção aberta.
- A prova social de **afiliadas** continua indisponível e NÃO foi fabricada. Quando houver relatos, vídeos, indicadores de desempenho ou fotos autorizadas, poderão ser integrados com origem e contexto correto. Não tratar as atuais avaliações de clientes como ganhos ou depoimentos do programa.

## Entrega C58

- **Novo componente** `src/components/affiliate-brand-trust.tsx` inserido imediatamente após o hero: narrativa `Uma loja real. Uma parceria que começa com confiança.`, grade premium vinho/rosé com 2 fotos locais oficiais (Kit Cronograma Capilar e Botox Vonix) e três entradas institucionais: catálogo oficial, atendimento, entregas. Cada promessa pode ser verificada diretamente na página da própria loja. Frete qualificado por CEP/pedido; sem prometer entrega irrestrita, valores ou produtos grátis.
- Ligação direta `Ver avaliações reais de produtos` com `#avaliacoes-produtos` no componente `affiliate-creator-opportunity.tsx`; `scroll-mt-28` respeita cabeçalho fixo. Legenda clarifica que as fotos não são imagens de creators e que avaliações não provam ganhos de afiliadas.
- **CTA contextual** no cabeçalho dedicado `affiliate-shell.tsx`: `Quero participar / Enviar candidatura` só quando recrutamento realmente aberto, `Ver inscrição / Conhecer a inscrição` quando carregando, fechado ou temporariamente limitado. `seja-afiliada.tsx` transmite status real do loader/estado. Outras rotas do shell e componentes de conta permanecem compatíveis.
- Mantidos os CTAs existentes do corpo, a seção original de condições 8%, 3 etapas, simulador ilustrativo, vitrine e reviews reais, formulário com e-mail obrigatório da C57, TikTok opcional, acompanhamento de status e autenticação administrativa.

## QA e segurança

- Isolamento em `C:\Users\JL\code\vonix-afiliadas-c58-ux-20261118`; sem alterar projetos paralelos, sem leitura de segredos, candidaturas reais ou sessões de terceiros; nenhum novo banco, RLS/GRANT, integrações ou alterações em checkout, carrinho, catálogo ou pedidos.
- TypeScript `--noEmit`: PASS. ESLint dos arquivos modificados: PASS. Build completo Vite/Nitro: PASS. `git diff --check`: PASS.
- Suíte integral: **749/749 testes PASS em 79 arquivos** (745 anteriores + 4 novos testes C58 verificando fatos e links, imagens oficiais, presença de seção antes de ganhos e CTA condicional). Testes focados: 48/48 PASS em 5 arquivos.
- Chrome local headless: **4/4 tamanhos** 360×780, 390×844, 768×1024, 1440×900 PASS. Dois produtos carregados em cada viewport, `/loja`, `/sobre`, `/politica-de-frete` presentes, jump `#avaliacoes-produtos` verificado com `reviewTop` 95–112 px (visível abaixo do header), sem overflow horizontal/JS errors; e-mail `required/type=email` e validação nativa de formato PASS; zero POST de candidaturas e painel `/admin/afiliadas` negado sem login PASS. Screenshots, logs e script QA são locais e NÃO serão enviados no PR.
- Limites: não houve login E2E real de admin nem submissão de candidata real. Nenhuma evidência de aumento efetivo de conversão A/B; a melhoria é de UX, não uma taxa estatística alegada.

## Próximos passos do release

GitHub PR delimitado; CI remoto; merge somente com checks verdes; aguardar Lovable sincronizar exatamente SHA da `main` e solicitar deploy; confirmar no bundle real e navegador em `https://vonixhair.com/seja-afiliada`; não declarar publicação sem verificação.
