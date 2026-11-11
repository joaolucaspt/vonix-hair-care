# Vonix Hair — C40: auditoria de identidade do endereço na prevenção de duplicidade

**11 de novembro de 2026.** Projeto exclusivo: e-commerce operacional Vonix Hair em `C:\Users\JL\code\vonix-hair-care`; branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26. Base **C39** `bf3b2da483887f4d6538bed614e8cfb0c63ae6d4`, worktree limpa, CI de base 4/4 aprovada. O app separado de candidatura de afiliadas não foi alterado. Nenhuma cobrança real, deploy, merge, leitura de segredos ou acesso ao banco operacional.

## N160 — P1: apartamentos de um mesmo endereço colidiam no HMAC idempotente

O servidor guarda no Supabase apenas um **HMAC SHA-256 secreto** que representa tentativa de compra com mesmo CPF, produtos físicos, quantidades e destino, evitando recriar cobranças em Pix/cartão. O algoritmo anterior em `src/lib/checkout-idempotency.server.ts` incluía CEP, rua, número, cidade e UF, mas **ignorava o complemento**. Dois pedidos para `Rua Teste, 20, Apto 101` e `Rua Teste, 20, Apto 202` feitos pelo mesmo CPF e com os mesmos produtos produziam a **mesma impressão**, confundindo destinos distintos. Como um pedido em análise bloqueia novas tentativas com o mesmo HMAC, isso podia impedir uma compra legítima e associar sua recuperação ao pedido de outro apartamento.

**Prova RED:** `src/test/checkout-idempotency.test.ts` comparou o hash de dois apartamentos e encontrou igualdade indevida. `src/test/checkout-security.test.ts` simulou um pedido legado em fase `charging`; ao mudar o apartamento, a versão anterior criava outro Pix sem consultar o identificador antigo, o que demonstrou risco de duplicidade caso a chave mudasse sem migração segura. Ambos os testes falharam ANTES do patch, com dados de teste.

## Correção — destino fiel e migração conservadora

- `checkoutFingerprint` inclui `complement` **quando não vazio**, com espaços externos removidos e normalização de caixa (`pt-BR`). Assim apartamentos diferentes geram HMACs diferentes, mas `Apto 101` e `apto 101` são equivalentes.
- **Compatibilidade:** endereços sem complemento mantêm o hash antigo, byte a byte. Isso evita invalidar tentativas pendentes sem apartamento durante a atualização.
- `createPayment` calcula a impressão antiga e a nova. Quando elas diferem, faz uma **consulta somente leitura** ao identificador legado *antes* de cotar frete, reivindicar uma nova intenção ou enviar dados para Appmax. Se o legado estiver pendente, recupera a referência do pedido ou bloqueia uma nova tentativa; falhas de consulta **falham de forma conservadora**, sem criar cobrança.
- Uma intenção antiga comprovadamente **cancelada** ou `completed` há mais de 24 horas não impede uma tentativa nova. Uma intenção legada recente pode bloquear temporariamente outro apartamento do mesmo prédio; isso é intencional para evitar cobrança duplicada de pedido pré-migração. O cliente deve consultar o atendimento caso a tentativa esteja em análise.
- O HMAC permanece calculado apenas no servidor com segredo de configuração. Nenhum CPF, endereço, apartamento, cartão ou dado pessoal é gravado em texto claro na tabela de intenções. O valor transmitido às consultas é apenas o fingerprint HMAC.
- **Nenhuma migração de esquema de banco**, alteração no gateway, Appmax, checkout de afiliadas, ERP, feed Meta ou regra de preço foi necessária.

Foram adicionados **cinco testes relevantes**: distinção de apartamentos e igualdade sem complemento, prevenção de nova cobrança diante de tentativa legada ativa, recusa em falha da consulta legada, continuidade após cancelamento comprovado e fingerprints distintos para tentativas novas de dois apartamentos com histórico legado inexistente. Todos os testes servidores são sintéticos, sem transações.

## Validação C40

| Verificação | Resultado |
| --- | --- |
| Vitest integral | **756/756 PASS**, 88 arquivos |
| Testes direcionados HMAC / checkout | **63/63 PASS**, 2 arquivos |
| TypeScript | EXIT 0 |
| ESLint funcional | EXIT 0, 12 warnings históricos, 0 erros |
| Build Nitro/Cloudflare local | EXIT 0 |
| Prettier / git diff-check | EXIT 0 / EXIT 0 |
| Fichas de produto SSR | **42/42** PASS, Plex Vonix retirado em 404 |
| Rotas / sitemap | **15/15** PASS |
| Imagens locais | **129/129** referências íntegras |
| Feed Meta CSV local | **42 linhas**, sem inconsistência estrutural; **estoque Bling NÃO verificado** |
| Chrome vitrine/carrinho | **3/3** PASS em 320, 390 e 1366 px |
| Chrome checkout sintético | **3/3** PASS em 320, 390 e 1366 px |
| HTML `noscript` | **3/3** presença SSR (não demonstra renderização visual com JS desativado) |
| Capturas | **21 PNG** em `qa-artifacts/vonix-c40/` |

Evidências em `qa-artifacts/vonix-c40/`, `scripts/qa-c40-*.mjs`, `docs/VONIX_SSR_PREFLIGHT_C40_20261111.json`, `docs/VONIX_META_FEED_READINESS_C40_20261111.json`, e recibo `docs/VONIX_C40_VERIFIED_RECEIPT_20261111.json`. Logs podem ser ignorados pelo Git; hashes são separados entre artefatos versionados e arquivos de log locais. O resultado do GitHub CI do SHA C40 deve ser verificado depois do push, e não inferido de C39.

## Situação da produção — NOT_APPROVED

1. **Bling:** estoque vendável de cada SKU/variante não comprovado, apesar das 42 declarações `in stock` no feed Meta.
2. **Appmax:** faltam transações autorizadas de sandbox Pix/cartão/antifraude, reconciliação de pedidos pagos, webhooks e reembolsos.
3. **Frete:** dimensões/pesos verdadeiros e preços/prazos de transportadoras por CEP ainda não homologados.
4. **Cloudflare/Supabase:** ambiente staging isolado, RLS/migrações, restore/backup e rollback efetivo.
5. **LGPD/GA4/Meta:** origem de depoimentos, consentimento e eventos de conversão conciliados com vendas efetivamente pagas.

**Sem merge, deploy, alteração de campanhas, operações de pagamento/estoque reais ou acesso a segredos.** A melhoria local C40 não prova disponibilidade ou correção já publicada.
