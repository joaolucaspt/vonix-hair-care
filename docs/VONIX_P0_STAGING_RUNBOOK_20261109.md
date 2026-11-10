# Vonix Hair — roteiro de homologação operacional P0/P1 (sem produção)

**Escopo:** e-commerce Vonix Hair, PR #26. O sistema de afiliadas não faz parte deste roteiro. A automação não deve tocar contas reais, segredos, pedidos, estoque nem banco de produção.

**Condição atual:** a auditoria de código e os testes sintéticos avançaram até C5. O CI verde valida o software testado, **não** a operação com provedores reais. Nenhuma aprovação para merge ou deploy decorre deste documento.

## Portas P0 que ainda exigem ambiente homologado

| Porta | Evidência concreta necessária | Critério de aprovação |
| --- | --- | --- |
| Supabase de staging | Projeto isolado, snapshot/restore testado, migrações aplicadas em ordem, RLS por perfis, funções com permissões mínimas | Sem acesso a PII por roles públicas; worker e checkout passam; rollback documentado |
| Appmax sandbox — Pix | Pedido fictício e respostas aprovado/pendente/cancelado/expirado; perda de resposta e falha do provedor em cada etapa | Nenhum duplo pagamento; comprador recupera estado e entende próxima ação |
| Appmax sandbox — cartão | Tokenização segura, recusa, 3DS/antifraude se aplicável, timeout da confirmação e status autenticado | Não armazenar PAN/CVV; não declarar pago antes de confirmação; sem duplicar cobrança |
| Bling homologado | SKU, variação, valor, peso/dimensão, estoque e número da loja; pedido de teste e reenvio idempotente | Exportação fiel 1:1; repetição após timeout não cria pedido duplicado; conciliação funciona |
| Logística | CEPs válidos de várias regiões e CEP sem cobertura, prazos, opções gratuitas, dimensões reais | Frete não inventa preço, prazo nem cobertura; totais finais coincidem com o provedor |
| Estoque | Listagem de estoque reconciliada por **SKU e variante** com data e responsável | Feed Meta/JSON-LD não anuncia disponibilidade não comprovada |
| Dados de consentimento | Revisão LGPD, registro/versionamento, retirada de consentimento antes da compra e **após compra pendente**, retenção e prova de aceite | Nenhum evento opcional sem base legal; revogação propagada ao servidor antes de eventos futuros |
| Meta CAPI | Opt-in/opt-out sintéticos em staging, evento Purchase só após Appmax aprovado, deduplicação com Pixel e Graph confirmado | Sem Purchase falso ou repetido; pedido sem aceite não gera eventos nem recuperação recorrente |

**Disponibilidade do catálogo:** desde a atualização da `main` de 09/11, `plex-vonix` integra `OUT_OF_STOCK` em `src/lib/store.ts`: 43 itens no JSON, **42 na vitrine/feed/sitemap** e Plex com rota HTTP 404. A auditoria SSR deve continuar validando somente os vendáveis e assegurando 404 para excluídos. Não reativar o Plex sem prova e autorização de estoque físico.

**As SQLs de produção não devem ser executadas automaticamente.** A alteração C5 em `supabase/vonix-meta-purchase-delivery.sql` muda funções para exigir consentimento antes de reservar ou selecionar Purchase, mas **precisa ser aplicada/validada em staging** para produzir efeito no banco. Não fazer migração somente porque o PR passou. A atualização C8 de `supabase/vonix-checkout-idempotency.sql` endurece `search_path` das três funções `SECURITY DEFINER`; o roteiro sintético reproduzível está em `scripts/qa-checkout-idempotency-hardened.sql`. **Testes sintéticos não substituem aplicação e validação em staging com backup.**

## Validação sintética que já pode ser reproduzida sem contas reais

A fonte `scripts/qa-meta-consent-synthetic.sql` contém guarda por nome de banco `vonix_synthetic`, exemplos de pedidos fictícios 1001–1004, verificação de seleção e reserva, RLS/permissões e `ROLLBACK`.

Em 09/11/2026 o script foi executado no PostgreSQL 16 isolado da rede (`--network none`), com sistema de arquivos em memória, schema de snapshots e SQL do CAPI, sem porta publicada. **PASS**: legados, recusados e versão antiga excluídos; somente aceite v1 selecionado/claim; `anon` e `authenticated` não receberam acesso às funções/tabelas. O contêiner foi removido após o teste. Essa prova **não substitui** staging da loja.

## Revisão de conversão P1

**Não concluir que correções técnicas recuperaram vendas sem transações confirmadas.** Para atribuir as perdas no funil, levantar uma janela comum com dados agregados, por canal e dispositivo: visitas na landing, cliques em compra, sessões com carrinho, sessões iniciando checkout, falhas de CEP, métodos disponíveis, respostas Appmax e pedidos **pagos**. Como opt-out reduz eventos de analytics, usar a fonte financeira para conferir denominadores, jamais presumir 100% de rastreamento.

