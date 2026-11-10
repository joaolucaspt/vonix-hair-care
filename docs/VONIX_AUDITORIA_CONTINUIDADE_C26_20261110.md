# Vonix Hair — Continuidade C26: descoberta, busca e honestidade de estoque (10/11/2026)

**Escopo:** e-commerce operacional em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, base C25 `b52f397`, PR #26. Não é o aplicativo independente de candidaturas de afiliadas. **PRODUÇÃO NOT_APPROVED**.

## O que mudou para a pessoa que compra

| ID | Tela | Falha observada antes | Correção C26 |
| --- | --- | --- | --- |
| N101 | Home, blocos de necessidades | Os links da home enviavam `uso=pessoal`, valor rejeitado pelo próprio validador da loja (somente `casa`/`salao`); a audiência selecionada não era garantida | Link corrigido para `uso=casa`; os seis caminhos preservam a necessidade escolhida |
| N102 | Loja / busca | A expressão buscada precisava existir **contígua** na concatenação de nome, categoria e resumo. Ex.: palavras do mesmo produto em ordem diferente não traziam o item | Busca sem acentos/case mantém sinônimos antigos kit/combo e agora aceita **todas** as palavras em qualquer ordem/campo, sem abrir margem para resultados faltando termos |
| N103 | Produto / SEO | Dados estruturados declaravam `InStock` para todas as fichas, sem reconciliação efetiva com Bling | Omitida a propriedade `availability` até poder ser informada com prova de estoque; preço, URL, imagem e demais propriedades preservados |
| N104 | Home / banners | Destaque somente por imagem/preço, pouca indicação visual do próximo passo; carrossel animava sem controle de pausa | CTA `Conhecer este kit`, botões acessíveis de anterior/próximo, pausa/reprodução, pausa ao interagir e respeito a preferência de movimento reduzido |
| N105 | Home / descoberta | Sem bifurcação clara para clientes de casa e profissionais antes da grade de produtos | Nova seção `Explore do seu jeito` com dois cartões editoriais responsivos que levam a `/loja?uso=casa` e `/loja?uso=salao` |

As alterações são de UX, busca, navegação e confiabilidade da descrição pública. **Não alteram pagamento, preço, estoque operacional, reserva, cupom, comissão nem frete**. Não foi habilitada conexão nova a terceiros.

## Verificações reais, todas locais e isoladas

- Vitest completo: **659/659 PASS** em **81 arquivos**. Inclui novas afirmações de busca flexível e negativas, sem mexer no comportamento de pagamento.
- TypeScript `npx tsc --noEmit`: **EXIT 0**.
- ESLint global de regras funcionais com `prettier/prettier` desligada (dívida antiga de CRLF): **EXIT 0**.
- Build Nitro/Cloudflare Module local: **EXIT 0**. Não é deploy nem teste de Worker hospedado.
- Chrome real headless `scripts/qa-c26-conversion-ui.mjs`: **3/3 PASS**, 320/390/1366 px, 9 screenshots em `qa-artifacts/vonix-c26`, 0 erros JS/overflow; rede externa bloqueada. Exercita CTA e segmentação da home, pausa, busca `verde kit cafe` e JSON-LD do produto sem estoque presumido.
- SSR `scripts/qa-c26-ssr-storefront.mjs`: **42/42 fichas ativas PASS**, SKU `plex-vonix` retorna 404, metatags, URLs, imagens e preços consistentes. Report `docs/VONIX_SSR_PREFLIGHT_C26_20261110.json`.
- `git diff --check`: **EXIT 0**.
- Sem pedido, pagamento, contato, conta real, mutação Supabase, integração Bling, abertura de candidaturas ou publicação.

## P0 que impede liberar o PR #26

1. Homologar Appmax **sandbox** Pix/cartão, autorização, recusa, expiração, antifraude, `paid_at`, tokenização, idempotência e acompanhamento de status.
2. Em Supabase staging **isolado**, revisar RLS/service_role, migrações, concorrência/lock, backup e restauração.
3. Conciliar Bling v3, SKUs físicos, disponibilidade, pesos/dimensões, transporte e estoque para poder publicar status de estoque fidedigno.
4. Validar CEP/frete reais para operadoras e Worker Cloudflare hospedado; rastreio de falhas distribuídas/WAF.
5. LGPD pós-compra/revogação, origem e legitimidade dos depoimentos, GA4/Meta apenas para pagamentos confirmados e relatórios por canal/dispositivo.

**Diagnóstico comercial não resolvido:** contagens anteriores de visitas e pageviews (593 visitantes, 50 visualizações em carrinho, 32 em checkout) **não constituem funil único**; não provam se o gargalo principal é mídia, proposta de valor, frete ou recusa de pagamento. Medir eventos por sessão e reconciliação financeira antes de atribuir causa ou prometer aumento de vendas.

## Continuidade segura

Manter o PR #26 em revisão, não mesclar nem publicar a versão C26 sem os gates P0 e aceite. O site público e o checkout operacional não foram homologados por estes testes. Revisar imagens da home e todo o checkout visual com evidência por dispositivo no futuro, mantendo integridade financeira da branch auditada.
