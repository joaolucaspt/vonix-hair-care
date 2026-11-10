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

| N16 | Alta | Barra e resumo de frete da `main` anunciavam entrega gratuita como garantida antes de consultar o CEP | Mantida a identidade verde, mas comunicação passa a indicar elegibilidade condicionada à cobertura; total de produtos explicitamente sem frete até cotação; regressões de interface acrescentadas |
| N17 | Alta | Nova prioridade de frete grátis rápido não usava a validação defensiva anterior das cotações | Integração seleciona serviço em até 3 dias apenas entre cotações válidas; na ausência mantém prazo real da opção disponível, testando também opção rápida inválida |
| N18 | Média | Um depoimento em vídeo tinha quase 12 MB | Transcodificado com duração/resolução preservadas e SSIM 0,984; entrega passou a 6,25 MB (47,7% menor), com teste de orçamento de mídia |

| N19 | Alta | Navegador com armazenamento local bloqueado podia abortar a adição de produtos ao carrinho | Reproduzido no Chrome (erro `Storage denied`, carrinho vazio). Estado em memória com `setItem` protegido e cache do CEP opcional; regressões e navegação SPA confirmadas. Recarregar sem armazenamento ainda perde os itens. |
| N20 | Alta | Preview/localhost carregava GA4 e Clarity da operação, podendo contaminar o funil | Duas requisições reproduzidas, bloqueadas no teste, e eliminadas. GA4/Clarity inicializam apenas no domínio canônico; teste de origem PROD/preview PASS. Consentimento LGPD ainda pendente. |
| N21 | Média | Anúncios de Pix/frete e SEO/política divergiam das restrições comerciais | Copy de homepage, vitrine, PDP, informações institucionais, meta/OG e política: até 5% no Pix em itens elegíveis, frete grátis condicionado ao CEP. |
| N22 | Média | Botões pequenos 8/32/36 px persistiam na home/loja/PDP | Ampliados favoritos, conta/carrinho, carrossel, galeria e compartilhar. 9 verificações em Chrome 320/390/1366 px sem overflow, controles testados menores que 40/44 px ou exceções JS. Auditoria completa de acessibilidade ainda aberta. |
| N23 | Média | Mudança de variante na PDP não atualizava evento `view_item` | Efeito agora considera variante/preço; Chrome verificou primeiro `250ml` e depois `1L` no kit-cachos. |
| N24 | Informativo | Revisão de 43 produtos deve ser repetível, não baseada em inspeção manual desconectada | `scripts/audit-ssr-storefront-c3.mjs` e recibo JSON: 43/43 HTTP 200, SEO canonical/OG, preço JSON-LD, imagens, política de promoções; sitemap 43, 404 correto. Sem inferir estoque real. |

| N25 | Média | Botão da sacola nos cards obrigava abrir a página do produto mesmo quando só havia uma variante | 39/43 itens com uma opção agora usam adição direta com `add_to_cart`; 4 itens multivariantes ainda exigem escolha. Três testes específicos e navegação Chrome com produto em carrinho aprovados. |

| N26 | Alta | GA4, Clarity e Meta Pixel iniciavam no domínio publicado sem escolha expressa de cookies opcionais | Bootstrap default-deny com consentimento versionado, opção aceitar/recusar/reabrir/revogar, política atualizada, 14 testes de consentimento/bootstraps + validação Chrome com requisições externas interceptadas. |
| N27 | Alta, correção técnica C5 / staging pendente | Meta Purchase por servidor podia ser enviado sem consultar consentimento do comprador | Snapshot do checkout registra aceite v1 com data de servidor; backend/SQL filtram pedidos sem aceite. PostgreSQL sintético PASS; **ainda sem aplicação no staging/produção, revisão jurídica ou revogação tardia**. |
| N28 | Média | Página institucional anunciava 480 vendas, entrega universal e SLA de atendimento sem documentação comprobatória nesta auditoria | Substituídas por descrições sem números não verificados e cobertura por CEP. Obter provas reais antes de divulgar contagem e prazos de atendimento. |