Obter também histórico dos preços de referência, autorização de depoimentos, comprovação de SLA de atendimento, acessibilidade com teclado/leitor de tela, Lighthouse em rede móvel fria, Search Console e consentimento para comunicação por e-mail.

## Gate final antes de produção

Exigir responsáveis do negócio, jurídico, pagamentos, ERP, dados e operações assinarem cada porta P0 com evidência datada. Preparar plano de reversão em PR e backup, janela de monitoramento de cobranças duplicadas e falha de pedidos, revisão de domínio e permissões. **Sem esses registros, PR #26 continua em revisão.**

### Auditoria C10 — identificar propriedade GA4 e consentimento

A `main` mudou o identificador público GA4 para `G-J8TYLB425K` no commit `8c8bf6b`. O PR incorpora o ID vigente preservando bloqueios de GA4, Clarity e Meta antes de aceite. Em staging ou revisão jurídica, confirmar que este ID pertence à propriedade GA4 autorizada da loja, revisar consentimento/revogação tardia e comparar contagens agregadas (sem PII) antes de qualquer deploy. Não instalar tag duplicada de GA4 via painel, Lovable, GTM ou script direto sem novo teste de consentimento. Os checks locais não provam que o ID recebe dados reais da conta correta.

### Portas C11–C12 — confirmação de tempo e valor original

**Appmax sandbox:** simular resposta paga com `data.payment.paid_at` em ISO contendo fuso. Verificar se o contrato real retorna esse campo em Pix e cartão, e se o horário representa liquidação/aprovação; sem essa evidência, o CAPI Purchase é deliberadamente omitido em vez de inventar data. Simular paid_at faltante, vencido, inválido, horário futuro e recuperação com retardo de 60 min/24 h.

**Supabase staging:** executar um fluxo 100% fictício e isolado em que a segunda tentativa altera método Pix/cartão, cupom e frete depois de o pedido inicial ser criado. Verificar se o retorno de acompanhamento usa o snapshot persistido original, não a nova cotação. Simular snapshot ausente, valor zero/overflow, ID divergente e indisponibilidade da rede; sem novo customer/order/Pix/card e com orientação de contato. A migração SQL C5/C8 e os backups permanecem procedimentos separados com aceite operacional.

**Privacidade:** Purchase continua dependendo do snapshot de consentimento v1. A propagação de revogação posterior ao pedido para o backend não foi implementada; continua exigindo autorização, ledger e revisão LGPD. Não divulgar cumprimento integral antes disso.

### Auditoria C13 — leitura de idempotência durante indisponibilidade de frete

Em Supabase **staging isolado**, aplicar/revisar a SQL já existente que concede `SELECT` somente para `service_role` em `vonix_checkout_intents`. Simular resposta GET PostgREST com `fingerprint=eq.<HMAC>&select=phase,order_id,updated_at&limit=1`. Verificar **403/sem privilégios** para `anon`/`authenticated`, **nenhum insert/update** durante leitura e nenhum CPF, endereço, token ou número de cartão em URL/body de banco. Testar indisponibilidade do Melhor Envio e cupom/serviço antigo sobre pedido fictício já registrado: checkout só deve devolver `verification` com total do snapshot e ID assinado; sem pedido/snapshot, bloquear cobrança. Repetir com `cancelled`, `completed` de 25 horas e concorrência. Não executar essas consultas em produção sem autorização operacional.

**QA adicional:** testar toque imediato no CTA durante carregamento frio compilado de produção com Chrome emulado em 320 px, CPU lenta e rede limitada. A falha foi vista apenas no Vite frio; a página hidratada passou, não havendo evidência suficiente para afirmar defeito em produção.

### N54 — nova gaveta Comprar agora da main: integração bloqueada

A main `6ce6952` alterou `src/components/buy-drawer.tsx`, checkout e PDP. O merge com a auditoria tem conflitos nestas duas páginas e há edição local não commitada em checkout de outra sessão. Não executar reset/clean/checkout/stash nem forçar resolução. Integrar conscientemente a nova gaveta à máquina de estados C12/C13, proteção de double charge, consentimento, Pix/cartão, frete/cupom e acessibilidade; comparar checkout local antes de qualquer write e manter o PR aberto enquanto não houver validação completa.

### Portas C15 — versão com gaveta de compra

