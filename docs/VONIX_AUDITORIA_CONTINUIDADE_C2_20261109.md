# Vonix Hair — Continuidade comercial e técnica — 09/11/2026

**Escopo exclusivo:** e-commerce `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. Não é o projeto de afiliadas, e não modifica integrações ou pedidos reais em produção.

## Contexto confirmado antes das alterações

- A branch de auditoria iniciou esta rodada limpa no commit `dd6a39f`.
- O **CI do fork para esse commit foi SUCCESS**, execução GitHub Actions `42654978223`, job “Vonix — testes e build (sem deploy)”. O PR na origem ainda mostra status remoto `CONFLICTING` / checks vazios; essa indicação não substitui a validação técnica e exige nova consulta após o push.
- Desde o commit anterior, a `main` foi atualizada para `06f15b6` com política de frete grátis priorizando até três dias úteis e novo estilo de botão de complemento no carrinho. O merge foi aplicado nesta branch sem alterar manualmente os arquivos de afiliadas. Dois conflitos, **somente em arquivos do e-commerce**, foram resolvidos, sem reset, checkout, stash ou rebase.
- Nenhuma credencial, `.env`, pedidos reais ou banco operacional foi consultado.

## Alterações da rodada

| Código | Região | Evidência e decisão |
|---|---|---|
| C2-01 | `src/lib/checkout.functions.ts` | Frete grátis escolhe somente entre cotações válidas, priorizando opção real de até **3 dias úteis** quando disponível. Mantém preço efetivo zero apenas no serviço selecionado, sem inventar prazo e sem permitir cotação negativa/infinita/inválida no total. |
| C2-02 | `src/routes/carrinho.tsx` | Preserva botão verde-claro quadrado da `main` **e** o evento analítico `add_to_cart` ao adicionar complemento de oferta. Nenhuma diferença introduzida nos módulos de afiliadas. |
| C2-03 | `src/components/cart-summary.tsx` | Antes do CEP, a barra mostra **elegibilidade**, não “frete garantido”. Exige confirmação da cobertura do CEP; resumo não chama subtotal sem entrega de “total final” no Pix/cartão. Mantém estética verde da `main`. |
| C2-04 | `public/depoimentos/depoimento-3.mp4` | Transcodificação H.264 para `moov` inicial (faststart), mesma resolução **478×850**, mesma duração **60,325442 s**, áudio AAC; arquivo caiu de **11.954.722 para 6.250.284 bytes**, redução **47,7%**. SSIM medido com timebases normalizadas: **0,984016**. Original copiado ao TEMP do dispositivo antes da substituição. |
| C2-05 | `src/test/checkout-security.test.ts` | Atualizados os cenários de frete grátis para a regra mais rápida; adicionados testes de cotações rápidas inválidas e fallback para prazo verdadeiro de 6 dias sem transportadora de até 3 dias. |
| C2-06 | `src/test/cart-summary-audit.test.tsx` | Regressões de comunicação honesta do frete antes da cotação e subtotais sem frete. |
| C2-07 | `src/test/media-assets.test.ts` | Regressão do peso máximo de 7 MB e cabeçalho MP4 válido do depoimento longo. |

## O que foi validado nesta rodada

- Testes direcionados de frete, checkout, resumo e mídia: **36/36 aprovados**, 4 arquivos de teste.
- **Suíte completa: 382/382 testes aprovados em 52 arquivos**, saída `TEST_EXIT=0`; **TypeScript** `npx tsc --noEmit` `EXIT=0`; **build Vite/Nitro** `BUILD_EXIT=0`; **ESLint direcionado** `LINT_EXIT=0`.
- Comparação de qualidade SSIM: **0,984016**, com duração e resolução preservadas, sem recriar depoimento ou conteúdo inexistente.
- **Navegador Chrome local:** produto → adicionar ao carrinho → carrinho → checkout, 390×844 e 1366×844, seis páginas HTTP 200; carrinho persistido, resumo sem promessa falsa, nenhum overflow horizontal, imagem quebrada observada ou exceção JS. Um primeiro script sem aguardar hidratação falhou na abertura fria móvel; a repetição aguardando interatividade e verificando o armazenamento do carrinho passou nos dois tamanhos. Isso **não prova** comportamento em rede móvel real — testar condições lentas continua pendente.
- CI do commit **anterior** `dd6a39f` aprovado no fork. CI do novo commit ainda precisa de execução e confirmação.

## Bloqueios ainda não fechados (não mascarar)

1. **P0 pagamentos:** Appmax sandbox para cartão, Pix aprovado/cancelado/expirado, perda de resposta, múltiplas tentativas, reconciliação e webhook autenticado.
2. **P0 banco e ERP:** Supabase staging com RLS, migrações, lock/backup; Bling em ambiente autorizado, estoque efetivo, dimensões/peso e faturamento.
3. **P0 marketing factual:** feed público continua anunciando 43 produtos `in stock` sem comprovação do estoque operacional, e preços “de” não possuem histórico revisado aqui.
4. **P1 conversão:** medir sessões por etapa, origem de tráfego, recusas Appmax e **pedidos pagos reais**. HTTP 200, CTA Pix disponível e testes unitários não permitem concluir “a loja já vende”.
5. **P1 acessibilidade/performance:** auditoria com navegação por teclado, leitor de tela, Lighthouse mobile com rede fria, dados de CrUX, permissionamento de depoimentos.
6. **P1 implantação:** revisar status e CI do PR #26, **sem merge/deploy** antes de homologar os P0.

A matriz da auditoria original e dos achados N01–N15 está em `docs/VONIX_AUDITORIA_MATRIZ_20261109.md`. Esta continuidade adiciona C2-01 a C2-07 sem apagar riscos anteriores.