| N29 | Alta | Recuperação CAPI consultava pedidos históricos sem aceite, inclusive após regra do backend | SQL de seleção e claim exige consentimento v1; quatro pedidos sintéticos em PostgreSQL 16 PASS, sem acesso por roles públicas. Migrar/homologar em staging antes de uso real. |
| N30 | Média | Checkout prometia envio de confirmação por e-mail/WhatsApp sem evidência de automação transacional homologada | Telas de Pix e cartão agora orientam guardar número do pedido e consultar acompanhamento/atendimento; regressão em teste. |
| N31 | Alta, ainda pendente | Revogação de cookies após a criação do pedido não é automaticamente propagada ao snapshot server-side | Risco documentado; depende de ledger e endpoint autenticado, validação de identidade, bases legais e staging. Não declarar conformidade LGPD integral. |

| N32 | Alta | Perda da resposta HTTP de pagamento mostrava “Tente novamente” apesar de cobrança poder ter sido iniciada | Cliente vê “Pagamento em verificação”, sem CTA para segunda cobrança, com mensagem segura e atendimento; o backend marca sua falha ambígua como `retrySafe:false`. |
| N33 | Alta | Atualizar a aba enquanto `createPayment` estava pendente poderia apagar o estado da tentativa e convidar outra compra | `sessionStorage` recebe apenas método e horário **antes** da requisição, preserva bloqueio local temporário, sem PII; erro conhecido seguro limpa o marcador. Idempotência de backend continua necessária para outras abas e dispositivos. |

| N34 | Média | Área “Meus pedidos” só oferecia WhatsApp apesar de checkout sugerir consulta de pedidos | Consulta de status para pagamentos recentes guardados nesta aba, usando capacidade assinada já existente, sem expor token; seis cenários + teste de método incerto. Histórico de pedidos antigos permanece no suporte. |
| N35 | Alta | API pública CAPI aceitava eventos opcionais sem sinal explícito de consentimento nem origem de navegador | Exige `consent:true`, origem canônica e `Sec-Fetch-Site: same-origin` (ou equivalente seguro), preserva bloqueio de Purchase. Cabeçalhos são falsificáveis; revisão LGPD e WAF seguem pendentes. |
| N36 | Média | CAPI público repassava estruturas de `customData` arbitrárias e confiava em IP de `X-Forwarded-For` | Validação estrita de conteúdo com Zod, limites para preços/IDs/quantidades e IP somente se fornecido via `cf-connecting-ip` válido. |
| N37 | Alta | Bootstrap PageView inicial não incluía campo de consentimento exigido pela nova API, arriscando perder eventos legítimos | Adicionado `consent:true` e nova verificação no momento da chamada; testes unitários e navegador com interceptação comprovaram PageView e AddToCart aceitos após opt-in, zero eventos antes. |

| N38 | Alta | “Meus pedidos” usava `paid:true` de sessão local para declarar pagamento confirmado sem Appmax | Exigir `getOrderStatus` autenticado; iniciar toda consulta como não verificada. Regressão inclui `paid:true` adulterado e confirmação apenas por resposta do servidor. |
| N39 | Alta | Checkout descartava pedido pendente quando `paid:true` estava armazenado, reexibindo tentativa de compra | Restaurar todo pedido válido em análise até confirmar status autenticado, sem CTA de nova cobrança. Chrome 320/390/1366 px com sessão adulterada PASS. |
| N40 | Alta | SQL de idempotência usava `SECURITY DEFINER` com `search_path=public` | As três funções passaram a `search_path=''`; PostgreSQL 16 isolado e teste sintético passaram após corrigir a assertiva de serialização. **Não aplicado no Supabase operacional/staging**. |

| N41 | Média | Nova `main` com cabeçalho móvel gerou conflito na integração e 9 px de overflow na PDP a 390 px | Mesclados layout móvel compacto e rodapé de consentimento, CTA “Pedidos” preservado; rótulo oculto apenas na PDP móvel, sem overflow em 320/390/1366 px. |
| N42 | Alta | Plex Vonix excluído por falta de estoque, mas SSR C3 ainda esperava 43 produtos e marcava o 404 intencional como falha | Auditor agora acompanha catálogo ativo e exige 404 para excluídos: 43 no JSON, 42 vendáveis, 42/42 SSR, 42 URLs no sitemap, 42 no feed Meta, Plex indisponível. Três testes de contagem atualizados. |