Na integração futura da nova `main`, exigir simultaneamente (1) testes de idempotência, `statusToken` e recuperação após timeout Pix/cartão do checkout auditado; (2) modal da PDP com foco/teclado e alvos >=44 px; (3) frete não garantido sem cotação de CEP, utilizando subtotal de produtos bruto para a regra comercial; (4) consentimento não pode interceptar CTA nem forçar rastreamento; (5) teste no **runtime Cloudflare** real de staging, já que `vite preview` local não serve o preset Nitro emitido. Sem assinatura de Appmax/Supabase/Bling e conciliação de vendas pagas, PR #26 não é liberado a produção.

### C16 — gate adicional de checkout acessível e recuperável

Antes de liberar o PR #26, executar homologação do checkout real no runtime Cloudflare staging com frete e cartões simulados: (a) retentativa de CEP após erro, sem novo pagamento; (b) CPF inválido recebendo foco e sem cobrança; (c) total mobile refletindo Pix/cartão e cotação, sem prometer frete antes do CEP; (d) ida/volta sacola preservando itens; (e) idempotência e recuperação de tentativas ambíguas Pix/cartão mantidas após conciliação com a interface compacta da main. Sem Appmax sandbox/Supabase staging/estoque real validados, manter **NOT_APPROVED**.

### C17 — gate de prevenção de envio acidental e acessibilidade

Em staging, confirmar que Enter no campo "Código do cupom" **nunca** submete pedido e apenas aplica o código válido; conferir cupom anterior explicitamente ativo após tentativa inválida. No Chrome 320/390/1366 com tecnologias assistivas quando disponíveis, conferir botões de +/-/remover por SKU, variante e promoção e área mínima de 44px, inclusive em duas linhas do mesmo produto. Garantir cupom/sacola não altera proteção contra tentativas duplicadas após timeout, elegibilidade do desconto e frete por CEP. **Linter do repo:** baseline tem milhares de falhas Prettier/CRLF; não usar `eslint --fix .` indiscriminadamente como autorização de lançamento; auditar apenas diffs C17. PR #26 continua **NOT_APPROVED** até CI, resolução manual dos conflitos com main e homologação operacional.

### C18 — validação de integração com cupom da afiliada, com pagamentos protegidos

Em staging isolado e com serviços/sandbox explicitamente autorizados, confirmar `lookupCoupon` para NOME10 com 10% apenas após confirmação do app externo; código inexistente, erro 5xx, timeout ou código de até 32 caracteres não confirmado **não** gera desconto e **não** cria reserva de pagamento. Após mostrar cupom válido, simular expiração antes do submit e garantir que `createPayment` recuse sem cobrança, preservando eventual pedido previamente reservado. Confirmar que o subtotal/regras de oferta não permitem desconto duplo no mesmo SKU, que Pix usa o total exibido em centavos e que recusas incertas não habilitam outra cobrança. Verificar mensagem do popup condicionada a itens sem outra oferta. Manter token de status assinado, idempotência e snapshot de pedido. Nunca usar o fluxo de inscrição de candidatas como teste de e-commerce. CI sintético / build não substituem Appmax + Supabase + Bling em staging.

### C19 — gate de catálogo, consentimento e não interferência de pagamento

Em homologação isolada, verificar busca do catálogo por botão/Enter/teclado virtual nas resoluções 320/390/1366 e filtros de URL normalizados, com foco, leitura acessível e nenhuma navegação involuntária ao checkout. No checkout, a faixa de cookies não deve aparecer obrigatoriamente, mas o botão do rodapé **Preferências de cookies** deve sempre reabrir as escolhas já salvas; após **Recusar opcionais**, checar suspensão de scripts opcionais, recusa persistente, manutenção do carrinho e ausência de bloqueios do pagamento essencial. Testar consentimento previamente aceito e revogação. Não divulgar dados financeiros/PII em analytics de busca. Verificar integridade dos pedidos no sandbox separado. C19 **não** libera produção sem os demais gates P0.

### C20 — prevenção de avaliações duplicadas e proteção das áreas pessoais

Em QA controlado, enviar avaliação **sintética** para SKU A, navegar pela SPA até SKU B antes e depois da resposta, verificar que nenhum sucesso do SKU A é mostrado no B, e que a resposta antiga não altera nota/rascunho. Simular dois submits quase simultâneos: apenas um request local deve ocorrer, sem dispensar rate-limit/idempotência no servidor. Simular falha de gravação seguida de nova tentativa. Para `/conta` e `/favoritos`, conferir meta `noindex,nofollow`, **sem** presumir proteção de acesso; status do pedido deve exigir token assinado, resposta autenticada do gateway, nunca confiar em `paid:true` da sessão. Não usar pedidos, CPF, emails ou reviews reais em QA. C20 **não é autorização de deploy**: exigir Appmax sandbox, Supabase staging/restore/RLS, Bling, LGPD, segurança do Worker e reconciliação de métricas.

### C21 — favoritos corrompidos, sacola em mais de uma aba e busca brasileira

