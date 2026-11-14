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

## 12/11/2026 (dia) — Esquenta da Black Friday e grupo VIP (aprovado pelo Lucas, publicado)
- Roleta saiu. Nova página /esquenta-black-friday (lista VIP: nome, e-mail e WhatsApp) e aviso no lugar da roleta. Desconto programado, travado por data (27/11 00h a 30/11 23h59, a confirmar o fim): Botox 30%, Fio de Luz 15%, kits 20% (Monovonix fora); não soma com leve 2/leve 3. Antes e depois o preço não muda (Botox segue R$ 180,90).
- Cadastros NÃO eram salvos: a senha AFFILIATE_SITE_SECRET era diferente no site e no app (erro 401). Trocada nos dois (Lovable). Teste ao vivo OK: contato com WhatsApp apareceu em Contatos do site; contato de teste apagado. Coluna phone criada no app (PR 15 do app); site PRs 133 a 136.
- Grupo de WhatsApp Business "Vonix VIP - Black Friday" (link no site, BF_GRUPO_VIP): só admin escreve, entrada com aprovação (Larrossa caps. 1 e 7), descrição e boas-vindas com emojis, banner feito no ChatGPT (pasta Criativos Vonix - Claude). Encerrar o grupo depois da Black Friday (~01/12).
- Falha minha: criei grupo/mensagem antes de abrir o manual dos livros; regra reforçada (conferir ANTES de qualquer decisão).
- Pendente: conferir cupom de boas-vindas e afiliadas após a troca da senha; combo "Sistema Fio de Luz" (precisa Bling/foto/estoque); rascunhos de anúncio do esquenta (2 conferências).
- Como desfazer: git revert das PRs 133, 134, 135, 136 (site) e 15 (app).

## 12/11/2026 (tarde) — regra do frete grátis (decisão do Claude, poderes liberados pelo Lucas)
- Antes: frete grátis (pedido acima de R$ 150) = opção mais barata que entregue em até 3 dias úteis. Custava ao Lucas ≈ R$ 15 no Sudeste, R$ 53 em Salvador/Curitiba e R$ 79 em Manaus (SEDEX), cotações reais de 12/11.
- Agora: frete grátis = opção MAIS BARATA; só usa a rápida (até 3 dias) se custar no máximo R$ 8 a mais. Custo cai para ≈ R$ 14 a R$ 17 (Sudeste, Nordeste, Sul) e R$ 31 (Manaus, prazo longo). O cliente não paga a mais; o prazo mostrado continua o real.
- Motivo: com o SEDEX no frete grátis, 16 produtos caíam abaixo de 30% de margem no Norte (Plex Vonix ≈ 4%). Com a regra nova a pior sobra fica acima de 30% antes de comissão e anúncio.
- Como desfazer: git revert da PR "Regra de frete grátis econômico" (src/lib/shipping-pick.ts e src/test/shipping-pick.test.ts).

## 12/11/2026 (tarde) — preço real, sem "de/por" (decisão do Claude a pedido do Lucas)
- O Lucas confirmou: o preço real é o de venda (ex.: Botox R$ 180,90). O preço riscado "de R$ 217,90" nunca foi praticado (o preço antes do reajuste era R$ 164,90). Tirei o preço riscado dos 39 produtos (campo compareBase = null em src/data/products.json): nada mais mostra "de ... por ..." nem selo de % OFF por causa dele. Preços de venda NÃO mudaram.
- A faixa do topo "ATÉ 26% OFF EM PRODUTOS SELECIONADOS" virou "LEVE 2 UNIDADES: 12% OFF · LEVE 3: 15% OFF" (desconto que existe de verdade) e o banner da home "ATÉ x% OFF" virou "LEVE MAIS E ECONOMIZE" com o texto "Leve 2 ganhe 12% OFF, leve 3 ganhe 15% OFF".
- Valores antigos para desfazer: compareBase = Fio de Luz 232,90; Botox Vonix 217,90; Shampoo Fio de Luz 73,90; Nutri Repair 102,90; Kit Café Verde 164,90; Kit Banana e Mel 202,90; Kit Cronograma 249,90; Kit Whey 144,90 (e os demais 31 no commit anterior). Como desfazer: git revert da PR "Preço real".

