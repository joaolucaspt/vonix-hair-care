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

**Read-back C19 / main PR48:** `03df19a` incorporada sem conflitos à branch auditada, testes globais atualizados para **602/602, 71 arquivos**. Checkout e busca não receberam alterações adicionais; gates P0 reais permanecem pendentes.

## C20 — avaliações, estado SPA e áreas pessoais (09/11)

| ID | Gravidade | Falha reproduzida | Correção verificada |
| --- | --- | --- | --- |
| N76 | Média | Avaliação enviada para produto A fazia o produto B mostrar sucesso indevidamente quando `ReviewForm` permanecia montado | Corrigido: cada slug reconfigura formulário e consulta armazenamento somente daquele produto; testes de mudança de SKU |
| N77 | Média | Duas submissões no mesmo batch React podiam enviar duas avaliações; resposta tardia do SKU anterior podia afetar o atual | Corrigido: trava síncrona `sendingRef`, geração por SKU, recuperação após falha; não substitui deduplicação de servidor |
| N78 | Baixa/média | `/conta` e `/favoritos` não tinham diretiva `noindex` | Corrigido: `noindex, nofollow`, testes de meta e Chrome; **não equivale à autenticação** |

A `main` `0dc0dd8` (PR #49) foi incorporada **só** na branch auditada, zero conflitos; não editar app independente de afiliadas. C20: 611/611 Vitest em 72 arquivos, TypeScript/ESLint sem Prettier/build/Prettier alterados verdes, SSR 42/42, Chrome 3/3 (320/390/1366, 9 imagens), sem pagamentos ou reviews reais. Produção **NOT_APPROVED**. Documentação: `VONIX_AUDITORIA_CONTINUIDADE_C20_20261109.md`.

**C20, atualização da origem PR #50:** `96296d4` incorporado sem conflitos na branch auditada; nenhuma nova alteração aos módulos de e-commerce deste ciclo. Gates finais locais: **614/614 Vitest em 72 arquivos**, Chrome 3/3 em três resoluções após PR50, TypeScript, build e ESLint não formatação verdes. Homologação de serviços reais e `npm run lint` estrito permanecem pendentes.

## C21 — navegação entre abas e pesquisa normalizada (09/11)

| ID | Severidade | Defeito comprovado | Resultado |
| --- | --- | --- | --- |
| N79 | Média/alta | Favoritos em cache com JSON objeto causavam `favs.includes is not a function`; favoritos antigos/inexistentes não eram saneados | Corrigido: `migrateFavorites` valida e deduplica slugs ativos do catálogo, migração do cache, teste RED/GREEN e Chrome |
| N80 | Alta | Alteração de sacola e favoritos em outra aba não atualizava a tela, induzindo revisão de compra desatualizada | Corrigido: listener `storage` com assinaturas e revalidação, React notificado, checkout recalculado, **sem emitir pagamento** |
| N81 | Média | Público `sessionStorage` aceitava objeto JSON inválido como audiência | Corrigido: `migrateAudience` aceita somente `casa`, `salao` ou `null` |
| N82 | Média | Pesquisa ignorava diferenças de caixa, mas não acentos nem espaços extras: `mascara` versus **Máscara** | Corrigido: normalização Unicode e espaços, mantendo preço/ranking e limites da URL |

**C21:** base C20 `f04a8af`; QA de foco 9/9, integral **621/621 Vitest em 73 arquivos**, TypeScript, ESLint sem Prettier, build Cloudflare, SSR 42/42 e Chrome 3/3 em três resoluções, 12 screenshots, rede externa bloqueada. Produção **NOT_APPROVED**. Ver `VONIX_AUDITORIA_CONTINUIDADE_C21_20261109.md`.

**Read-back C21 / PR #51:** `dd1fae0` incorporado na branch auditada com 0 conflitos, sem alterações ao checkout/carrinho/catálogo implementados no C21. Após incorporação, **624/624 Vitest, 73 arquivos**, TypeScript, ESLint de código e build verdes; Chrome **3/3** (320/390/1366) também repetido. Riscos P0 e formatação histórica não foram liberados.

## C21 — reconciliação da origem: Kit/Combo sem regressão da segurança de frete

| ID | Gravidade | Risco detectado no merge | Tratamento |
| --- | --- | --- | --- |
| N83 | Alta | `products.json` upstream repunha promessa fixa de Loggi/Jadlog/Correios/Total Express para todos os 43 produtos, contra a auditoria de frete sob CEP | **Prevenido**: manter as 43 descrições de frete condicionadas à cotação, importar somente mudanças verificadas de nomenclatura e preservar preços/SKUs/variantes |
| N84 | Média | Renomear filtro `Combos` → `Kits` quebraria links antigos da loja e consultas por nome anterior | **Corrigido**: alias `Combos` no validador da URL, busca aceita `combo` e `kit` com nome acentuado |
| N85 | Média | Parser das especificações e da lista de produtos de um kit poderia perder conteúdo legado `O QUE VEM NO COMBO`; upstream repetia a chave `KIT` no fallback | **Corrigido**: leitura de ambas as seções, com 3 testes direcionados para descrição nova e antiga |

**Rebrand e auditoria até `004ccf4`:** 627/627 testes em 74 arquivos, SSR 42/42, Chrome 3/3 em três resoluções, sem operações reais. Novo PR52 ainda precisa conciliação separada. Produção **NOT_APPROVED**.

**C21 / PR52:** integração de `430eb07` sem conflitos após `004ccf4`. Gates locais repetidos: **631/631 Vitest em 74 arquivos**, TypeScript, build e ESLint não formatação verdes, SSR 42/42 e Chrome **3/3**, com 12 screenshots em `qa-artifacts/vonix-c21/kit-pr52`. Sem gateway, produção ou aplicativo externo de inscrição.

## C22 — alterações visíveis em PDP e carrinho celular (10/11)

| ID | Gravidade | Falha validada | Correção e prova |
| --- | --- | --- | --- |
| N86 | **Alta** | Cliente escolhe 3 unidades de `kit-cachos` e, ao navegar para `kit-banana-e-mel`, quantidade indevida de 3 persiste no preço e no CTA | Corrigido: estado de compra reinicializado por SKU. Chrome antes **0/3**, depois **3/3** em 320/390/1366 px; Vitest testa inclusão de 1 un. do novo SKU |
| N87 | Média/UX | Botões +/- do produto menores que 44 px, rótulos genéricos, sem desabilitar nos limites | Corrigido: 44×44 px medidos, rótulos com nome do SKU, limites 1 e 99 |
| N88 | Média/a11y | Favorito só tinha label estático, sem estado | Corrigido: `aria-pressed` e rótulo dinâmico adicionar/remover, navegador e Vitest |
| N89 | Média/UX | Barra fixa da sacola no celular só mostrava CTA, sem subtotal no campo visual | Corrigido: `Produtos, sem frete` e subtotal dinâmico no mobile, sem alegar valor final/frete contratado |

**Verificação C22 após PR53:** **638/638 Vitest em 75 arquivos**, TS, ESLint sem regra histórica Prettier, build Nitro, SSR 42/42, Chrome 3/3 pós-integração. Red/green: `qa-artifacts/vonix-c22/dev/` e `qa-artifacts/vonix-c22/after-pr53/`. Mapa para lojista: `docs/VONIX_MAPA_MUDANCAS_LOJISTA_C22_20261110.md`. Produção **NOT_APPROVED**.

**C22 pós-PR54:** `e3e3c59` incorporado sem conflitos, somente dentro da branch auditada. Gates pós-integração: **642/642 Vitest em 77 arquivos**, TypeScript, ESLint de código e build verdes, SSR 42/42, Chrome 3/3 em 320/390/1366 com 12 screenshots finais. O mapa visual permanece em `VONIX_MAPA_MUDANCAS_LOJISTA_C22_20261110.md`; nada homologado com pagamentos reais.

## C23 — vitrine e favoritos (10/11)

| ID | Impacto | Falha reproduzida | Correção |
| --- | --- | --- | --- |
| N90 | UX médio | Filtro de categoria Kits exibia H1 “Todos os Produtos” | H1 agora identifica categoria e contador de produtos |
| N91 | Conversão médio | Busca sem resultado não orientava o cliente nem indicava filtros restritivos | Chips removíveis individualmente, preservando outras seleções, empty state com botão Ver todos os produtos |
| N92 | Robustez médio | URL de filtro inválido era refletida como título apesar de não alterar a lista | Validação adicional na leitura dos parâmetros na tela, teste unitário e Chrome |
| N93 | UX médio | Favoritos vazio apenas com texto/link discreto; salvos sem contador | Estado vazio com CTA Explorar produtos, explicação sobre este navegador e contagem |
| N94 | Navegação médio | Remoção de filtro por botão podia não responder antes da hidratação, sobretudo em 320 px | Usar links SSR navegáveis com URL mantendo os demais filtros; Chrome 3/3 |

**Evidências C23 (antes de PR55):** 648/648 Vitest em 78 arquivos, TypeScript/ESLint sem Prettier/build verdes, SSR 42/42, Chrome **3/3** (320,390,1366), com 15 screenshots `qa-artifacts/vonix-c23/link-safe`. PR55 upstream precisa reconciliação controlada, sem mexer no app independente de inscrições. Produção **NOT_APPROVED**. Detalhes: `docs/VONIX_AUDITORIA_CONTINUIDADE_C23_20261110.md`.

**C23 / conciliação PR55:** código auditado do `site.tsx` preservado, quatro links de `/seja-afiliada` comparados com upstream e integrados, além de seção editorial da home. Six conflict markers resolvidos manualmente, mantendo controle LGPD de preferências de cookies. Validação **649/649 Vitest em 79 arquivos**, TS/build/ESLint sem Prettier/SSR 42/42, Chrome 3/3 em 320/390/1366 com navegação de afiliadas e filtros da loja. Sem merge na main original nem deploy.

**C23 / PR56:** `15acf96` incorporado na branch auditada com **zero conflitos**, alterando somente administração de afiliadas já existente no repositório, sem interferir nas funcionalidades do e-commerce auditadas. Gates pós-merge: **653/653 Vitest em 79 arquivos**, TS/build/ESLint sem Prettier/SSR 42/42 e Chrome 3/3 (320/390/1366) incluindo navegação da home, menu móvel, rodapé e loja. Produção **NOT_APPROVED**.

## C24 — Menu móvel e retorno ao catálogo (10/11/2026)

| ID | Impacto | Antes | Solução / prova |
| --- | --- | --- | --- |
| **N95** | A11y alta | Menu hamburger sem diálogo acessível ou foco inicial | `role=dialog`, `aria-modal`, título/descrição acessíveis e `aria-expanded`, foco no X; Chrome RED 0/3 GREEN 3/3 em 320/390/1366 |
| **N96** | UX/A11y alta | Escape não fechava, foco saía, fundo rolava, foco não retornava ao abridor | Escape, Tab/Shift+Tab, scroll-lock com restauração e foco devolvido ao opener; Vitest e Chrome |
| **N97** | Navegação média | Produto aberto diretamente só tinha Voltar, sujeito ao histórico de site anterior | Link **Explorar loja** para /loja, omitido no checkout; Chrome 3/3 e Vitest |

**Gates C24:** 656/656 Vitest em 80 arquivos; TypeScript, ESLint sem formatação, Prettier dos editados, build Nitro/Cloudflare, SSR 42/42; Chrome 3/3 (9 screenshots finais). Rede externa bloqueada, sem cobranças, sem deploy. Detalhes: `docs/VONIX_AUDITORIA_CONTINUIDADE_C24_20261110.md`. Produção: **NOT_APPROVED**.

## C25 — Galeria de fotos e carrinho vazio (10/11/2026)

| ID | Impacto | Falha anterior | Correção e prova |
| --- | --- | --- | --- |
| **N98** | UX/A11y alto | Zoom do produto no desktop abria sem focar botão Fechar, sem contenção de Tab/Shift+Tab e restauração de foco | Botão nativo de foto, diálogo com foco inicial, Tab contido, Escape, foco e rolagem restaurados, alvo >=44px; Chrome 3/3 |
| **N99** | A11y médio | Fotos navegáveis dentro de contêiner `role=button`, miniaturas sem estado | Botão principal separado das setas, miniaturas com `aria-pressed`, nome e posição |
| **N100** | UX médio | Carrinho vazio só tinha texto e link genérico | Card com título e caminhos Explorar produtos / Explorar kits, sem cobrar ou prometer frete |

**C25:** Vitest **659/659 em 81 arquivos**, TypeScript/ESLint sem Prettier histórico/build verdes, SSR 42/42, Chrome **3/3** 320/390/1366 com 9 screenshots finais `qa-artifacts/vonix-c25/final/`; redes externas bloqueadas, pagamentos inativos. `docs/VONIX_AUDITORIA_CONTINUIDADE_C25_20261110.md`. Produção **NOT_APPROVED**.

## C26 — Home, catálogo e estoque no SEO (10/11/2026)

| ID | Prioridade | Problema | Solução |
| --- | --- | --- | --- |
| **N101** | Média | Home enviava `uso=pessoal`, não aceito na loja | Corrigido para `uso=casa`; seis filtros preservados |
| **N102** | Média | Busca exigia termos contíguos e na ordem original | Todas as palavras em qualquer ordem; Vitest + Chrome |
| **N103** | Alta/SEO | JSON-LD anunciava `InStock` sem prova de Bling | Campo omitido, SSR 42/42 |
| **N104** | A11y/UX | Destaques automáticos sem pausa e CTA claro | Controle Pausar/Reproduzir, reduced-motion, CTA Conhecer este kit |
| **N105** | UX/comercial | Sem caminho explícito casa vs. salão na home | Dois cartões segmentados com links válidos |

**C26:** 659/659 Vitest em 81 arquivos; TS/ESLint funcional/build exit 0; SSR 42/42; Chrome 3/3 (320, 390, 1366 px), 9 screenshots. `docs/VONIX_AUDITORIA_CONTINUIDADE_C26_20261110.md`. Testes isolados sem pagamentos. **NOT_APPROVED** sem Appmax, Supabase, Bling, frete, Cloudflare, LGPD e rastreio financeiro em staging.

## C27 — continuidade de compra e público (10/11/2026)

| ID | Impacto | Achado confirmado | Correção / comprovação |
| --- | --- | --- | --- |
| **N106–N107** | UX/conversão | URL `uso=salao` não sobrepunha `vonix-audience=casa`; cabeçalho e catálogo divergiam | `resolveAudience` prioriza opção explícita, estado salvo sincronizado após hidratação. Unitário + Chrome 320/390/1366 |
| **N108** | Checkout/conversão | Se Pix não está habilitado e cartão sim, a escolha inicial inutilizável dificultava pagamento | Auto-fallback para método habilitado, outros rádios desativados com rótulo; testes com SDK mockado, sem cobrar |
| **N109** | Privacidade/UX | Checkout continuava solicitando CPF/endereço mesmo sem nenhum método de pagamento | Página de indisponibilidade com suporte e retorno à sacola, sem formulário de PII |
| **N110–N111** | Carrinho/UX mobile | Botão diminuir 1 podia remover; limite 99 não anunciado; drawer rolava fundo e apertava controles | Limites, rótulos de variante, controles responsivos, scroll-lock/restauração; Chrome final 3/3 |

**C27:** Vitest **662/662 (81 arquivos)**, TypeScript/ESLint funcional/build PASS, SSR **42/42**, Chrome **3/3** em 320/390/1366, **12 screenshots**, rede externa bloqueada. `docs/VONIX_AUDITORIA_CONTINUIDADE_C27_20261110.md`. Produção continua **NOT_APPROVED** por Appmax, Supabase staging, Bling, frete real, Worker, LGPD e métricas pagas.

## C28 — ranking histórico real e CTA antes da hidratação (10/11/2026)

| ID | Severidade | Falha observada | Correção | Evidência |
| --- | --- | --- | --- | --- |
| **N112–N113** | Comercial/confiança | Lista fixa `BEST_SELLERS` divergente das unidades `vendas.json`; contadores sem data | Ordenar só SKUs ativos por vendas informadas até 03/11/2026; mesma ordem em home e loja, rótulo histórico e contexto assistivo | Ranking unitário; Chrome 3/3 |
| **N114** | Conversão/UX | Card dependia do ícone de sacola e favorito repetia rótulo sem SKU | CTA legível Adicionar/Escolher tamanho, favorito identificado por produto | Chrome 3/3 |
| **N115–N116** | **Alta/conversão** | Em Vite frio, clique imediato no CTA não adicionava à sacola (RED **0/3**); após hidratação funcionava (**3/3**) | Fallback SSR de link navegável à ficha; PDP bloqueia botão até React pronto | Chrome sem JavaScript **3/3** e pós-hidratação **3/3** |
| **N117** | Integridade de sacola | Conferir se Escolher tamanho altera carrinho antes de escolha | SKU com múltiplas variantes navega à ficha sem adicionar linha | Chrome 3/3, Kit Cachos |

**C28 local:** 666/666 Vitest (82 arquivos), TypeScript/ESLint de código/build exit 0, SSR 42/42 e Chrome 6/6 (3 JS desativado + 3 JS ativo), 18 screenshots; nenhuma cobrança nem integração real. `docs/VONIX_AUDITORIA_CONTINUIDADE_C28_20261110.md`. Produção **NOT_APPROVED**; verificar volumes no ERP, Appmax sandbox e os demais P0 antes de merge/publicação.

## C29 — busca por variantes, controle da sacola e feed Meta (10/11/2026)

| ID | Impacto | Diagnóstico confirmado | Tratamento |
| --- | --- | --- | --- |
| **N118** | **UX/conversão** | Na sacola completa, `−` em uma unidade executava `setQty(0)` e removia o produto | Botão `−` desativado em 1; `Remover` exclusivo, limite 99 com estado claro; Chrome 3/3 |
| **N119–N120** | Descoberta | Alias Combo→Kit só na primeira palavra; busca ignorava tamanhos de variantes | Tokens `combo/combos` em qualquer ordem e busca por rótulos de variantes, com negativos testados |
| **N121** | Privacidade/SEO | `/carrinho` sem `noindex` | Meta `noindex, nofollow`, unitário e Chrome |
| **N122 — P0 aberto** | **Meta Ads / Estoque** | Feed retorna 42 `in stock` sem estoque Bling comprovado por SKU; C26 já omitiu estoque não verificado no JSON-LD | Auditoria CSV: 42/42 IDs, títulos, preços, imagens, promoções e links alinhados (zero inconsistências); estoque 42/42 **NÃO VERIFICADO**. Não desativar feed/anúncios nem alegar estoque sem validação |
| **N123** | Prova social | Texto da home afirmava identidade/qualidade verificada dos depoentes sem auditoria de origem | Copy descritiva sem qualificador não demonstrado; conteúdo original preservado |

**C29:** Vitest **669/669 em 83 arquivos**; TS/ESLint funcional/build PASS, SSR **42/42**, Chrome **3/3** em 320/390/1366 px e 9 screenshots, feed estruturalmente consistente, disponibilidade **BLOQUEADA**. `docs/VONIX_AUDITORIA_CONTINUIDADE_C29_20261110.md`. Produção **NOT_APPROVED**, sem operações reais e sem alteração do sistema separado de afiliadas.

## C30 — busca nativa antes da hidratação e readiness do checkout (10/11/2026)

| ID | Prioridade | Falha comprovada | Correção / teste |
| --- | --- | --- | --- |
| **N124** | **Alta/conversão** | Header pesquisava `/?` se JS indisponível, perdendo termo | `form action=/loja method=get input name=q`, pesquisa SSR + SPA; Chrome RED 0/3 → GREEN 3/3 sem JS |
| **N125** | **Alta/conversão** | Busca filtrada recarregava `/loja?` sem pesquisa nem filtros antes da hidratação | GET nativo + campos ocultos para filtros normalizados; Chrome 3/3 |
| **N126** | Mobile/A11y | Lupa de PDP dependia de JS antes da hidratação | Link SSR `/loja`, botão após hidratação `aria-controls`, Chrome 3/3 |
| **N127** | Checkout/privacidade | CPF/endereço e submissão podiam ser manipulados antes do retorno de `getPaymentConfig` | `inert`, `aria-busy`, aviso e retorno à sacola fora do formulário, bloqueio em duas funções de submit, testes |
| **N128** | Checkout/resiliência | Consulta ao readiness indefinida sem caminho de recuperação | Watchdog 12 s e retry somente de configuração, sem recriar pagamento nem revalidar cupom à revelia, Vitest e Chrome local |
| **N129** | QA | Agent offline encerrou Vite e causou `ERR_CONNECTION_REFUSED`; seed de variante inválida zerou carrinho sintético | Recriação segura de ambiente, testes cruzados e checkout repetidos, sem confundir falha do teste com falha do produto |

**C30:** **672/672 Vitest em 83 arquivos**, TypeScript/ESLint funcional/build PASS, SSR 42/42, Chrome sem JS **3/3**, Chrome hidratado **3/3**, crossflow **3/3**, checkout sintético sem gateway **3/3** (27 screenshots). Sem pagamentos, contas reais, merge ou deploy. `docs/VONIX_AUDITORIA_CONTINUIDADE_C30_20261110.md`. Produção **NOT_APPROVED**.

## C31 — cotação de frete sempre correspondente à compra (10/11/2026)

| ID | Severidade | Defeito confirmado | Mitigação e evidência |
| --- | --- | --- | --- |
| **N130 (alta/checkout)** | Frete/total/cobrança | O cliente podia alterar CEP, sacola ou cupom no instante em que `chosen` ainda referenciava o serviço antigo, pois a limpeza de `options` ocorre em `useEffect` posterior | Assinar cada cotação com CEP + itens/variantes/ofertas + cupom + retry; descartar seleção antiga imediatamente no render, remover opções antigas, desabilitar pagamento e reforçar `onSubmit` e `submitPayment` antes de qualquer cobrança |
| **N131** | Testes/regressão | Faltavam testes que verificassem o intervalo antes da nova cotação | 3 casos simulados CEP, sacola e cupom, nova cotação pendente e submit forçado sem pedido. **675/675 Vitest**, TypeScript, lint funcional, build, **42/42 SSR** e Chrome **3/3** |

**C31 documentação:** `docs/VONIX_AUDITORIA_CONTINUIDADE_C31_20261110.md`. Sem alterar lógica do servidor, APIs reais, catálogo de afiliadas, banco, cobrança, anúncios ou deploy. **Produção NOT_APPROVED**.

## C32 — timeout de frete, resposta tardia, cupons e estado de pagamento (10/11/2026)

| ID | Impacto | Evidência e mudança |
| --- | --- | --- |
| **N132–N133, alta** | Frete/progresso e total | Cotação sem prazo máximo mantinha spinner indefinido. Watchdog 15 s com retry explícito; retorno tardio é ignorado; retry válido não pode ser sobrescrito pelo anterior. Assinatura de cotação do C31 preservada. |
| **N134, alta** | Disponibilidade do gateway | Configuração retornada após timeout de 12 s podia reabrir campos sem ação explícita do cliente; agora resposta é ignorada após a expiração, exige retry. |
| **N135, alta** | Conversão/cupom | Pagamento bloqueado enquanto cupom remoto estiver em validação; substituição por cupom local cancela estado pendente, e retorno antigo não sobrepõe a escolha posterior. |
| **N136, alta** | Segurança/valor submetido | Formulário `inert` durante chamada de pagamento; cupom automático de indicação não muda valor após submit. |
| **N137, QA** | Precisão dos testes | Ajustado o teste de watchdog de frete para não avançar o relógio separado de gateway por engano. |

**C32:** Vitest **680/680 em 83 arquivos**, TS/ESLint funcional/build local PASS, SSR **42/42**, Chrome navegação **3/3**, checkout indisponível local **3/3**, **15 screenshots**. Em `docs/VONIX_AUDITORIA_CONTINUIDADE_C32_20261110.md`. Nenhum serviço externo de cobrança/frete nem aplicativo separado de afiliadas alterado. **Produção NOT_APPROVED.**

## C33 — CEP coerente, resposta manual e recuperação (10/11/2026)

| ID | Impacto | Antes (baseline RED) | Corrigido e testado |
| --- | --- | --- | --- |
| **N138 — alta** | Endereço de entrega | Trocar CEP mantinha rua, bairro, cidade, UF, número e complemento da entrega anterior | Ao modificar dígitos de um CEP completo, zerar campos pertencentes ao endereço anterior sem afetar dados pessoais de cliente, cesta ou pagamento |
| **N139 — alta** | Preenchimento e confiança | Lookup assíncrono sobrescrevia rua corrigida manualmente enquanto aguardava resposta | Vincular callback ao CEP consultado e preencher somente campos de endereço vazios; preservar correções do comprador |
| **N140 — média/alta** | Loading e abandono | Consulta CEP que não respondia mantinha indicação de carregamento sem limite | Timeout de 10s, aviso de entrada manual e botão de retry explícito; resposta antiga ignorada |

**QA C33:** 3 testes novos demonstrados **RED** antes e **GREEN** após; **683/683 Vitest em 83 arquivos**, TS/lint funcional/build PASS, SSR **42/42**, Chrome **3/3** e checkout **3/3** com rede externa bloqueada. A primeira tentativa no Vite antigo e a tentativa `vite preview` não são evidências positivas (falha de ambiente descrita no handoff). Documentação: `docs/VONIX_AUDITORIA_CONTINUIDADE_C33_20261110.md`. **Produção NOT_APPROVED.**

## C34 — nova auditoria integral rigorosa (10/11/2026)

| ID | Prioridade | Achado comprovado | Resultado / próximo bloqueio |
| --- | --- | --- | --- |
| **N141** | P1 checkout | WhatsApp com DDD inválido acionava submit de pagamento em teste RED | Validador compartilhado browser/servidor, aceita celulares e WhatsApp Business fixos legítimos e prefixo +55; testes GREEN |
| **N142** | P1 cadastro | Rua/num/bairro/cidade com somente espaços passavam pela validação inicial | Campos significativos com trim antes de aceitar endereço; foco e mensagem de erro na UI |
| **N143** | P1 cadastro | UF inexistente XX era aceita por validação baseada apenas em comprimento | Validar 27 UFs, normalizar para maiúsculas no servidor |
| **N144** | P1 cadastro | Nome apenas de espaços progredia até servidor | Mensagem e foco antes de qualquer pagamento, Zod trim+min |
| **N145** | P1 PDP | Cálculo do frete travava se a busca de endereço não respondesse | Separar chamadas independentes; cotação fica disponível sem esperar CEP/address externo |
| **N146** | P1 PDP | Transportadora sem resposta deixava loading e botão desativado indefinidamente | Watchdog local 12 s, retry manual, descarta respostas antigas; não cancela provedor remoto |
| **N147** | P2 acessibilidade | Sem JS, carrinho e checkout mostravam área vazia no HTML SSR | `noscript` com orientação e link seguro, 3/3 verificações do markup; a visibilidade real no navegador com JS desativado não foi homologada |
| **P0-ESTOQUE** | Crítico, NÃO resolvido | Meta CSV local e **público**: 42/42 produtos marcados `in stock`; sem inventário Bling por SKU nesta auditoria | Confirmar saldos, reservas, variantes e sincronização; mudanças no feed requerem aprovação comercial |
| **P0-PAGAMENTO** | Crítico, NÃO resolvido | Mocks/CI não comprovam Appmax Pix/cartão reais, antifraude, conciliação de pedido pago | Testar sandbox autorizado com registros de aprovação/recusa, idempotência, webhook e `paid_at` |
| **P0-FRETE-STAGING** | Crítico, NÃO resolvido | Medidas default de pacote não verificadas por SKU; runtime Cloudflare/Supabase staging sem homologaçāo | Aferir pesos/dimensões e CEP; staging isolado RLS/backup/restore/rollback e observabilidade |
| **P1-PUBLICAÇÃO** | Alta, NÃO resolvido | Publicamente carrinho e conta sem meta/header `noindex`; branch auditada já contém noindex | Confirmar pós-deploy autorizado; o PR ainda não foi mesclado nem publicado |

**Evidência C34:** `docs/VONIX_AUDITORIA_INTEGRAL_C34_20261110.md`, `docs/VONIX_C34_VERIFIED_RECEIPT_20261110.json`. Testes: 690/690 em 83 arquivos; checkout 115/115; TypeScript, ESLint funcional, build PASS; SSR 42/42; 15 rotas, 129 imagens; Chrome 3/3 + checkout 3/3; noJS SSR markup 3/3; feed Meta público/local 42/42 sem divergência. **Produção NOT_APPROVED**. Não alterar sistema separado de candidaturas de afiliadas.

## C35 — continuidade da auditoria em 10/11/2026

| ID | Prioridade | Falha verificada | Solução local e prova |
| --- | --- | --- | --- |
| N148 | **P1 — ficha de produto / frete** | `ShippingCalc` recebia subtotal líquido `sel.net`, mas servidor e regra de frete grátis validam subtotal **bruto** acima de R$150. Com 2× R$81,90, antes de descontos R$163,80 e após volume R$144,14, o mock do servidor retornava frete grátis, mas a página escondia o texto explicativo. Teste integrado **RED**. | Passa `sel.gross` ao cálculo visual, atualiza mensagem para *antes dos descontos*, mantém cotação real como condição. Teste **GREEN**, nenhuma mudança de preço ou gateway. |
| N149 | P2 — cobertura de preços | Não havia conferência exaustiva da elegibilidade de frete entre PDP e checkout para variantes e quantidades. | Novo teste cobre **46 variantes × 3 quantidades = 138 casos** com base no bruto e destaca cenários bruto>R$150 / líquido<=R$150. **113/113** testes focados, **726/726** suíte geral em 87 arquivos. |

**Resultados C35**: TypeScript, lint funcional, build, formatação e diff-check PASS; 42/42 PDP SSR, 15/15 rotas, 129/129 imagens, feed Meta 42 linhas sem inconsistência estrutural, Chrome 3/3 vitrine e 3/3 checkout, HTML `noscript` 3/3 como *markup* apenas, 21 screenshots. Evidências: `docs/VONIX_AUDITORIA_CONTINUIDADE_C35_20261110.md`, `qa-artifacts/vonix-c35/`, recibo C35. **P0 externos não resolvidos e produção NOT_APPROVED; sem merge ou deploy.**

## C36 — auditoria de endereço e integridade postal (10/11/2026)

| ID | Gravidade | Reprodução RED | Correção GREEN |
| --- | --- | --- | --- |
| **N150** | P1 — CEP/checkout | ViaCEP com CEP correto, UF fictícia `ZZ` era aprovada pelo regex `^[A-Z]{2}$`; se as duas fontes devolvessem UF inválida, o sistema ainda podia preencher dados incoerentes. | `address.server.ts` usa `isValidBrazilUF` compartilhado com checkout; busca BrasilAPI quando fonte primária inválida e falha de forma segura se ambas forem inválidas. |
| **N151** | P1 — CEP/checkout | Cidade `"   "` passava em `min(1)` e travava a conclusão do endereço só mais tarde. | `trim().min(1)` na cidade e `trim()` em rua/bairro; tenta segunda fonte em resposta inconsistente. |
| **N152** | P2 — usabilidade | CEP de abrangência municipal sem rua/bairro exibia mensagem enganosa de endereço completo e enviava foco diretamente ao número. | `use-cep-address.ts` mostra campos faltantes e checkout foca rua, bairro ou número conforme necessidade. |

**Provas C36:** 4 testes inéditos RED→GREEN, 133/133 focados, **730/730 Vitest completo** em 87 arquivos, TypeScript/lint funcional/build/Prettier/diff-check verdes, 42/42 SSR, 15/15 rotas, 129/129 imagens, feed Meta local 42 linhas, Chrome 6/6, `noscript` markup 3/3, 21 screenshots. Recebimentos no `docs/VONIX_AUDITORIA_CONTINUIDADE_C36_20261110.md` e `docs/VONIX_C36_VERIFIED_RECEIPT_20261110.json`. Não há atualização de estoque, pagamentos ou publicação. **PRODUÇÃO NOT_APPROVED**.

## C37 — integridade de carrinho com pagamento confirmado tardiamente (10/11/2026)

| ID | Prioridade | Defeito real reproduzido | Corrigido e verificado |
| --- | --- | --- | --- |
| **N153** | **P1 — perda de dados da sacola e atribuição de compra** | `finish()` em checkout limpava `c.clear()` incondicionalmente após status Pix/cartão pago, mesmo com produtos novos inseridos depois do pedido original. `Purchase` usava novos SKUs como se fossem itens pagos. **2 RED** (Pix e cartão sintéticos). | Snapshot não pessoal da cesta efetivamente submetida, por orderId, TTL 24h, em sessionStorage. Só limpa quando SKU/variante/oferta/qty correspondem exatamente; sem snapshot ou com nova cesta, preserva e não atribui SKUs novos ao Purchase antigo. **GREEN**, status autenticado segue obrigatório. |
| **N154** | P2 — recuperação de pedidos | Resposta `verification` pode corresponder a pedido antigo; associar automaticamente a cesta atual àquela ordem criaria registro de compra incorreto. | Só registra snapshot de cesta ao criar Pix/cartão, nunca para `verification`. Teste de integração garante ausência do registro nesse retorno. |
| **N155** | P2 — QA de jornada | Script C37 de público salão às vezes lia a preferência em sessionStorage antes do efeito do React terminar; uma rodada simultânea 320px falhou 2/3 global. | QA aguarda o estado real de `vonix-audience=salao`, não um sleep de 900 ms. Reexecução isolada 3/3, falha inicial documentada e preservada; sem afirmar bug da loja. |

**C37 final:** 739/739 Vitest PASS em 88 arquivos, 93/93 testes direcionados, TypeScript/lint funcional/build/formatação/diff-check PASS, 42/42 PDP SSR, 15/15 rotas, 129/129 assets, feed Meta local 42/42 estruturalmente correto, Chrome 3/3 + 3/3, fallback noJS HTML bruto 3/3 (renderização visual não provada) e 21 PNGs. Relatório `docs/VONIX_AUDITORIA_CONTINUIDADE_C37_20261110.md` e recibo C37. **Produção NOT_APPROVED**; P0 Bling/Appmax/frete/staging continuam sem homologação externa.

## C38 — volume e complementos 5% com servidor autoritativo (10/11/2026)

| ID | Prioridade | Falha reproduzida RED | Correção validada GREEN |
| --- | --- | --- | --- |
| **N156** | **P1 — desconto menor que promoção anunciada** | Complemento `comp5` (5%) mantinha desconto de 5% após quantidade subir a 2/3, contrariando 12%/15% do mesmo SKU. No Sérum Argan 60ml, 2 un. eram R$176,52 em vez de R$163,50. | `lineTotals` usa `comp5` apenas em 1 un.; `migrateCart` remove oferta ao subir quantidade para 2+, recalcula volume e consolida duplicados. 184 casos de 46 variantes × 4 quantidades verdes e Chrome 3/3 com DOM real (5→12→15%). |
| **N157** | **P1 — servidor e cliente com preços divergentes** | Backend cotava frete e podia criar pedido para `comp5 qty=2` com R$88,26/un. em vez de R$81,75/un., mantendo SKU `-comp5`. | `buildLines` normaliza `comp5 qty>=2` para volume 12%/15%, preserva `quotedTotalCents` e corrige SKU de pedido, antes de qualquer efeito financeiro; teste servidor RED→GREEN. |
| **N158** | P2 — integridade do pedido | Dois registros diretos do mesmo produto+variante `qty=1` eram aceitos separadamente, impedindo a aplicação correta do desconto por quantidade. | `buildLines` rejeita linhas duplicadas antes da cotação, reserva ou pagamento; teste RED→GREEN. Variantes distintas continuam válidas. |

**Provas:** 745/745 testes Vitest em 88 arquivos, 98/98 direcionados, TypeScript, lint funcional (12 avisos preexistentes, 0 erros), build, Prettier/diff-check verdes; SSR 42/42, rotas 15/15, 129 imagens, feed Meta 42 linhas sem inconsistências estruturais; Chrome 3/3 vitrine + 3/3 checkout + 3/3 promoção por quantidade, 27 screenshots e fallback SSR `noscript` 3/3 markup (não comprova render visual sem JS). Relatório `docs/VONIX_AUDITORIA_CONTINUIDADE_C38_20261110.md` e recibo C38. **PRODUÇÃO NOT_APPROVED**, Bling/Appmax/frete/staging sem validação operacional.

## C39 — múltiplos pedidos pendentes e preservação de carrinho (10/11/2026)

| ID | Prioridade | Falha reproduzida RED | Correção e prova GREEN |
| --- | --- | --- | --- |
| **N159** | **P1 — recuperação de pagamento / integridade** | Snapshot C37 de sacola era único por aba: ao salvar uma segunda ordem pendente, substituía o registro do pedido anterior, perdendo a identidade dos produtos para limpeza segura e evento `Purchase` de pedido que viesse a ser confirmado depois. **2 novos testes RED** (pedidos distintos e migração legada). | C39 passa a até 8 registros de pedido com TTL 24h, migração C37, limpeza seletiva por ID e rejeição isolada de corrupção; nenhum CPF, cartão, token ou status de pagamento salvo. Checkout sintético confirma pedido antigo, limpa só carrinho correspondente e mantém outra ordem pendente. **GREEN** em 99/99 testes focados, 751/751 completos (repetição isolada), Chrome 3/3 do fluxo multi-pedido. |

**C39:** SSR 42/42, rotas 15/15, 129/129 imagens, feed Meta 42 linhas estruturais mas inventário real não verificado, Chrome 3/3 vitrine + 3/3 checkout + 3/3 snapshots de duas compras, 21 screenshots. TypeScript/lint funcional/build/Prettier/diff-check EXIT0. Primeira suíte concorrente deu 750/751 com **um timeout** de teste de checklist; repetição isolada 751/751, preservando ambas as evidências. Relatório `docs/VONIX_AUDITORIA_CONTINUIDADE_C39_20261110.md` e recibo C39. **PRODUÇÃO NOT_APPROVED** sem gates operacionais Appmax/Bling/frete/staging.