Para staging isolado, preencher `localStorage.vonix-favs` com objeto JSON, array com slugs antigos/inexistentes, duplicados ou JSON inválido e confirmar que catálogo e favoritos não quebram nem apresentam SKU indisponível. Em duas abas da mesma origem, mudar favoritos e quantidade do carrinho; confirmar atualização imediata no cabeçalho, sacola e resumo do checkout, com migração/aviso de ajustes quando aplicável. A atualização de outra aba deve invalidar preços/CEP/seleções antigos e exigir revalidação server-side antes de qualquer pagamento. Validar `vonix-audience` com valores inválidos de sessão; permitir só casa/salão. Buscar `mascara`, `cafe verde` e suas versões acentuadas nos tamanhos 320/390/1366. **Não confundir** a sincronização de abas com trava transacional ou autorização de cobrança. Nunca usar pedido ou gateway real em QA C21; continuar os demais gates P0.

### C21 — regressão de nomenclatura Kit/Combo com precificação intacta

Em staging isolado, exigir no catálogo **Kit** para os 10 produtos da categoria interna `kits` preservando os slugs `kit-...`, referências de SKU, variantes, preços e imagens originais. Testar `/loja?tiposProduto=Kits` e o link legado `/loja?tiposProduto=Combos`; buscar `kit cafe verde`, `combo cafe verde` e nomes acentuados. Nas fichas do produto, garantir que listas `O QUE VEM NO KIT` e `O QUE VEM NO COMBO` preservam contagem/ingredientes sem prometer composição inventada. **Não** importar textos de frete upstream que listem transportadoras antes de cotação efetiva por CEP; os 43 produtos permanecem com aviso condicional, e o checkout deve exigir cotação válida do servidor antes de pagar. Nunca autorizar produção por CI sintético isolado.

### C22 — PDP ao trocar SKU e subtotal móvel

Em Chrome/Edge real e telas de 320, 390 e 1366 px, abrir `/produto/kit-cachos`, selecionar 3 unidades e segunda variante, navegar pelo link de produto relacionado para `/produto/kit-banana-e-mel` na mesma SPA. O novo SKU deve iniciar em **1 unidade e sua primeira variante**, com gaveta de compra fechada; ao adicionar, somente 1 unidade **do novo SKU** deve entrar no carrinho, preservando linhas que já existiam. Testar toque >=44×44 px nos controles +/−, limites 1 e 99, favoritos com `aria-pressed` e rótulos adicionar/remover. Na sacola mobile, comparar o subtotal rotulado `Produtos, sem frete` antes/depois de aumentar quantidade; não tratar esse valor como total final, nem permitir cobrança sem CEP/quote válido. Testes sintéticos de navegador com rede externa bloqueada **não** substituem Appmax/Supabase/Bling em staging.

### C23 — filtros, resultados vazios e Favoritos

Em Chrome/Edge 320/390/1366, validar que `/loja?categoria=kits` mostra título **Kits**, contador correto e link acessível `Remover filtro Categoria: Kits`. Na URL `/loja?q=banana&categoria=quimica`, mostrar estado sem resultados com chips; clicar **Remover filtro Categoria: Química** deve preservar `q=banana` e listar o Kit Banana e Mel. O chip deve possuir `href` navegável também antes da hidratação. URLs com `tiposProduto` e `ordem` inválidos não devem exibir H1 enganoso nem aparentar seleção ativa. Em `/favoritos` vazio mostrar CTA Explorar produtos; após salvar no navegador, contador acompanha o produto ativo sem fazer login ou expor identidade. Nenhuma ação deve abrir gateway ou criar pedidos. Manter documentação de limitações de indexação e não tratar teste sintético como homologação de produção.

### C24 — diálogo móvel, teclado e navegação de entrada direta

Em staging isolado Chrome/Edge 320/390/1366 px, abrir `/loja?categoria=kits` e o menu hambúrguer; exigir semântica de **Menu rápido** modal, foco imediatamente no botão **Fechar menu**, `aria-expanded=true`, Tab e Shift+Tab nunca saindo do diálogo, Esc e X fechando com devolução de foco ao botão **Abrir menu**, clique fora fechando e rolagem do fundo bloqueada enquanto aberto e restaurada ao fechar. Testar **Kits** e **Seja afiliada** sem perder as categorias nem abrir aplicativo de inscrições externo. Abrir um link de produto **em aba nova** sem histórico interno e verificar o atalho **Explorar loja**, inclusive por teclado; ele não deve aparecer no checkout. Não usar scripts ou contas reais, pagamentos, dados de cliente, API de gateway nem serviços de produção. O Chrome local é teste sintético, não homologação.

### C25 — Zoom da galeria e retorno do carrinho vazio