## 12/11/2026 — Lucro mínimo de R$ 30 por venda (ordem do Lucas)
O Lucas pediu: "prefiro ganhar pouco e ganhar alguma coisa; pelo menos R$ 30 de lucro por produto, e depois vamos aumentando". Vale por cima da margem de 30% para os produtos abaixo de R$ 30 de lucro por venda no anúncio (conta: custo + taxa Appmax cartão 3,39% + R$ 0,99 + anúncio R$ 40 provisório + frete grátis médio R$ 17,50 acima de R$ 150). Quem já passava de R$ 30 não mudou.
Preços ANTIGOS -> NOVOS (para desfazer, reverter este PR):
Shampoo Fio de Luz 1L 70,90->94,90; Shampoo Diamond 1L 70,90->94,90; Shampoo Hidratante Anabolizante 300ml 70,90->94,90; Shampoo Hidratante Desmaia 1L 70,90->94,90; Shampoo Hidratante Dep Tóc 1L 70,90->94,90; Nutri Repair 1kg 92,90->102,90; Plex Vonix 1000ml 158,90->159,90; Kit Desmaia 300ml 70,90->93,90; Kit Monovonix 260ml 81,90->104,90; Kit Monovonix 500ml 125,90->139,90; Ampola Mousse Flash 18ml 37,90->80,90; Kit Coco Nutri 95,90->103,90; Queratina em Gel 81,90->96,90; Queratina Cistina 35ml 48,90->82,90; Kit Matizador 98,90->99,90; Queratina em Massa 81,90->98,90; Kit Cachos 250ml 81,90->97,90; Power Vonix 35ml 59,90->88,90; Defrizante 300ml 59,90->87,90; Defrizante 1L 92,90->102,90; Perfume Capilar Ouro e Rubi 70,90->91,90; Reparador de Pontas 70,90->93,90; Sérum Argan 92,90->101,90.
Cuidado: itens baratos subiram 30% ou mais; acompanhar conversão. Custo do anúncio por venda e frete médio continuam provisórios.

## 12/11/2026 (fim de tarde) — compra teste segura, pixel e conferência de preços (rotina automática, só conferência)
- Compra teste (sem pagar, sem Pix, sem dados pessoais): produto → carrinho → checkout com CEP 01310-100 (SP): frete JeT Standard "Grátis" (até 3 dias úteis), total Pix R$ 318,38 (2× Botox), botão "Gerar Pix" liberado no computador (com dados já salvos no navegador). No celular (375 px) frete aparece e a página não rola de lado; o botão fica travado até preencher contato (esperado; não usei dados). Nenhum erro.
- Pixel (Events Manager, "Vonix | E-commerce"): PageView há 47 min; ViewContent e AddToCart há ~2 h; InitiateCheckout há ~2 h; Purchase "há 2 dias" (última compra real/teste, 44 no total, sem venda nova). Pixel vivo.
- Anúncios hoje: campanha FRIO Combo Banana e Mel R$ 25,12 e 509 impressões (CPM alto, ≈ R$ 49); remarketing MORNO aparece "Preparando" e LIGADO (o diário dizia rascunho: conferir). Colunas de cliques/carrinho vieram vazias na tela; sem mudança em anúncio.
- Preços: nenhum preço mudou. Plex Vonix: sobra ≈ R$ 29 (18%) no canal anúncio; Kit Banana e Mel, SOS Reconstrutor ≈ 27-29% (quase no limite). Planilha de custo é de antes dos reajustes de R$ 30 de lucro (diverge por isso).
- Achado: as descrições dos produtos (products.json) dizem "Loggi, Jadlog, Correios e Total Express", mas o checkout só oferece JeT, Jadlog e Correios. Texto a corrigir (mudança visível: mostrar ao Lucas antes de publicar).
- Conector Abency (dados de anúncio) bloqueado: teste grátis acabou; usei o Gerenciador direto.
- Como desfazer: nada alterado no site além deste diário.

