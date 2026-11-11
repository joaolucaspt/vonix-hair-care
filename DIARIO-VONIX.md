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
- [ ] 1. Anúncio no destino certo: nenhum anúncio de venda deve levar a /seja-afiliada ou plex-vonix; direto ao produto (botox ou fio de luz).
- [ ] 2. Velocidade no celular (meta: abrir em menos de 2,5 s no 4G). Sem mexer nos scripts do Meta e do Google.
- [ ] 3. Prova social real perto do botão de comprar (nota média e quantidade). Parte já feita em 10/11 (PR 88 e 89).
- [ ] 4. Frete antes do checkout (campo de CEP no produto) e barra "falta R$ X" (já existe no carrinho). Preço e regra de frete só com aprovação.
- [ ] 5. Recuperação de carrinho na Appmax: ver se existe; se não, descrever como ativar.
- [ ] 6. Teste de compra semanal sem pagar (botão, carrinho, checkout, evento Purchase).
- [ ] 7. Ordem das seções da página de produto; manter a barra fixa de compra.
- [ ] 8. Botão de WhatsApp de dúvidas com mensagem pronta.
- [ ] 9. Criativos novos: pausar anúncio com 3+ dias de gasto e sem carrinho; propor 2 por semana.
- [ ] 10. Regra de parar e pensar: com menos de 100 visitas pagas após uma mudança, não trocar outra coisa grande.