Em navegador real Chrome/Edge 320, 390 e 1366 px, abrir `/produto/kit-banana-e-mel`. Abrir a imagem com clique, Enter e Space: o foco deve ir para **Fechar**, Tab/Shift+Tab devem continuar no visor, Escape fecha e devolve o foco à imagem, e rolagem de fundo deve retornar; verificar dimensão mínima 44×44 nos botões e miniaturas anunciando seleção correta. Setas esquerda/direita mudam a foto sem interferir nos campos da compra. Abrir `/carrinho` sem itens; verificar título **Sua sacola está vazia**, CTA **Explorar produtos** e link **Explorar kits** com filtro correto. Sem carregar serviços externos, pedidos, pagamentos ou dados reais; não confundir testes de localhost com homologação de staging.

### C26 — gates da descoberta do catálogo e veracidade de estoque

Em staging isolado, validar os seis atalhos da home com `uso=casa`, os novos caminhos `Para minha rotina` e `Para o salão`, e a busca com `verde kit cafe`, `cafe verde`, variantes acentuadas e termos sem correspondência; nenhum termo obrigatório pode ser ignorado. No carrossel, validar pausa, controle por teclado, preferência `prefers-reduced-motion`, navegação e ausência de overflow em 320/390/1366 px. Nas 42 páginas, não afirmar `InStock` no JSON-LD sem Bling operacional e auditável. O feed público, pesos, estoque, checkout Appmax, frete real, Supabase staging, Worker Cloudflare, revogação LGPD e analytics pagos continuam sem homologação. Sem deploy, pagamentos ou bancos reais durante QA.

### C27 — escolha de público, indisponibilidade de pagamento e gaveta responsiva

Em ambiente de homologação sem operações financeiras reais, começar com `sessionStorage.vonix-audience="casa"`, clicar em `Para o salão` na home e conferir prioridade de `/loja?uso=salao`, ordem/título da vitrine e persistência/cabeçalho; fazer o inverso e testar ausência de `uso`, mantendo preferência anterior. Com mocks/sandbox separados, simular `pixEnabled=false/cardEnabled=true`: seleção de cartão automática e SDK carregado somente sob configuração disponível; `pixEnabled=true/cardEnabled=false`: cartão inativo; ambos `false`: nenhum formulário de CPF/endereço/cartão e orientação de contato, sacola preservada. Confirmar que status de pedidos pendentes/recuperação é priorizado sobre indisponibilidade atual. Na gaveta, quantidade 1 desabilita menos, 99 desabilita mais e só Remover retira o item; nome acessível inclui tamanho. Testar foco, ESC, Tab/Shift+Tab, rolagem restaurada, overflow e subtotal em 320/390/1366 após animação. Nenhuma dessas provas autoriza pagamento em produção; manter Appmax/Supabase/Bling/Cloudflare/LGPD P0.

### C28 — rankings, carregamento frio e fallback de compra

Conferir origem/período dos totais de `vendas.json` versus Bling/WhatsApp: a data atual é 03/11/2026; não transformar volumes informados em atualização em tempo real. Exigir que ranking `Mais Vendidos` na home e `/loja?secao=mais-vendidos` contenha os mesmos seis SKUs ativos, decrescendo por unidades reportadas; empates estáveis, SKU indisponível excluído. No Cloudflare staging com CPU móvel lenta e rede restrita, tentar clicar em CTA no *primeiro frame* de HTML; se JS não estiver ativo, exigir link nativo para a ficha (no JS, 320/390/1366 passa); depois da hidratação, Adicionar deve inserir item correto, Escolher tamanho deve apenas navegar e botões da PDP não podem capturar cliques sem eventos. Monitorar LCP/INP, erros de hidratação e sessões de abandono. Os testes C28 bloquearam tráfego externo, não testaram gateway, CEP real nem conversão financeira. Sem merge, deploy, pedido real ou migração de banco sem autorização explícita.

### C29 — autorização do feed Meta e controle da sacola

1. **Bling → Meta (P0):** exportar em staging a disponibilidade **por SKU e variante**, data de atualização, reserva e estoque vendável, comparando 42 linhas ativas do feed. A auditoria local `docs/VONIX_META_FEED_READINESS_C29_20261110.json` provou correspondência de IDs/preços/imagens (zero divergências) e constatou que **42 `in stock` não têm evidência de verificação de estoque neste repositório**. Isso não significa 42 esgotados. Responsável comercial deve aprovar política de catálogo, frequência, fallback e impacto dos anúncios **antes** de alterar availability; não desligar campanha em massa sem essa revisão.
2. **Sacola e busca:** em 320/390/1366, buscar `verde combo cafe` e `1kg botox`; conferir que todos os termos continuam obrigatórios, que o link encontrado é ativo e que tamanho inexistente não retorna falso positivo. Adicionar Kit Banana e Mel com 1 unidade no PDP, abrir sacola, verificar `−` indisponível em 1 e remoção independente, `+` permitido em 2 e bloqueado em 99, estado vazio após Remover. Confirmar `/carrinho` com meta `noindex, nofollow` e sem sitemap privado.
3. **Pagamento e métricas:** repetir em Appmax sandbox e Supabase staging sem pedidos reais, incluindo disponibilidade de gateways, frete por CEP, paid_at e ausência de duplicação. Vinte segundos de renderização/hidratação sem ação ainda não foram homologados no Cloudflare real; medir CPU/rede lentas. Nem Chrome sintético nem feed local autorizam merge/deploy.

