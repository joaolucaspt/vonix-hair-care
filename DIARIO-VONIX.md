# Diário de melhorias do site (vonixhair.com)

Regra: uma mudança por dia, registrada aqui. Antes de cada mudança, um backup (tag `backup-AAAA-MM-DD` no GitHub, volta com `git revert`). Nada de inventar avaliação, venda ou antes/depois. Preço, oferta, anúncio, pixel do Meta, Google Analytics e pagamento: perguntar ao Lucas antes.

## Metas
LCP até 2,5 s · 60% rolando além de 25% da página · 8% adicionando ao carrinho · conversão de pelo menos 1%. Estável por 7 dias seguidos = passar para verificação semanal.

## Já feito antes do diário
- 10/11 (noite): faixa de prova social no topo do produto (só avaliações reais com foto/vídeo) e vídeos dos depoimentos comprimidos (PR 88).
- 10/11 (noite): vídeos reais de afiliadas em todos os produtos e na home (PR 89). Fora: 2 vídeos de live com horário e 1 com "18% de desconto" na imagem.
- Medição de velocidade (celular simulado): home nota 53 / LCP 5,0 s; produto nota 58 / LCP 4,3 s. O peso está nos scripts do Google Analytics (~190 KB) e do pixel do Meta (~220 KB). O Lucas disse NÃO mexer neles.
- Já existiam: barra de frete grátis (carrinho, gaveta de compra e checkout), páginas admin/afiliadas com noindex.

## 11/11/2026 — dia 1 (Clarity, últimos 3 dias, bots já excluídos)
- 151 sessões, mas ~42 são de equipe/pré-visualização (lovable.dev 28, lovableproject.com 13, 127.0.0.1 1). Visitas pagas reais ≈ 38 (instagram 25, facebook 12, adsmanager 2). Ainda é cedo para concluir (precisa de 100+).
- Funil Produto → Carrinho → Checkout: 53 → 5 (9,4%, meta 8% batida) → 3; 1 compra registrada.
- Rolagem média 41%; cliques mortos 10,6% (16 sessões); LCP real 3,6 s; pontuação de desempenho do Clarity 82.
- Páginas mais vistas: botox-vonix 26, home 25, /seja-afiliada 25, /admin/afiliadas 17 (equipe), /produto/progressiva-fio-de-luz 12.
- Mudança do dia: nenhuma no site (dados insuficientes para escolher com segurança). Feito: este diário, backup `backup-2026-11-11`, rotina diária às 7h37.
- Próxima ação: medir de novo amanhã; achar os cliques mortos (mapa de cliques do Clarity); se a rolagem do Fio de Luz continuar baixa, subir as avaliações para antes do meio da página.

## Dia 2 — Meta Ads (BM "Vonix Hair", conta 1034566721765909, últimos 30 dias até 09/11) + Clarity
- Meta, total da conta: gasto R$ 992,77; 61.178 impressões; 861 cliques no link (CTR 1,41%); 467 visualizações da página de destino; **connect rate 54%** (46% dos cliques nunca chegam a carregar a página); 53 adições ao carrinho; 13 finalizações iniciadas; 2 compras (Black Friday CBO, R$ 281,30 por compra, ROAS 0,53).
- Única campanha ativa: "VONIX | VENDAS | FRIO | Combo Banana e Mel | MG-SP | 31-10-2026" — gasto R$ 285,98; 6.609 impressões; CPM R$ 43,27; 103 visualizações da página (connect rate 70%); 26 carrinhos; 4 finalizações; 0 compras. Orçamento é do conjunto (compartilhado). Regra: R$ 30/dia; sem venda real, não aumentar.
- Maior perda: do carrinho para o pagamento (26 → 4 → 0 na campanha ativa) e, antes disso, cliques que não carregam (connect rate 54% na conta). Amostra pequena: sem conclusão firme (precisa de 100+ visitas pagas após cada mudança).
- Checkout lido no código: 10 campos obrigatórios com preenchimento automático ligado. Nenhuma mudança hoje (sem evidência clara; pagamento é trava).
- Mudança do dia: nenhuma no site e nenhuma nos anúncios.
- Próxima ação: gravações do Clarity de quem chegou ao checkout (onde para); testar compra Pix no celular; ver se a queda do connect rate vem do navegador interno do Instagram.

## Ordens extras do Lucas (uma por dia, na ordem; marcar aqui quando feita)
- [x] 1. (feita em 11/11/2026) Anúncio no destino certo: nenhum anúncio de venda deve levar a /seja-afiliada ou plex-vonix; direto ao produto (botox ou fio de luz).
- [ ] 2. Velocidade no celular (meta: abrir em menos de 2,5 s no 4G). Sem mexer nos scripts do Meta e do Google.
- [ ] 3. Prova social real perto do botão de comprar (nota média e quantidade). Parte já feita em 10/11 (PR 88 e 89).
- [ ] 4. Frete antes do checkout (campo de CEP no produto) e barra "falta R$ X" (já existe no carrinho). Preço e regra de frete só com aprovação.
- [ ] 5. Recuperação de carrinho na Appmax: ver se existe; se não, descrever como ativar.
- [ ] 6. Teste de compra semanal sem pagar (botão, carrinho, checkout, evento Purchase).
- [ ] 7. Ordem das seções da página de produto; manter a barra fixa de compra.
- [ ] 8. Botão de WhatsApp de dúvidas com mensagem pronta.
- [ ] 9. Criativos novos: pausar anúncio com 3+ dias de gasto e sem carrinho; propor 2 por semana.
- [ ] 10. Regra de parar e pensar: com menos de 100 visitas pagas após uma mudança, não trocar outra coisa grande.

