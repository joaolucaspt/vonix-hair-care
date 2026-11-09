# Vonix Hair — Matriz de fechamento da auditoria comercial e técnica

**Data:** 09/11/2026 — **Escopo exclusivo:** e-commerce `lucassilva1175/vonix-hair-care`, PR **#26** (`fix/vonix-ecommerce-auditoria-2026-11-09`). Não abrange o projeto separado de afiliadas nem altera dados ou integrações reais de produção.

## Sem confundir código, loja publicada e receita

A auditoria inicial (`AUDITORIA-2026-11-03.md`) levantou 20 itens. Este documento atribui um estado e uma evidência a **cada um**, além das novas verificações. “Corrigido na branch” **não** significa “publicado”; “HTTP 200, CTA habilitado” **não** significa “pedido pago”.

**Visita publicada read-only** em 09/11: 43 páginas de produto GET; **43/43 preços iguais ao catálogo local** e **43/43 canonicals encontrados**. **43/43 descrições ainda exibem nomes de transportadoras desatualizados em produção**, corrigidos nesta branch. Produto “Combo Banana e Mel” mostra R$ 169,90 na home e PDP, e R$ 161,41 no Pix. O fluxo público “Comprar agora” leva a `/carrinho`; no PR já existe a correção de compra direta. Ao prosseguir ao checkout e informar CEP público 30140-010, o botão Pix ficou habilitado; **não** foi acionado. Nenhuma transação foi criada ou confirmada, nenhuma credencial foi consultada. Valor de página/GA4 não equivale a receita.

## Matriz item por item da auditoria de 03/11

| Nº | Área / achado original | Situação comprovada em 09/11 | Ação ou bloqueio real |
|---:|---|---|---|
| 01 | Pagamentos “ambiente de testes” e checkout inutilizável | **Parcial / não homologado.** A loja publicada já permite selecionar frete e habilita CTA Pix; cobrança, aprovação, estorno, antifraude, cartão e entrega não foram executados | **P0** homologar Appmax sandbox, migrações e conciliação antes de mesclar PR de pagamento |
| 02 | Pixel Meta ausente | **Corrigido em código; entrega live não aferida.** `META_PIXEL_ID` configurado, eventos existentes, CAPI bloqueia Purchase não verificado | Validar Events Manager, consentimento, deduplicação e origem de sessões |
| 03 | IDs de eventos diferentes do catálogo Meta | **Comprovado no feed público quanto ao código do catálogo.** 43/43 IDs, preços, links e imagens batem; ainda não há conferência dentro do painel Commerce Manager | Comparar feed atual e Catálogo Meta no painel; confirmar aliases e variações |
| 04 | Prévia OG quebrada no compartilhamento | **Corrigido em código.** URLs absolutas para OG de produtos, imagem principal configurada | Verificar WhatsApp/Facebook Sharing Debugger após publicação |
| 05 | Preços “de/por” sem comprovação histórica | **Pendente de evidência comercial.** 43/43 preços atuais batem no SSR; **isso não comprova** que preços “de” foram praticados | Validar política e histórico de preços e promoções antes de divulgação |
| 06 | Cards com selos excessivos e estrelas vazias | **Parcial.** Estrelas vazias foram suprimidas na base anterior; apresentação exige revisão em dispositivos reais | Não adicionar selos/escassez sem evidência; simplificar itens visualmente onde necessário |
| 07 | Repetição excessiva de produtos na home | **Corrigido no código anterior.** Lista “Todos os Produtos” remove os já exibidos nas vitrines acima | Acompanhar CTR da home no GA4/Clarity; banner/carrossel pode repetir produtos por design |
| 08 | Garantia e devolução escondidas | **Corrigido em código anterior.** Página de produto liga aviso dos 7 dias à política | Verificar clareza, destaque e coerência jurídica após publicação |
| 09 | Autoridade fraca, sobre com promessas genéricas | **Parcial / texto depurado nesta branch.** Removidas alegações não comprovadas de teste universal/sustentabilidade e SLA de resposta | Validar prova de vendas, CNPJ, origem dos produtos e credenciais reais antes de criar provas adicionais |
| 10 | Depoimentos escassos e vídeos de 11 MB | **Parcial.** Há vídeos na biblioteca, componente usa `preload="none"`; não foi comprovada representatividade e autorização de cada depoimento | Conferir permissão de uso, qualidade e transcodificação; não fabricar depoimentos ou contagens |
| 11 | Captura de leads sem follow-up | **Parcial.** Cadastro só declara sucesso se webhook responde 2xx; cupom agora comunica regra real | Configurar/validar webhook de leads e consentimento; sequência de boas-vindas exige provedores homologados |
| 12 | Avaliações dependentes do Supabase | **Parcial.** Funções aceitam armazenamento controlado ou webhook, falham sem falso sucesso | Staging Supabase com segurança, moderação, rate-limit distribuído e critérios de aprovação |
| 13 | Meta descriptions muito curtas | **Corrigido em código anterior.** Produtos têm descrições elaboradas | Conferir Search Console após publicação |
| 14 | Canonical ausente | **Comprovado em produção para 43/43 produtos.** Home, loja e institucionais têm regra canonical no código | Verificar sitemap e indexação no Search Console; 404/noindex nos caminhos não indexáveis |
| 15 | H1 da loja muda conforme audiência | **Questão de SEO aberta.** H1 muda para categoria/canal; canonical continua em `/loja` | Decidir estratégia de landing pages orgânicas e medir demanda; não misturar URLs canônicas com buscas filtradas |
| 16 | JSON-LD com imagens relativas e dados incompletos | **Parcial, risco confirmado.** Imagens absolutas e política de devolução na oferta; feed público marca 43/43 como `in stock` sem estoque operacional verificado | **P0** validar disponibilidade de cada SKU antes de alimentar feed/publicidade com `in stock` |
| 17 | Cabeçalhos de segurança ausentes | **Corrigido em produção para CSP frame-ancestors, HSTS, Permissions, Referrer, nosniff.** Nesta branch, fallback SSR 500 também aplica CSP/Permissions | CSP completa para scripts/consentimento e hardening ainda dependem de homologação |
| 18 | Performance ruim, banners e vídeo pesados | **Parcial.** Home usa imagens WebP menores; MP4 grande usa `preload="none"`; arquivos PNG antigos ainda existem, uso não confirmado | Lighthouse real mobile com rede fria, compressão de vídeo e validação LCP/INP/CLS com dados do período |
| 19 | Toques pequenos e tipografia reduzida no mobile | **Parcial.** Prévia local 390×844/1366×768 sem overflow, imagens quebradas ou JS errors; banner adicional validado em 320/390/1366 px, 44 px nas setas e 40 px nos indicadores. Não equivale a auditoria de acessibilidade completa | Revisar alvos 44 px, teclado, foco, leitores de tela e zoom real; testes com usuário |
| 20 | Página 404 própria não avaliada | **Verificado em produção**: rota inexistente retorna HTTP 404 com tela “Página não encontrada” | HTTP 404 público conferido; falta apenas teste de teclado/leitor de tela |