### C30 — pesquisa funcional na primeira pintura e consulta segura de métodos

- Com Chrome/Edge em **320, 390 e 1366 px**, testar entrada direta `/`, `/loja?categoria=kits`, `/produto/kit-cachos`, primeiro **sem JavaScript** e depois com hidratação em rede e CPU móvel lentas. A busca da home deve navegar por HTML para `/loja?q=...`; no catálogo deve preservar **somente filtros URL normalizados**; a lupa do PDP móvel sem JS deve levar à loja. Após hidratação, a navegação SPA e a busca do PDP devem funcionar sem perda de digitação/rota, sem eventos opcionais antes de consentimento.
- Em staging Appmax devidamente autorizado, simular `getPaymentConfig` resolvendo com Pix/cartão ativos, com um só método, com ambos inativos, rejeitando e **travando por mais de 12 segundos**. Durante qualquer consulta pendente, CPF/endereço/cartão/formulário devem estar **inertes**, com aviso acessível e saída para sacola; após erro, oferecer `Tentar consultar novamente` sem alterar cupom ou sacola. Retomar um pedido pendente deve preceder essa tela e **nunca** abrir segunda cobrança. Guardas de `onSubmit` e `submitPayment` são defesa adicional, não substituem servidor.
- Teste local C30 `qa-c30-checkout-readiness.mjs` preservou item sintético e ocultou PII quando configuração local indicou gateway indisponível, **não** testou Appmax real nem operações financeiras. Continuar P0 Bling/Meta (42 alegações `in stock` sem prova operacional), Supabase staging, frete, Worker e reconciliação financeira antes de publicar.

### C31 — cenários obrigatórios de frete mutável durante checkout (sem cobrança real)

No staging seguro, com cesta sintética e cotação inicial válida, testar (1) CEP A → CEP B enquanto transporte responde lento, (2) quantidade/variante do mesmo SKU alterada, (3) inclusão/remoção de cupom, (4) retry após falha de rede e (5) duas respostas fora de ordem. O frete anterior deve desaparecer **na mesma renderização**; o botão deve permanecer desabilitado e envio forçado de formulário não pode alcançar o pagamento. O serviço e o total só voltam quando a resposta atual estiver disponível e aprovada pelo backend. Validar prazo e cotação com as dimensões reais do Bling antes de disponibilizar transporte. A mitigação C31 foi testada em React com mocks, o Chrome cruzado foi navegacional e **não validou quotes reais**. Não ativar gateway, pedido, frete de terceiros ou anúncios sem autorização.

### C32 — testar indisponibilidade, respostas tardias e congelamento sem cobrar

- Frete: simular cotação que nunca resolve por 15 segundos, verificar aviso e `Tentar calcular frete novamente`. Simular retorno do provedor antigo **depois** da expiração e **depois** de uma segunda cotação válida: nenhuma reativação de preço ou serviço obsoleto. O timeout de UI não implica cancelamento no provedor.
- Configuração de pagamentos: resposta de `getPaymentConfig` posterior a 12 segundos deve ser ignorada, mesmo se anunciar cartão/Pix disponíveis. Só o botão de tentativa explícita realiza nova consulta. Confirmar que o checkout não exibe CPF, cartão ou endereço antes da disponibilidade validada.
- Cupons: iniciar validação remota pendente, confirmar `Gerar Pix`/`Pagar cartão` desativados e submit forçado sem cobrança; substituir por cupom local e garantir que resposta do primeiro não substitui desconto.
- Pagamento em andamento: após submit de carrinho **sintético**, confirmar `inert` e `aria-busy` durante API pendente e a não aplicação de cupom de afiliada tardio. **Não efetuar pagamentos reais**. Em sandbox aprovado, verificar captura de preços, revalidação de estoque/total e antirrepetição até `paid_at`.
- Evidências locais C32: `docs/VONIX_AUDITORIA_CONTINUIDADE_C32_20261110.md`, `qa-artifacts/vonix-c32`. São testes por mocks + Chrome com rede externa bloqueada, não homologação de transportadora/Appmax.