## 11/11/2026 (tarde) — dia 3 (rotina automática)
- Meta (1–11/11, nível de anúncio): A2 Prova/botox gasto R$ 194,29 · 85 visualizações da página (connect rate 81,7%) · 24 carrinhos · 1 finalização. A3 fio de luz R$ 112,03 · 33 visualizações · 2 carrinhos · 1 finalização. A1 combo desmaia R$ 26,07 · 8 visualizações · 2 carrinhos · 3 finalizações. Conta toda: 160 visualizações, connect rate 66%, 29 carrinhos, 5 finalizações.
- Clarity (3 dias, bots excluídos): 172 sessões (~49 de equipe/pré-visualização), LCP 2,4 s (bom), pontuação 80, rolagem 43,6%, cliques mortos 10,5% (18 sessões), 12 erros de JS (83% "java object is gone" = navegador interno do app, inofensivo). Funil produto→carrinho→checkout: 69 → 6 → 4. Navegador interno Instagram/Facebook ≈ 23% das sessões.
- Site no ar: home, botox, fio de luz e checkout respondem 200 em menos de 1 s.
- Ordem extra 1 (destino do anúncio), conferida SEM mudar nada: A1 → /produto/kit-desmaia (certo); A2 botox → /produto/botox-vonix (certo); **A3 "fio de luz" → /produto/botox-vonix (provável erro; deveria ser /produto/progressiva-fio-de-luz)**. A3 tem "Edições não publicadas" (alguém está editando) e há 25 rascunhos pendentes na conta; não mexi para não sobrescrever. Conjunto chama-se "ADV+ ..." (conferir se não é Advantage+).
- Mudança do dia: nenhuma (conflito com edições em andamento nos anúncios). Nenhuma venda real registrada; orçamento mantido em R$ 30/dia.
- Próxima ação: Lucas confirma o destino do A3; então troco para o produto certo e marco a ordem 1 como feita.

## 11/11/2026 — ordem extra 1 concluída
- O anúncio A3 | fio de luz (conta BM Vonix Hair) apontava no ar para /produto/botox-vonix; a edição já salva como rascunho trazia /produto/progressiva-fio-de-luz (com UTM de a3_fio_de_luz). Publiquei só essa edição (o Meta confirmou "1 anúncio foi atualizado"; rascunhos pendentes caíram de 25 para 24). A1 (kit-desmaia) e A2 (botox-vonix) já estavam certos. Como desfazer: abrir o A3 e trocar a URL do site de volta.
- Pendente do Lucas: conferir se o conjunto "ADV+ | Mulheres 25-55" não usa Advantage+ (regra: segmentação manual).

## 11/11/2026 — publicado (aprovado pelo Lucas)
- Fotos de produto em WebP na tela (JPG segue no catálogo/feed/og). Vídeo Banana e Mel (cortado, sem áudio, sem o texto de 10% que acabou). Cadastro do cupom agora envia o contato para o app (tela Contatos do site; tabela site_leads criada no banco do app). Visita de anúncio (fbclid ou utm_medium=paid) não vê roleta, pop-up de afiliada nem Seja afiliada no topo.
- Medição (celular simulado), antes -> depois: home peso 2,68 -> 1,77 MB, LCP 7,8 -> 4,1 s, nota 46 -> 57; loja peso 3,04 -> 1,67 MB, nota 52 -> 53; botox peso 1,66 -> 1,53 MB, nota 56 -> 54 (variação normal do teste). O tempo travado (TBT 1,7 a 2,3 s) não melhorou: vem dos scripts do Meta e do Google (Lucas disse NÃO mexer).
- Não testado ponta a ponta: um cadastro real no site chegando na tela Contatos do site (evitei criar contato falso).
- Como desfazer: git revert das PRs 106, 107 e 108 (site) e 14 (app).

## 12/11/2026 (manhã, quinta) — dia 4 (rotina automática, só conferência)
- Meta (últimos 30 dias até 11/11): conta toda R$ 1.067,89 gasto, 55 carrinhos, 14 finalizações, 2 compras (as mesmas da Black Friday, sem venda nova). Campanha ativa "FRIO Combo Banana e Mel": R$ 352,93 (≈ R$ 67 desde 09/11, ritmo ~R$ 30/dia), 7.982 impressões, 28 carrinhos, 5 finalizações, 0 compras, connect rate 71%. Embaixadoras: R$ 12,24. Remarketing MORNO segue em rascunho (público ainda não verificado).
- Clarity (3 dias): 199 sessões (maioria equipe/pré-visualização: lovable.dev 42 + lovableproject 17 + 127.0.0.1 6). Visitas pagas reais ≈ 44 (instagram 25, facebook 15, adsmanager 4). Rolagem 43,5%, cliques mortos 12,1% (24 sessões), retornos rápidos 12,6%, LCP 2,4 s (bom), INP 370 ms (precisa melhorar), pontuação 79. Eventos: 91 viram produto, 6 foram ao carrinho, 3 begin_checkout, 1 purchase (provável interna).
- Site no ar (home 1,6 s, produtos 0,4–1,1 s, checkout 0,4 s, todos 200); preço R$ 180,90 presente no botox.
- Mudança do dia: nenhuma (só conferência; menos de 100 visitas pagas desde a mudança de 11/11, "ainda é cedo": faltam ~56). Nenhuma mudança em anúncio; orçamento mantido em R$ 30/dia (sem venda real).
- Pendente do Lucas: conferir se o conjunto não usa Advantage+; aprovar abertura do remarketing quando o público chegar a 100+.
- Atenção: cliques mortos subiram de 10,5% para 12,1%. Próximo passo seguro (site): achar no mapa de cliques do Clarity quais elementos recebem clique morto.