## Recibo C8 — integração da main (09/11)

**469/469 testes em 62 arquivos**, TypeScript/build/lint PASS, SSR **42/42** com `plex-vonix` 404. Chrome em 320/390/1366 px sem overflow, prevenção a `paid:true` falsificado preservada. Com as mudanças da `main` `0bd0643`, diferenças em arquivos de afiliadas: **zero**. Registro: `docs/VONIX_C8_MAIN_INTEGRATION_20261109.md` e `docs/VONIX_C8_MAIN_INTEGRATION_RECEIPT_20261109.json`. O CI do merge deve ser conferido no GitHub; não há deploy ou operação real.

## Recibo C8 (09/11)

**445/445 testes PASS em 59 arquivos**; TypeScript/build/ESLint PASS; SSR **43/43**, Chrome anti-spoof 320/390/1366 PASS, PostgreSQL 16 temporário PASS. Evidências: `docs/VONIX_AUDITORIA_CONTINUIDADE_C8_20261109.md`, `docs/VONIX_C8_VERIFIED_RECEIPT_20261109.json` e `scripts/qa-checkout-idempotency-hardened.sql`. O workflow de e-commerce agora inclui um job isolado de PostgreSQL, com validação remota pendente até CI. A aplicação de SQL em staging e a homologação Appmax ainda exigem autorização e evidência externa.

## Recibo C7 (09/11)

**441/441 testes PASS em 59 arquivos**, TypeScript/build/ESLint PASS, SSR **43/43**. Chrome validou área de pedidos em 320/390/1366 px e PageView/AddToCart com consentimento e origem em domínio simulado, sem comunicação externa real. Ver `docs/VONIX_AUDITORIA_CONTINUIDADE_C7_20261109.md` e `docs/VONIX_C7_VERIFIED_RECEIPT_20261109.json`. Não substitui homologação operacional.

## Recibo C6 (09/11)

Os testes C6 incluem perda de resposta, retorno ambíguo, tentativa durante a requisição, refresh, expiração e armazenamento bloqueado. A validação final e o status remoto são documentados em `docs/VONIX_AUDITORIA_CONTINUIDADE_C6_20261109.md` e no recibo C6. **Sem homologação de cobranças reais.**

## Recibo C5 (09/11)

Compra continua independente de marketing; o snapshot versiona aceite opcional e a Meta só recebe Purchase aprovado com opt-in. **421 testes iniciais PASS, PostgreSQL 16 real descartável PASS**. Suite final e CI devem ser verificados depois das últimas edições. Ver `docs/VONIX_AUDITORIA_CONTINUIDADE_C5_20261109.md` e `docs/VONIX_P0_STAGING_RUNBOOK_20261109.md`.

## Recibo adicional C4 (09/11)

Controle de privacidade: **413/413 testes em 57 arquivos**, TypeScript/build/lint direcionado PASS e SSR **43/43**. Chrome testou primeira visita, recusa, aceite e revogação com todas as chamadas de terceiros interceptadas, e responsividade 320/390/1366 px. Recibos: `VONIX_AUDITORIA_CONTINUIDADE_C4_20261109.md`, `VONIX_C4_VERIFIED_RECEIPT_20261109.json`, `VONIX_CONSENT_BROWSER_AUDIT_20261109.json`. Não substitui revisão jurídica nem homologação dos pagamentos.
## Evidências e validações técnicas

- Varredura pública sem efeitos externos: `scripts/audit-public-catalog.mjs --live`, recibo `docs/VONIX_PUBLIC_CATALOG_AUDIT_20261109.json`.
- Feed Meta publicado validado por `scripts/audit-public-meta-feed.mjs --live`; 43 itens, 0 divergências de preço/link/imagem, 43 declarados em estoque sem verificação operacional; recibo `docs/VONIX_PUBLIC_META_FEED_AUDIT_20261109.json`.
- HTTP públicos: `/sitemap.xml` com 43 URLs de produto (200), `/robots.txt` (200), rota inexistente personalizada (404).
- Prévia local isolada: 390×844 e 1366×768; home, produto, carrinho e checkout; 8 HTTP 200; scrollWidth igual à viewport; nenhuma exceção JS ou imagem quebrada detectada nos cenários acessados. Teste adicional dos botões do banner 320/390/1366 px: 44 px/seta, 40 px/indicador, sem overflow, avanço funcional, sem erro JS. **Não valida responsividade em todos os aparelhos**.
- Fluxo público verificado no Chrome headless com cliques até checkout e cotação de CEP público; **sem criar Pix, pedido ou cartão**.
- Testes unitários novos: preço e transportadoras, promoções/cupom, frete sem cotação, fallback HTTP 500 e verificação do método de pagamento habilitado. Após integrar a `main` mais recente: **373/373 testes aprovados em 50 arquivos**, TypeScript/build/ESLint direcionado PASS. Nenhuma mudança manual em afiliadas; diff em arquivos de afiliadas contra a `main` atualizada é zero.