## 12/11/2026 (20h10) — rotina automática, só conferência
- Meta (Gerenciador, janela até 11/11, sem dado novo de hoje): conta R$ 1.067,90; FRIO Combo Banana e Mel R$ 352,94, 7.983 impressões, ativo; Remarketing MORNO 30D "Ativo" com R$ 0,00 (ainda sem entrega). Nenhuma campanha reprovada visível. Orçamento mantido em R$ 30/dia (sem venda real).
- Site no ar: home 1,6 s, botox 0,45 s, fio de luz 0,44 s, checkout 0,40 s, todos 200; preço R$ 180,90 presente.
- Clarity não reaberto nesta rodada (conferência curta); mudança do dia: nenhuma. Menos de 100 visitas pagas após a mudança de 11/11: "ainda é cedo".
- Como desfazer: nada alterado além deste diário.

## 12/11/2026 — Teste de preços até 20/11 e Pix sem desconto

- Pedido do Lucas: vender mais, ganhando menos; preço único (sem desconto no Pix, sem preço "de" inventado).
- 47 variantes em 43 produtos com preço de teste (R$ 30 de lucro por produto, só taxa do cartão e frete médio, sem custo de anúncio): `src/data/teste-precos.json`. Vale até 20/11/2026 às 23h59 (`fim`, UTC 21/11 02:59:59); depois os preços de `products.json` voltam sozinhos (o preço é lido na hora, também no servidor).
- Relógio real no topo do site (`TesteRelogio`), some sozinho ao acabar (livro, MANUAL linhas 752-753: timer só com data real; se acabar, não reabrir igual).
- `PIX_DISCOUNT = 0`; o complemento do carrinho (5% no item) ganhou preço próprio (`complementPrice`).
- Meta: com esses preços, venda por anúncio (≈R$ 40/venda) dá prejuízo de ≈R$ 10; vale para WhatsApp/orgânico/recompra. Avaliar em 17/11 (metade) e 20/11 (fim); o livro pede ≈35 vendas para concluir teste de preço (MANUAL linha 437).

## 12/11/2026 (noite) — Clarity: cliques mortos e Pix no celular