## Achados novos desta continuidade

| ID | Severidade | Achado | Evidência/solução |
|---|---|---|---|
| N01 | Alta | Descrições antigas prometiam Loggi/Total Express embora checkout filtre empresas | 43/43 páginas com texto antigo em produção, substituídas no catálogo da branch por texto condicionado à cotação real |
| N02 | Alta | Cupom podia comunicar “aplicado” mesmo sem item elegível | Checkout agora calcula desconto com o motor comercial antes de confirmar, mostra economia em itens elegíveis e explica rejeição |
| N03 | Média | “5% Pix” e “em qualquer compra” ocultavam exclusão de linhas já promocionais | Rótulos de Pix, roleta, cadastro, cupom e checkout atualizados sem alterar descontos/códigos |
| N04 | Média | Estimativa na PDP podia anunciar “Frete Grátis” sem nenhuma cotação válida | Agora só mostra grátis se existe pelo menos uma opção real marcada como gratuita; cotação vazia informa indisponibilidade |
| N05 | Média | Mensagens genéricas “Compra 100% segura” e alegações institucionais não verificadas | Copy mais objetiva e sem promessas de 100%; removidas declarações não verificadas na página Sobre/Contato |
| N06 | Média | Resposta de erro 500 capturada na camada SSR não garantia os mesmos cabeçalhos da resposta normal | Fallback SSR centralizado em `fallbackErrorResponse` com CSP/Permissions; regressão automatizada |
| N07 | Média | Testes de preço misturavam cenário antigo R$ 154,90 com preço atual R$ 169,90 | Testes do produto atual usam valor do catálogo, preservando cenários unitários hipotéticos claramente identificados |
| N08 | Média | “Comprar agora” da loja live ainda insere etapa `/carrinho` | PR #26 já encaminha diretamente para checkout; **não está comprovadamente publicado** |
| N09 | Informativo | Suspeita inicial de preço inconsistente 154,90 × 169,90 | **Refutada pela leitura direta**: 43/43 preços públicos coincidem com a base atual; não corrigir preços sem evidência |
| N10 | Alta | Checkout publicado habilita Pix após CEP, mas situação do pagamento real é desconhecida | Bloquear classificação “pagamentos funcionando” até reconciliação de pedidos pagos e Appmax sandbox |
| N11 | Média | Banner da home tinha setas 36 px e indicadores clicáveis de ~12 px | Áreas de toque ampliadas, indicador com `aria-pressed` e foco visível; **320/390/1366 px validados no browser** |
| N12 | Alta | Feed Meta informa `in stock` para produtos sem estoque verificado | 43/43 anúncios estruturados assim no feed público; reconciliação com estoque físico por SKU é pré-requisito, sem mudança automática de status |
| N13 | Informativo | Integração de catálogo Meta poderia ter IDs, valores ou URLs divergentes | GET público e parser CSV: **43/43 IDs, preços, links e imagens corretos**, sem itens desconhecidos; recibo em `VONIX_PUBLIC_META_FEED_AUDIT_20261109.json` |
| N14 | Alta | Novo checkout verde da `main` verificava `cfg.pixEnabled` para habilitar o botão até quando o método escolhido era cartão | Merge preserva layout sticky verde e SDK protegido; CTA valida método escolhido e SDK do cartão; teste com Pix desabilitado/cartão habilitado PASS |
| N15 | Média | Atualizações de produto na `main` poderiam ser perdidas ao resolver o conflito do JSON | Merge preserva nome “Botox Vonix sem formol”, fotos recentes, todos os preços e variantes da `main`; reaplica somente as 43 descrições de frete corrigidas |