## Evidência adicional da continuidade C2 (09/11)

A integração da `main` até `06f15b6` preserva a seleção de entrega rápida e o estilo verde do carrinho sem perder validação de cotações nem evento `add_to_cart`. A suíte completa passou com **382 testes em 52 arquivos**, TypeScript/build/ESLint direcionado passaram e a navegação produto → carrinho → checkout foi confirmada em Chrome local em 390 e 1366 px. O depoimento de vídeo mais pesado foi reduzido em 47,7%, com duração/resolução preservadas e SSIM 0,984. A auditoria de navegador em abertura fria exige verificação adicional de hidratação em rede limitada; com espera de interatividade, o fluxo passou.

## Bloqueios de homologação — não apagar/“dar como concluídos”

**P0 antes de deploy/merge de checkout:** Appmax sandbox (Pix, cartão, antifraude, estorno, perda de resposta), SQL em Supabase staging com backups e RLS, Bling sandbox (filtro `numeroLoja`, retorno, estoque e itens), dimensões/pesos reais por SKU, comprovante de estoque, Webhook e scheduler seguros, rastreamento `Purchase` deduplicado e consentimento/privacidade.

**P1 antes de prometer resultados comerciais:** histórico real dos preços “de”, política/comprovação de depoimentos, validação jurídica de textos/retorno/frete e prova de entrega/atendimento. Obter GA4/Clarity e Appmax **agregados** por canal e sessão para identificar perda de conversão; a sequência de contagens antigas (593 visitantes, 50 carrinho, 32 checkout) não permite inferir taxa de compra nem causalidade.

**P2 pós-homologação:** acessibilidade completa, auditoria Lighthouse em rede móvel fria, SEO Search Console, automação de e-mail com consentimento, testes A/B controlados de proposta de valor e prova social.

**Decisão de publicação:** manter PR #26 em revisão e produção intocada até portas P0 validadas. Backups e reversão por commit/PR sem reset/force push. A branch de afiliadas pertence a outro fluxo e não deve ser modificada.

## Auditoria C9 — carrinho antigo e disponibilidade (09/11)

| ID | Prioridade | Falha | Correção e prova |
| --- | --- | --- | --- |
| N43 | Alta | Carrinhos persistidos continham Plex Vonix indisponível, variantes antigas ou dados malformados, deixando armazenamento e UI divergentes | Revalidar SKU, variante e quantidade em carregamentos/mutações; retirar somente itens inválidos, persistir sacola limpa e mostrar aviso não pessoal. Chrome testou três cenários antigos com preservação de itens válidos |
| N44 | Alta | Complemento promocional poderia permanecer após remover o item-base ou ser usado sozinho em mais vendidos | Recalcular elegibilidade após cada mutação; exigir base ativo no cliente e no servidor; remoção de item principal ao vivo extinguiu a oferta, e falsificação foi recusada antes do pagamento |
| N45 | Alta | Produto retirado do catálogo gerava erro de compra ambígua mesmo sem haver chamada à Appmax | Cotação e checkout distinguem rejeição de catálogo de falha incerta de gateway; mensagem para revisar sacola, `retrySafe:true`, nenhum frete/intent/customer/order/Pix em teste simulado |

**Recibo C9:** **475/475 testes Vitest em 62 arquivos**, TypeScript/ESLint/build PASS, Chrome com normalização de carrinho e atualização de oferta em 390/1366 px PASS; SSR **42/42** com `plex-vonix` HTTP 404. Ver `docs/VONIX_AUDITORIA_CONTINUIDADE_C9_20261109.md` e `docs/VONIX_C9_VERIFIED_RECEIPT_20261109.json`. **Homologação Appmax, Supabase staging, Bling, estoque físico, consentimento tardio e desempenho comercial real continuam P0/P1.**