### C33 — validação obrigatória de endereço e CEP antes de liberar pedidos reais

1. Em checkout sintético, consultar **CEP A** com endereço retornado e preencher número/complemento. Mudar dígitos do CEP para **B**. Confirmar que rua, bairro, cidade, UF, número e complemento antigos somem imediatamente e que subtotal/sacola/dados do cliente permanecem; o frete de A deve continuar invalidado pelo gate C31.
2. Consultar CEP B com API de endereço lenta. Digitar rua corrigida antes da resposta; retorno automático **não pode sobrescrever** essa rua, mas pode completar bairro/cidade/UF vazios. Emendar novo CEP durante request; ignorar resposta antiga. Sem garantir que a cidade retornada reflete cobertura real do frete.
3. Simular serviço de CEP sem resposta por **10s**. O loading deve terminar e permitir entrada manual. Clicar `Tentar buscar CEP novamente`; uma resposta nova deve complementar campos vazios sem desfazer ajustes. Resposta antiga que chega após timeout ou retry não pode repor dados obsoletos.
4. Esses testes foram feitos com mocks/Chrome local externo bloqueado. Em staging aprovado, conferir busca postal real, cobertura e validação de frete/pagamento sem dados pessoais e sem cobranças. A prévia `vite preview` do adaptador atual falha por expectativa de `dist/server/server.js`; testar runtime Cloudflare Worker staging antes de publicar.

### C34 — fechar os problemas da auditoria integral antes de qualquer liberação

**Fase 1 — bloqueios comerciais (requer responsável de operação e autorização):** obter do Bling a disponibilidade vendável por SKU/variante com saldos e reservas, conciliar os **42** IDs do catálogo Meta no site publicado (todos atualmente `in stock`) e revisar campanhas antes de ajustar o feed. Não inferir estoque 0. Obter as dimensões/peso reais dos kits e produtos; confirmar embalagem por pedido e origem CEP para cotação Melhor Envio, preço e SLA, em staging.

**Fase 2 — financeiro (somente sandbox Appmax aprovado):** testar cliente/endereço, WhatsApp com DDD, UF válida, cartão tokenizado, Pix, antifraude, recusa, webhook de atraso e duplicidade, estado `paid_at`, snapshots e idempotência de cotação/pagamento. Exigir que números inválidos e endereços compostos de espaços sejam rejeitados sem criar cliente, ordem, cobrança ou pagamento; casos de WhatsApp Business com linha fixa e +55 devem continuar válidos. Dados sintéticos ou autorizados, sem PII de clientes reais.

**Fase 3 — staging e publicação:** validar migrations/RLS Supabase, restore/backup, Cloudflare Worker real, WAF/CSP, scripts/canonical/SEO, mobile e timeouts. Comparar a branch com as seis rotas públicas: o cart/conta publicados hoje não emitem `noindex` enquanto a branch emitia; só conferir correção após deploy autorizado. Sem autorizar deploy, manter PR #26 OPEN e produção NOT_APPROVED.

**Fase 4 — rastreio financeiro/Meta:** reconciliar GA4/Meta Purchase por sessão/consentimento e pedido confirmado (sem PII); somente atribuir abandono ou ROAS a uma causa quando houver evidência. Provar procedência de reviews e LGPD. Fechar apenas quando houver recibo real de cada dependência.

**Auditoria local C34 verificada:** 690/690 testes, 42/42 PDP, 15/15 rotas, 129/129 assets, Meta CSV 42/42 sem divergência, Chrome 6/6, `noscript` SSR markup 3/3 (não visualmente provado com JavaScript desligado). Arquivos de entrega: `docs/VONIX_AUDITORIA_INTEGRAL_C34_20261110.md`, `docs/VONIX_C34_VERIFIED_RECEIPT_20261110.json`, `qa-artifacts/vonix-c34/`.

### C35 — frete grátis por subtotal bruto na ficha de produto (10/11/2026)

A página de produto passou a informar frete grátis usando `sel.gross`, e não o valor líquido descontado, alinhado a `shippingOptions`, `checkoutTotals` e `ShippingBar`. Caso regressivo: 2× R$81,90 → bruto R$163,80 → líquido R$144,14, com cotação grátis apenas se transportadora atender o CEP. Teste RED antes / GREEN depois, sem alterar preço ou servidor. A comunicação diz agora *calculado antes dos descontos*.

**Gates externos inalterados:** validar estoque vendável dos 42 SKUs do feed com Bling, Appmax sandbox Pix/cartão e status pago, dimensões reais de frete, staging Cloudflare/Supabase, WAF/RLS/rollback, consentimento LGPD e GA4/Meta conciliados. **Não tratar C35 local como aprovação de produção.**