- Clarity (3 dias, ~150 visitantes reais): 117 viram produto, ~9 pôs no carrinho; 12 abriram o checkout; 6 informaram frete; 2 chegaram ao pagamento.
- Appmax: pedido 132738782 (12/11 14:52, R$ 180,90, Botox, veio do anúncio, app do Facebook) gerou Pix e EXPIROU: o checkout funciona, o gargalo é pagar o Pix (só 2 de ~10 Pix pagos desde 30/10).
- Cliques mortos: faixa verde de frete e 4 quadros coloridos do topo do checkout pareciam botões (PR #153: cartão discreto com ícones).
- Botão "Copiar código Pix" não fazia nada (sem aviso) quando o navegador do Instagram/Facebook bloqueia a área de transferência: agora tem plano B (campo selecionado) e aviso; tela do Pix pensada para celular: botão grande no topo, 4 passos, QR só em tela grande.

## 13/11/2026 (8h10) — rotina automática, só conferência
- Meta (30 dias até 12/11, dado de hoje ainda não fechado): conta R$ 1.115,40. FRIO Combo Banana e Mel R$ 386,99 (8.700 impressões, ativo, 2 recomendações do Meta não aplicadas). Remarketing MORNO 30D ativo, R$ 6,51 (160 impressões: começou a entregar). Demais campanhas desativadas. 20 rascunhos pendentes (não publicados). Colunas de carrinho/compra não carregaram no texto da página; sem número novo de compras.
- Site no ar: home 1,3 s, botox 0,18 s, fio de luz 0,63 s, checkout 0,14 s, todos 200.
- Clarity não reaberto nesta rodada. Conector Abency segue bloqueado (teste acabou).
- Mudança do dia: nenhuma; menos de 100 visitas pagas após a última mudança: "ainda é cedo". Orçamento mantido em R$ 30/dia (sem venda real).
- Como desfazer: nada alterado além deste diário.

## 13/11/2026 (tarde) — rotina Clarity (sem mudança de código)
- Clarity (3 dias, 167 sessões reais, tráfego interno ignorado): 94 viram produto, só 3 foram ao carrinho (3,2%), 13 abriram o checkout, 7 informaram frete, 1 chegou ao pagamento, 2 compras no funil. Cliques mortos 14,4% (24 sessões), retornos rápidos 16,8% (28). Erros de JS: só "java object is gone" do navegador do Instagram (não é do site). LCP 3,1 s (precisa melhorar), CLS bom.
- Origem: Instagram/Facebook (apps) ≈ 27% das sessões; Google 7.
- Gargalo: produto → carrinho. A PR #157 (hoje 11h24) já sobe carrinho/compra no celular; os dados do Clarity são de antes dela, então NÃO mexi em mais nada para não misturar o efeito. Reconferir em 1-2 dias.
- Gravações do checkout e Google Analytics não abertos nesta rodada (o filtro por URL volta ao painel; conector Abency/GA4 devolve erro 404). Sem Pix gerado sem pagamento novo visto.
- Site no ar: home 1,0 s, botox 0,19 s, checkout 0,14 s, todos 200. Meta: não olhado (só observar; sem mudança).

## 13/11/2026 (12h10) — rotina automática, só conferência
- Meta (30 dias até 12/11, dado de hoje ainda não fechado): igual à rodada das 8h10: conta R$ 1.115,40; FRIO Combo Banana e Mel ativo (R$ 386,99); Remarketing MORNO 30D ativo (R$ 6,51); demais desativadas; nenhuma reprovada visível; 20 rascunhos não publicados. Colunas de carrinho/compra não carregaram em texto: sem número novo de compras.
- Site no ar: home 0,55 s, botox 0,77 s, checkout 0,39 s, todos 200.
- Clarity e pixel não reabertos nesta rodada. Mudança do dia: nenhuma ("ainda é cedo": menos de 100 visitas pagas após a última mudança). Orçamento mantido em R$ 30/dia.
- Como desfazer: nada alterado além deste diário.

## 13/11/2026 (tarde) — frete com 3 opções (pedido do Lucas)
- Checkout abaixo de R$ 150 passa a mostrar até 3 opções: rápida, econômica e uma terceira intermediária (de preferência Correios PAC, senão a mais barata que sobra). O mais barato continua pré-selecionado. Frete grátis (≥ R$ 150) continua com 1 opção. Preços e prazos são os reais do Melhor Envio. src/lib/shipping-pick.ts (pickThreeShipping).
- Como desfazer: git revert desta PR.

## 13/11/2026 (tarde) — frete surpresa (vídeo da cliente, CEP 60824-000 Fortaleza) e gravações Clarity
- Vídeo (11:05-11:06): Progressiva Fio de Luz R$ 109,90, CEP 60824-000; o checkout mostrou frete R$ 79,66 (total R$ 189,56) = o Correios SEDEX estava pré-selecionado. Para a cliente o frete custava 72% do produto: causa provável de desistência. Também não havia frete visível no carrinho ("Informe o CEP").
- Causa: antes da PR #158 (publicada 11:24) o site pré-selecionava a opção rápida (SEDEX). Agora pré-seleciona a mais barata.
- Conferido ao vivo (1 Botox R$ 99,90, abaixo de R$ 150): Fortaleza JeT R$ 16,80 (8 dias) pré-selecionado e SEDEX R$ 79,56 como opção; Manaus JeT R$ 31,50 (13 d) / SEDEX R$ 79,56; Cuiabá JeT R$ 25,62 (5 d) / SEDEX R$ 68,29; SP JeT R$ 15,10 (3 d) / SEDEX R$ 38,27. Sem erro de cotação e sem "frete vazio" nesses 4 CEPs. Só SEDEX do Correios aparece (sem PAC).
- Clarity: gravação 10:22 de hoje (iPhone, Fio de Luz): comprar agora → checkout → frete em 46 s → campo do cartão aos 1:12 → saiu aos 1:33 sem concluir (antes da PR #158).
- Pendente (ideia, não feita): oferecer Correios PAC; reconferir conversão do checkout em 1-2 dias.
- Como desfazer: nada alterado além deste diário.

## 13/11/2026 (tarde) — peso real no frete (1 L = 1,25 kg, dado do Lucas)
- Antes: toda unidade era cotada com 0,6 kg (caixa padrão), então produtos de 1 L/1 kg saíam com frete menor que o real. Agora o peso vem do tamanho do produto: conteúdo + 0,25 kg de embalagem (1 L/1 kg = 1,25 kg; 500 ml = 0,75 kg), nunca abaixo de 0,6 kg; kits e sem tamanho ficam em 0,6 kg. Vale no checkout e na etiqueta automática do Melhor Envio (mesmo peso). `unitWeightKg` em src/lib/melhorenvio.server.ts.
- Efeito esperado: frete de produtos de 1 L sobe um pouco (mais próximo do real). Confirmar pesos dos demais tamanhos com o Lucas.
- Como desfazer: git revert desta PR.

## 13/11/2026 (tarde) — Auditoria Clarity + Google Analytics (conta "Vonix Hair", propriedade 557116983, acesso pelo 3º e-mail do Chrome: authuser=2)
- GA (6-12/11): 5.498 sessões, mas 93% "Direct" (5.133) com engajamento 1,2% e 1 s = robô. Países: Hong Kong 3,9 mil + China 1,5 mil usuários (Brasil 148). 4,8 mil visualizações só em /loja ("Loja — Vonix Hair"). Agora: 38 de 41 usuários ativos são de Hong Kong. Os números do GA (9,3 mil usuários, +1.199%) estão inflados e NÃO são clientes; o Clarity (167 sessões reais) é o número confiável.
- Tráfego real (GA): Paid Social 89 sessões, só 23,6% engajadas (7 s médios): ~76% saem antes de ver a página (celular no app do Instagram/Facebook, LCP 3,1 s no Clarity); Social orgânico 57 (43,9% engajadas, 38 s); Busca orgânica 23 (56,5%, 1m43); IA (ChatGPT etc.) 12.
- Compras no GA: 1 compra na semana com receita R$ 15,80 (valor errado: pedido real é > R$ 90): conferir o valor enviado no evento purchase.
- Pendente: bloquear o robô de Hong Kong/China (Cloudflare/regra de país ou filtro de tráfego interno no GA), filtrar no GA; acelerar a página do produto no celular (resposta do Botox 2,0 s no teste de hoje, 94 KB); conferir valor do evento purchase.
- Como desfazer: nada alterado além deste diário.

## 13/11/2026 (tarde) — bloqueio do robô de Hong Kong e China (ordem do Lucas: corrigir o Analytics)
- O domínio vonixhair.com passa pelo Cloudflare (nameservers alina/glen), mas não está na conta Cloudflare do Lucas (conta vazia): provavelmente gerenciado pelo Lovable, sem acesso para criar regra lá. Solução no próprio código: src/server.ts devolve 403 quando o cabeçalho `cf-ipcountry` é HK ou CN (src/lib/bot-block.ts). Brasil e demais países não são afetados; sem o cabeçalho não bloqueia.
- Motivo: 5,4 mil visitas falsas em 7 dias (GA), 38 dos 41 usuários ativos eram de Hong Kong.
- Analytics: retenção já em 14 meses, métrica otimizada ligada, fluxo G-J8TYLB425K ok. Filtro "Internal Traffic" ainda em Teste (ativar é irreversível; precisa conferir os IPs antes).
- Como desfazer: esvaziar BLOCKED_COUNTRIES em src/lib/bot-block.ts ou git revert.

## 13/11/2026 (noite) — conferência contra o MANUAL-VONIX (v3) e retirada do contador falso do checkout
- Conferi as decisões do dia contra o topo do manual: regra 2 (preço, frete e condição iguais no anúncio e no checkout; Cialdini 2.0, "bola baixa" invertida): o frete surpresa de R$ 79,66 e o carrinho sem frete ("Informe o CEP") a feriam; frete mais barato marcado + frete no carrinho (PR #158) e 3 opções (PR #162) corrigem. Regra 9 (formulário curto, 2 a 3 campos na primeira tela): o checkout pede mais campos de uma vez: candidato à próxima melhoria.
- Regra 8 (escassez/urgência só real): o contador de 15 minutos do checkout (PR #158) era "só visual", não mudava nada ao zerar: urgência falsa. Retirado (função CheckoutTimer). O contador do Pix (expira de verdade, vem da Appmax) e o relógio do teste de preços (até 20/11 23h59, data real) continuam.
- **Decisão do Lucas (13/11, tarde):** ele mandou devolver o contador de 15 minutos ("volte meu contador agora"). Voltou como aviso só visual, com texto neutro ("Você tem 15 minutos para finalizar com tranquilidade"), em preto e dourado; não bloqueia a compra nem muda preço. A decisão é dele.
- Como desfazer: git revert desta PR.

## 13/11/2026 (16h10) — rotina automática, só conferência
- Meta (30 dias até 12/11; hoje ainda não fechado): igual às rodadas anteriores: conta R$ 1.115,40; FRIO Combo Banana e Mel ativo e Remarketing MORNO 30D ativo; demais desativadas; 20 rascunhos não publicados; nenhuma reprovada visível. Colunas de carrinho/compra não carregam em texto: sem número novo de compras.
- Site no ar: home 200 em 1,6 s (um pouco mais lenta que as 12h10). Clarity e pixel não reabertos. Mudança do dia: nenhuma ("ainda é cedo": menos de 100 visitas pagas após a última mudança). Orçamento mantido em R$ 30/dia.
- Como desfazer: nada alterado além deste diário.

## 13/11/2026 (17h30) — relatório diário e compra teste segura
- Compra teste sem pagar: Botox Vonix → carrinho → checkout, CEP 01310-100: frete JeT Standard grátis, total Pix R$ 175,82, botão "Gerar Pix" liberado, sem erro (desktop e 390 px). Só 1 opção de frete apareceu para esse CEP.
- Pixel Meta ("Vonix | E-commerce"): PageView e Ver conteúdo há 52 min; Adicionar ao carrinho e Iniciar finalização há 2 h; Compra: último evento há 3 dias (sem venda nova).
- Anúncios 6–12/11: R$ 412,70; FRIO Combo Banana e Mel R$ 387,01 (8,7 mil impressões); Remarketing MORNO R$ 6,51. Sem número de carrinho/compra legível. Orçamento mantido, sem mudança.
- Relatório completo: Vonix - Atendimento\relatorio-2026-11-13.md. Como desfazer: nada alterado além deste diário.

## 14/11/2026 — rotina Clarity (só observação, sem mudança no site)
- Clarity (3 dias): 125 sessões (113 de bot excluídas). Funil: 70 viram produto → 20 abriram checkout → 10 frete → 3 pagamento. Maior queda: frete → pagamento (10 → 3) e anúncio → produto (muitas sessões do Instagram/Facebook saem em menos de 1 min sem clique). Erros de JS: só "java object is gone" (webview do app, sem efeito) e "script error". Desempenho 76/100, LCP 3,4 s (precisa melhorar).
- Google Analytics (G-J8TYLB425K): não abriu neste login (pede criar propriedade), sem dados lidos.
- Nenhum Pix gerado sem pagamento nem erro de pagamento visto. Não achei um bug único e claro sem assistir às gravações do checkout: próximo passo é abrir as gravações de fhhwpm/i4q1zj/w5nf9k (mobile, saíram em /checkout) e o LCP.
- Como desfazer: nada alterado além deste diário.

## 14/11/2026 (noite) — preços de depois do teste e Black Friday (ordem do Lucas: "pode mexer nos preços em tudo", teto de R$ 100/dia de anúncio)
- O teste de preços continua até 20/11 23h59 (nada muda hoje no site). Mudou o que vale **depois** do teste: os preços de `products.json` caíram dos antigos (ex.: Fio de Luz R$ 191,90 → R$ 131,90; Botox R$ 180,90 → R$ 126,90; Combo Banana e Mel R$ 169,90 → R$ 122,90) para uma faixa entre o preço de teste e o antigo, calculada pela margem de cada produto (tabela de distribuidores do dono, mantida fora do repositório porque ele é público). Motivo: com o preço de teste a margem por pedido é pequena e não paga anúncio de R$ 100/dia; com o preço antigo ficava caro demais para a conversão. Meta de margem: mais folga nos produtos principais (química, kits, máscaras grandes) e preço do teste mantido nos de entrada (shampoos, ampolas, finalizadores), que ajudam a fechar o carrinho.
- Produtos sem custo na tabela (Lift em gel, Selagem Diamond, Perfume capilar, Shampoo Anabolizante, Kit Coco Nutri, Kit Monovonix 260 ml) ficaram com preço estimado por semelhança: conferir com o custo real.
- Black Friday: Botox e Botox Line/Matizador passam de 30% para 25% (com o preço base novo, 30% deixaria a margem abaixo do aceitável). Kits 20% e Fio de Luz 15% mantidos; continua valendo o maior entre BF e leve 2/leve 3.
- O feed do catálogo da Meta lê `products.json` na hora: acompanha o preço novo sozinho em 21/11.
- Não consegui mexer na Meta: o Chrome conectado está numa conta do Facebook que não tem a conta de anúncios da Vonix. Plano pronto (CBO única, R$ 100/dia no máximo, pausar o MORNO) aguardando acesso.
- Como desfazer: git revert desta PR (os preços antigos voltam; o teste continua igual).

## 14/11/2026 (noite) — teste de preços encerrado hoje e campanha pausada (ordem do Lucas: "resolva tudo hoje", sobram só ~R$ 1.000 para gastar)
- Ordem do Lucas: não esperar 20/11. `teste-precos.json` agora tem `fim` no passado, então valem desde já os preços novos de `products.json` (PR #183: ex.: Fio de Luz R$ 131,90, Botox R$ 126,90, Combo Banana e Mel R$ 122,90). O relógio "preços baixos por tempo limitado" some sozinho. Testes atualizados.
- Meta: a campanha LUCAS NOVA (Advantage+, MG e SP, cabeleireiras, R$ 100/dia) foi **pausada**: R$ 281 gastos, 13 carrinhos, 1 compra (CPA R$ 281, acima da margem por pedido). Só religa com o site já com os preços novos e com limite de gasto na campanha, para não passar do que o Lucas ainda pode gastar.
- Como desfazer: git revert desta PR devolve o teste (e seus preços) até a data antiga; religar a campanha é o interruptor no Gerenciador.

## 14/11/2026 (conferência automática) — só observação
- Site no ar: home 200 em 0,9 s, loja 200 em 0,2 s (servidor, sem navegador).
- Meta Ads: o Gerenciador não carregou no Chrome (página travou, sem texto nem captura); sem números novos. Campanha LUCAS NOVA segue pausada pela ordem do Lucas (14/11 noite).
- Clarity, compra teste e celular 390 px não reabertos nesta rodada. Nenhuma mudança no site ou anúncio; "ainda é cedo" (menos de 100 visitas pagas após a mudança de preços).
- Como desfazer: nada alterado além deste diário.