## Evidências e validações técnicas

- Varredura pública sem efeitos externos: `scripts/audit-public-catalog.mjs --live`, recibo `docs/VONIX_PUBLIC_CATALOG_AUDIT_20261109.json`.
- Feed Meta publicado validado por `scripts/audit-public-meta-feed.mjs --live`; 43 itens, 0 divergências de preço/link/imagem, 43 declarados em estoque sem verificação operacional; recibo `docs/VONIX_PUBLIC_META_FEED_AUDIT_20261109.json`.
- HTTP públicos: `/sitemap.xml` com 43 URLs de produto (200), `/robots.txt` (200), rota inexistente personalizada (404).
- Prévia local isolada: 390×844 e 1366×768; home, produto, carrinho e checkout; 8 HTTP 200; scrollWidth igual à viewport; nenhuma exceção JS ou imagem quebrada detectada nos cenários acessados. Teste adicional dos botões do banner 320/390/1366 px: 44 px/seta, 40 px/indicador, sem overflow, avanço funcional, sem erro JS. **Não valida responsividade em todos os aparelhos**.
- Fluxo público verificado no Chrome headless com cliques até checkout e cotação de CEP público; **sem criar Pix, pedido ou cartão**.
- Testes unitários novos: preço e transportadoras, promoções/cupom, frete sem cotação, fallback HTTP 500 e verificação do método de pagamento habilitado. Após integrar a `main` mais recente: **373/373 testes aprovados em 50 arquivos**, TypeScript/build/ESLint direcionado PASS. Nenhuma mudança manual em afiliadas; diff em arquivos de afiliadas contra a `main` atualizada é zero.

## Bloqueios de homologação — não apagar/“dar como concluídos”

**P0 antes de deploy/merge de checkout:** Appmax sandbox (Pix, cartão, antifraude, estorno, perda de resposta), SQL em Supabase staging com backups e RLS, Bling sandbox (filtro `numeroLoja`, retorno, estoque e itens), dimensões/pesos reais por SKU, comprovante de estoque, Webhook e scheduler seguros, rastreamento `Purchase` deduplicado e consentimento/privacidade.

**P1 antes de prometer resultados comerciais:** histórico real dos preços “de”, política/comprovação de depoimentos, validação jurídica de textos/retorno/frete e prova de entrega/atendimento. Obter GA4/Clarity e Appmax **agregados** por canal e sessão para identificar perda de conversão; a sequência de contagens antigas (593 visitantes, 50 carrinho, 32 checkout) não permite inferir taxa de compra nem causalidade.

**P2 pós-homologação:** acessibilidade completa, auditoria Lighthouse em rede móvel fria, SEO Search Console, automação de e-mail com consentimento, testes A/B controlados de proposta de valor e prova social.

**Decisão de publicação:** manter PR #26 em revisão e produção intocada até portas P0 validadas. Backups e reversão por commit/PR sem reset/force push. A branch de afiliadas pertence a outro fluxo e não deve ser modificada.