### C36 — CEP postal externo com dados incompletos/invalidáveis

A regra de endereçamento em `address.server.ts` agora rejeita UFs que não pertençam às 27 unidades federativas (mesmo que sejam duas letras) e cidade composta só por espaços. Respostas de ViaCEP inconsistentes devem abrir tentativa ao BrasilAPI; se ambas falharem, mostrar entrada manual. O checkout indica corretamente quando faltam rua ou bairro em CEPs municipais e prioriza o foco no primeiro campo vazio, sem sobrescrever dados que o comprador já digitou. Testes somente com mocks, nenhum endereço real de cliente acessado.

A regra financeira não foi modificada: **não habilitar pagamentos reais** até homologar Appmax sandbox, Bling 42 SKUs com saldo real, frete por peso/dimensão, Supabase/Cloudflare staging/RLS/restore/rollback e dados GA4/Meta reconciliados. Todos permanecem pendentes de responsável operacional; **NO-GO** para produção sem provas.

### C37 — não remover carrinho novo quando pagamento anterior for aprovado

Após a ordem ser criada em Pix/cartão, armazenar apenas SKU, variante, quantidade e oferta da cesta **enviada** em snapshot de sessão com orderId/TTL de 24h, sem dados pessoais ou status financeiro. Ao receber `paid=true` autenticado da Appmax, só limpar o carrinho se ainda corresponder exatamente ao snapshot. Se o cliente adicionou itens, modificou a cesta, recarregou sessão legada ou perdeu storage, **preservar** os novos produtos; para `verification`, nunca presumir identidade da cesta atual. No Pixel/browser, não vincular novos itens ao Purchase de pedido antigo. Validação sintética C37: dois testes RED→GREEN e 739/739 testes completos verdes; **não comprova** homologação real de pagamentos ou GA4/Meta.

Gates operacionais pendentes e obrigatórios, sem execução neste ciclo: (1) Bling venda por SKU/variante e Meta `availability` 42/42; (2) Appmax sandbox e conciliação de status/webhook/pix/cartão/estorno; (3) transportadoras, pesos, dimensões e CEPs reais; (4) staging Cloudflare e Supabase (RLS, restore, backup, rollback); (5) consentimento/GA4/Meta por pedidos pagos. Sem autorização de merge/deploy, a produção permanece **NOT_APPROVED**.

### C38 — garantir melhor desconto de volume também para complementos do carrinho

Casos de homologação obrigatórios antes de publicar: (a) complemento de 5% em **1 unidade** continua 5% e não acumula Pix; (b) ao elevar para **2 ou 3** unidades aplica respectivamente **12% ou 15%** na mesma variante, sem empilhar porcentagens; (c) checkout servidor normaliza `comp5` legado com 2+ unidades e mostra preço final consistente; (d) payload direto com linhas duplicadas do mesmo SKU+variante é rejeitado, sem gateway; (e) `quotedTotalCents` continua impedindo cobrar quantia divergente. C38 passou em 184 comparações de variantes, 98/98 testes focados, 745/745 completos e Chrome 3/3 (320/390/1366) verificando R$163,50 em 2 un. e R$236,90 em 3 un. de Sérum Argan 60 ml.

Continuam pendentes **antes da homologação e deploy**: saldos vendáveis Bling por SKU e 42 `in stock` do Meta feed; Appmax sandbox com conciliação; pesos/dimensões e prazos reais de frete; Cloudflare/Supabase staging com RLS, backup/restore e rollback; LGPD/GA4/Meta Purchase de pedidos pagos. **NO-GO para produção sem autorização explícita.**

### C39 — reconciliação de múltiplas compras pendentes no mesmo navegador

A identidade não pessoal de itens do pedido é registrada em `sessionStorage`, por `orderId`, até 8 registros/24h. Quando comprador cria a compra B enquanto A ainda está aguardando Pix/cartão, **não substituir a identidade de A**. Ao confirmar A via status autenticado, remover só o snapshot de A e limpar o carrinho unicamente se ele corresponder exatamente a A; preservar B e quaisquer produtos novos. Mesmo com storage corrompido/expirado, não inferir pagamento e não limpar sacola por suposição. Compatibilidade C37 testada. Para homologação real, exigir Appmax sandbox aprovada, pedido paid/reconciliation e testes de retorno após reload e diferentes dispositivos; C39 Chrome com mocks não substitui homologação externa.

Gates inalterados: Bling SKU vendável vs 42 linhas do Meta feed, frete por dimensões reais e CEP, Supabase/Cloudflare staging (RLS, backup/restore, rollback), LGPD, origem de reviews, GA4/Meta `Purchase` conciliado com pedido pago. Nenhum merge/deploy autorizado; **NOT_APPROVED**.
