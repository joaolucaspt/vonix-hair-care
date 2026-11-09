# Vonix Hair — continuidade das correções pelo GitHub

Data: 09/11/2026. Escopo único: `lucassilva1175/vonix-hair-care`.

## Segurança e restauração

- `main` verificada antes desta rodada: commit `5e7d547e868502f5ae448a82bf078ff62344a768` (inclui as correções anteriores de CEP, checkout, eventos e cadastro).
- Commit ANTERIOR às correções realizadas pelo Lovable: `55643566a25a78e96962fed02627aec414302699`.
- Backup independente no Lovable, criado antes das primeiras correções: [BACKUP Vonix Hair — 09/11/2026](https://lovable.dev/projects/1196c524-6af0-471a-a24a-05dab53ac58d). O backup é um remix; **não** copiar credenciais, domínio ou pagamentos automaticamente ao restaurar.
- Branch local de restauração do GitHub criada antes desta rodada: `backup/vonix-2026-11-09-before-github-corrections` apontando para `5e7d547`.
- Desenvolvimento isolado: `fix/vonix-ecommerce-auditoria-2026-11-09`. O trabalho não altera outros projetos e não publica a loja.

## Correções herdadas e confirmadas no GitHub

As correções já sincronizadas no commit `5e7d547` incluem: consulta de CEP no servidor com segundo provedor; frete independente do CEP; ordem dos campos de cartão anterior ao botão de pagamento; GA4 `view_cart` e `add_shipping_info`; cadastro de cupom sem confirmar persistência inexistente. Foram revalidadas na base inicial: **98 testes passando** e build aprovado.

## Melhorias desta rodada

1. Os dois botões **Comprar agora** na página de produto passam direto de `/produto/$slug` para `/checkout`, adicionando o item antes de navegar. O botão **Adicionar ao carrinho** continua com seu comportamento próprio.
2. Cabeçalho do checkout mais direto: remove da etapa de pagamento os banners rotativos de propaganda, busca, seletores de público e navegação de categorias, sem remover marca, carrinho ou acesso de retorno. Outras páginas preservam seu cabeçalho.
3. O link anteriormente chamado **Entrar** foi renomeado para **Pedidos/Acompanhar pedido**, pois a página correspondente orienta acompanhamento por WhatsApp e não oferece autenticação de cliente.
4. Adições por **Complete seu tratamento** agora emitem o evento GA4 `add_to_cart` com valor realmente descontado, além de atualizar o carrinho.
5. O servidor recusa cartão **sem token** antes de criar cliente ou pedido na Appmax; evita objetos externos criados por tokenização ausente. Isso não substitui idempotência, proteção contra abuso ou validação de pagamento real.
6. Testes automatizados para registro de sugestões no carrinho e prevenção de criação de pedidos sem token.

## Validações feitas sem transações reais

- Testes automatizados: **100 aprovados / 0 falhas**, em 17 arquivos, após as alterações acima.
- TypeScript `tsc --noEmit`: concluído sem erros.
- Build `vite build` pela ferramenta de projeto: concluído sem erros.
- Interface local em `127.0.0.1`, com browser isolado: verificação do fluxo produto → checkout em 390 × 844 e 1366 × 768; carrinho carregado; cartão antes do botão; sem overflow horizontal e sem exceções JS reportadas nos cenários percorridos.
- Ambiente de verificação sem credenciais de Appmax/Melhor Envio: CTA de pagamento fica bloqueado. **Nenhum Pix, cartão ou pedido real foi criado.**
- Lint global continua com problemas de estilo herdados do repositório (relato anterior: 509 erros, 11 avisos). Não foram feitos ajustes cosméticos em massa que dificultem a revisão do PR.

## Pendências para produção

1. Testar, em ambiente autorizado/controlado, cartão aprovado, recusado, timeout, repetição e fluxo Pix completo com confirmação verificada do provedor. Não ativar serviços só por o build estar verde.
2. Sincronizar eventos de `purchase` de pedidos **pagos** com GA4/Meta CAPI, com consentimento e deduplicação adequada. Sem credenciais não é possível validar envio real.
3. Estoque real e tamanhos/pesos de cada embalagem para cotação do Melhor Envio; evitar anúncios de disponibilidade sem inventário.
4. Persistência do refresh token do Bling, conciliação de pedidos, webhooks, reembolsos e observabilidade.
5. Auditar atribuição, canais, campanhas e gravações para explicar o volume de 591 visitantes registrado entre 02 e 09/11 (dado nativo Lovable, não atribuir vendas sem conciliação).
6. Revisar métricas de abandono no checkout e testar a nova jornada com usuários reais antes de investimento adicional em anúncios.

## Reversão

A `main` original permanece em `5e7d547` enquanto esta branch não for mesclada. Para desfazer alterações já mescladas, reverta apenas o commit de merge/PR conforme política do repositório, ou recupere o código pelo commit conhecido. O remix Lovable é uma cópia anterior às primeiras correções e deve ser restaurado apenas deliberadamente: credenciais, banco de dados, domínio e integrações externas não fazem parte de uma reversão automática.

**Estado:** código atualizado isoladamente; sem deploy e sem mudança no domínio `vonixhair.com`.