## Auditoria C10 — GA4 e consentimento na integração com main (09/11)

| ID | Prioridade | Achado | Correção e evidência |
| --- | --- | --- | --- |
| N46 | Alta | PR tinha ID de GA4 antigo, enquanto `main` alterou oficialmente para `G-J8TYLB425K` (`8c8bf6b`), causando falha no teste de integração Linux | Herdado GA4 atualizado com merge conservador da `main` e teste alinhado ao novo ID; Chrome confirmou URL exata e eventos apenas após consentimento |
| N47 | Alta | Versão atual da `main` tinha inicialização GA4/Clarity/Pixel sem a guarda de opt-in do PR; risco de regressão de privacidade | Merge manteve `__vonixMarketingAllowed`, restrição a domínio canônico e `consent:true` no PageView; teste impede tags externas estáticas incondicionais. **Não publicado: main operacional continua dependendo do merge/homologação** |

**Recibo C10:** **482/482 testes em 62 arquivos**, TypeScript/ESLint/build PASS, SSR **42/42**, Chrome com rede externa interceptada: zero tags sem consentimento e GA4 `G-J8TYLB425K` + Clarity/Pixel + PageView após aceitação. Arquivos `docs/VONIX_AUDITORIA_CONTINUIDADE_C10_20261109.md` e `docs/VONIX_C10_VERIFIED_RECEIPT_20261109.json`. Verificar ainda propriedade real do GA4 e requisitos P0; sem deploy.

## Auditoria C11–C12 — verdade temporal e financeira (09/11)

| ID | Prioridade | Problema | Correção verificada |
| --- | --- | --- | --- |
| N48 | Alta | Purchase podia usar o horário do worker como horário da compra quando Appmax não informava `paid_at` | Exigir ISO com fuso, dentro de seis dias e com instante verificável; sem dado confiável, não enviar Purchase ou criar claim. Testes UTC, fuso -03:00, hora local, ausência, datas antigas/futuras |
| N49 | Média | Recovery consultava pedidos sem `paid_at` a cada execução, sem informação nova | Adiamento de 60 min para campo ausente e 24 h para valor inválido/antigo; ERP e estado financeiro inalterados |
| N50 | Alta | Recuperação de pedido idempotente mostrava nova cotação/cupom/frete como se fosse o total original da compra | Ler snapshot financeiro persistido, conferir ID e calcular centavos exatos. Se falhar, não anunciar valor nem liberar nova cobrança. Testes alterando frete e Pix/cartão, snapshot ausente, de outro pedido, zero/overflow |
| N51 | Defesa | Complemento de endereço omitido nos mocks não reproduzia default do schema real | Normalização explícita `complemento ?? ""` ao criar cliente/snapshot, e teste com snapshot compatível; sem afirmar falha em produção |

**C11–C12:** **495/495 testes Vitest PASS em 63 arquivos**, TS/ESLint direcionado/build PASS e SSR **42/42**, Plex 404. Evidências em `docs/VONIX_AUDITORIA_CONTINUIDADE_C12_20261109.md` e `docs/VONIX_C12_VERIFIED_RECEIPT_20261109.json`. **Appmax sandbox, Supabase staging, Bling, revogação LGPD tardia, rate limit e receita real permanecem pendentes.**

## Auditoria C13 — recuperação segura quando a cotação muda (09/11)

| ID | Prioridade | Achado | Correção e prova |
| --- | --- | --- | --- |
| N52 | Alta | Frete indisponível escondia um pedido já reservado, pois checkout consultava transportadora antes da idempotência | Em falha de cotação, fazer GET somente leitura por fingerprint HMAC, recuperar snapshot e apresentar acompanhamento original; sem pedido existente, retorno seguro sem nova reserva. Vitest 524/524 |
| N53 | Alta | Mudança/retirada da opção de frete ou cupom expirado impedia consultar o pedido anterior | Fallback exclusivo para registro de idempotência preexistente; valor original do snapshot. Recusas seguras se não houver pedido/snapshot; cancelados e concluídos há mais de 24 h não ficam presos |

