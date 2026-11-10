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