**C13:** 524/524 testes em 64 arquivos, TypeScript/ESLint/build PASS, SSR 42/42 e Chrome responsivo 320/390/1366 px após hidratação. Primeiro teste em Vite frio 320 px perdeu clique, não reproduzido após hidratação; produção não avaliada sob CPU/rede lenta. **Sem SQL nova nem pagamentos reais.** Recibo: `docs/VONIX_C13_VERIFIED_RECEIPT_20261109.json`. Homologar SELECT service_role e RLS no Supabase staging; restantes P0 preservados.

| N54 | Bloqueio de integração, aberto | Após testes C13, `origin/main` avançou para `6ce6952` com gaveta Comprar agora/checkout compacto e merge-tree apontou conflitos em checkout/PDP. Uma alteração local de checkout por outra sessão também está não commitada | **Não resolvido**: preservar worktree e commits anteriores; reconciliar checkout/PDP/buy-drawer com segurança sem descartar trabalho local; repetir QA e CI antes de merge/deploy |

## C15 — gaveta de compra, cotação e revisão da integração (09/11)

| ID | Prioridade | Achado | Status |
| --- | --- | --- | --- |
| N58 | Alta | Gaveta da main anunciava frete grátis com base no valor do carrinho, sem CEP nem cotação | **Corrigido na branch:** usa subtotal bruto para o limiar e comunica cobertura/prazo condicionados à cotação real. Não publicado. |
| N59 | Alta | Aviso de privacidade z100 interceptava CTA da gaveta z90 no mobile | **Corrigido e validado em Chrome:** drawer z110; QA local 320/390/1366, 3/3 PASS, consentimento preservado. |
| N60 | Média | Gaveta nova tinha controles de quantidade/fechamento de 28–36 px e ausência de ciclo de foco | **Corrigido na branch:** controles 44 px, foco/Tab/Shift+Tab/Escape, testes. |
| N61 | Alta | Nova main não preserva proteção financeira C11–C14 em checkout compacto, e PR #26 não é automaticamente integrável | **Bloqueio mantido:** portado drawer e upsell sem substituir checkout; três conflitos reais em merge-tree. Homologação e reconciliação ainda necessárias. |

**C15:** 535/535 testes, 66 arquivos, build e TypeScript exit 0, SSR 42/42, Chrome dev 3/3. A prévia de bundle Cloudflare via `vite preview` não funciona neste preset (falta entry `dist/server/server.js`); evidência negativa mantida, sem inferir falha de produção. Ver `VONIX_AUDITORIA_CONTINUIDADE_C15_20261109.md`.

## C16 — fechamento do checkout seguro com validação no browser (09/11)

| ID | Severidade | Falha reproduzida | Situação |
| --- | --- | --- | --- |
| N62 | Alta | `<button>` de retentativa de frete estava dentro de `<p role=alert>`, HTML inválido que pode gerar mismatch de hidratação | **Corrigido na branch auditada**, regressão React/Vitest |
| N63 | Média | CPF inválido exibia erro somente após os formulários, sem foco/acessibilidade contextual | **Corrigido**: foco no CPF, aria-invalid, descrição relacionada e limpeza após edição |
| N64 | Média | Checkout mobile apresentava total detalhado somente após o formulário longo; frete ainda não cotado pouco claro | **Corrigido**: faixa de resumo rápido com frete condicionado ao CEP, total dinâmico e link editar sacola |

**C16:** 539/539 testes PASS, 66 arquivos, build/TS/lint exit 0, SSR 42/42, Chrome local 3/3 (320/390/1366), sem operações financeiras. **Cinco conflitos de merge com `origin/main` 4d77dc2** e homologação real P0 permanecem pendentes. Ver `VONIX_AUDITORIA_CONTINUIDADE_C16_20261109.md`.

## C17 — cupom por teclado e controles de sacola (09/11)

| ID | Severidade | Achado reproduzido | Situação |
| --- | --- | --- | --- |
| N65 | Alta | Enter no campo de cupom dentro do checkout podia acionar submit de pagamento em vez de aplicar desconto | **Corrigido na branch auditada:** Enter aplica cupom local e evita submit; teste sem cobrança e Chrome 3/3 |
| N66 | Média | Carrinho usava nomes acessíveis ambíguos de controle, alvos pequenos e aumento além do limite sem feedback | **Corrigido:** identificações por produto/variante/oferta, 44px, limite 99 e layout flexível |
| N67 | Média | Vários botões "Adicionar" sem identificar sugestão no carrinho/gaveta | **Corrigido:** nome acessível por sugestão, testes de adição sem pagamento |
| N68 | Média | Cupom anterior permanecia ativo quando usuário testava código inválido sem mensagem explícita | **Corrigido:** Cupom ativo e economia elegível apresentados ao lado do erro, sem alterar cálculo server-side |

**C17:** 545/545 Vitest, 66 arquivos, TypeScript/build e ESLint focado aprovados, SSR 42/42 e Chrome 3/3 (320/390/1366). **Lint global Prettier falha** por formatação legada (12.428 erros); ESLint integral com `prettier/prettier: off` passou (exit 0). Cinco conflitos persistem com a `main` ed23f7e, com Appmax/Supabase/Bling em staging ainda pendentes. Ver `VONIX_AUDITORIA_CONTINUIDADE_C17_20261109.md`.

## C18 — conciliação `main` / checkout auditado e confirmação de indicação (09/11)

| ID | Severidade | Falha concreta encontrada na conciliação | Resultado |
| --- | --- | --- | --- |
| N69 | Crítica | O checkout compacto da main não preservava token autenticado de status, proteção de pedido reservado/idempotência e total revisado; resolução direta de `theirs` enfraqueceria o fluxo financeiro | **Prevenido**: cinco arquivos base auditada preservados; integração manual de cupom com revalidação server-side e testes |
| N70 | Alta | Cupons NOME10 da main não eram aceitos no checkout auditado; confiar apenas em cálculo local abriria desconto não autorizado | **Corrigido**: lookup somente servidor + revalidação antes do claim de cobrança, validação de preço, falha fechada e controle de corrida no cliente |
| N71 | Média | Popup recém-integrado prometia 10% “em qualquer compra”, apesar do cálculo negar desconto em itens com promoção | **Corrigido**: mensagem explicita itens elegíveis, eventual Pix adicional condicionado, alvos de toque de 44px |
| N72 | Média | CI não rodava regras de ESLint fora da dívida de formatação CRLF | **Corrigido**: job de ESLint real em CI, sem `--fix` global; formatação legada segue pendente |

**C18:** PR45 (`ed23f7e`) + PR46 (`cd91784`) integrados na branch auditada, não na main. 590/590 Vitest em 70 arquivos, TypeScript/build/ESLint sem Prettier aprovados, 42 SSR, 3 Chrome. Check de CI remoto/PR após push. P0 operacional segue **NOT_APPROVED**.

## C19 — busca na vitrine e controle explícito de privacidade (09/11)

| ID | Severidade | Problema reproduzido | Correção verificável |
| --- | --- | --- | --- |
| N73 | Média/privacidade | Checkout ocultava o banner até quando a pessoa abria voluntariamente as preferências pelo rodapé | **Corrigido:** sem pop-up automático na compra; preferência explicitamente reaberta, recusa preservada após reload; React/Chrome |
| N74 | Média/conversão | Busca na loja tinha somente Enter no teclado, sem botão de envio acessível em celulares | **Corrigido:** formulário `role=search`, botão Buscar 44px, Enter/teclado virtual e navegação interna por query |
| N75 | Baixa/robustez | Filtros de URL refletiam strings vazias, espaços externos e consultas sem limite no título e render | **Corrigido:** trim, descarte de vazio e limites de 120 caracteres para `q`, 80 para outros filtros |

**C19:** base C18 `3e03fcf`; PR #47 da `main` original sincronizado na branch de auditoria, sem tocar aplicativo de afiliadas separado. Após PR47: 596/596 Vitest em 71 arquivos, Chrome 3/3 (320/390/1366), SSR 42/42, TypeScript/ESLint sem Prettier/build exit 0. Pagamentos, banco operacional e deploy seguem bloqueados. Ver `VONIX_AUDITORIA_CONTINUIDADE_C19_20261109.md`.
