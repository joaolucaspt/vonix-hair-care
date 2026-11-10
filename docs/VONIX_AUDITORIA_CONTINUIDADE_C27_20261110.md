# Vonix Hair — C27: coerência de público e continuidade de compra (10/11/2026)

**Projeto exclusivo:** e-commerce Vonix Hair em `C:\Users\JL\code\vonix-hair-care`, branch `fix/vonix-ecommerce-auditoria-2026-11-09`, PR #26; base C26 `45e38f4`. Não tocar no aplicativo independente de afiliadas. **Produção: NOT_APPROVED.**

## Resumo para quem usa a loja

| ID | Tela | Antes | Depois |
| --- | --- | --- | --- |
| **N106** | Home → /loja | Depois de já escolher Casa/Salão, clicar no outro cartão C26 deixava a preferência salva prevalecer sobre o link; o título e a ordem podiam ser do público antigo | `resolveAudience` dá precedência a `uso=casa/salao` explícito e válido, mas conserva a preferência salva quando o URL não seleciona um público |
| **N107** | Loja → cabeçalho | Mesmo após entrar por um link explícito, o estado armazenado do público podia continuar diferente do filtro da lista | Quando a página hidrata, a escolha explícita válida sincroniza o estado de audiência no cabeçalho e nas navegações seguintes |
| **N108** | Checkout, seleção do pagamento | A escolha inicial sempre era Pix. Em uma configuração com apenas cartão habilitado, ficava parado no Pix desativado até a pessoa descobrir e alternar manualmente | Ao carregar configuração, seleciona o método disponível; rádios impossíveis ficam desativados e marcados `indisponível`; não ocorre cobrança automática |
| **N109** | Checkout sem Pix e sem cartão | Formulários de nome, CPF, contato/endereço apareciam, mas não havia forma de finalizar pelo site | Tela de `Pagamento online indisponível` com CTA de atendimento e retorno à sacola; não coleta dados nesse estado, preserva carrinho e rotas de verificação de pagamentos anteriores |
| **N110** | Gaveta Comprar agora | Botão de diminuir em 1 acionava `setQty(0)`, podendo remover produto; aumentar em 99 continuava clicável; controles iguais em variantes distintas eram ambíguos | Botões desativados nos limites 1/99, remoção separada, nomes acessíveis com tamanho/variante |
| **N111** | Gaveta móvel | Controles de quantidade competiam horizontalmente com título/preço; a página por trás ainda podia rolar | Linha de controles própria, flexível, rolagem de fundo bloqueada enquanto modal aberto e restaurada ao fechar |

**Escopo de segurança:** nenhuma alteração em regras de desconto, preço, total de pagamento, Appmax, Bling, estoque, armazenamento financeiro, tokens, idempotência ou integrações. Opção de atendimento do checkout não é um pagamento nem confirma pedido.

## Evidências realmente executadas

- **Vitest completo: 662/662 PASS em 81 arquivos.** Antes de ajustar a apresentação de indisponibilidade, suite dirigida também passou; resultado final inclui testes de escolha de público, scroll-lock, limite de quantidade e métodos de pagamento.
- **TypeScript `npx tsc --noEmit`: exit 0.**
- **ESLint integral funcional (sem regra `prettier/prettier` histórica): exit 0.**
- **Build Nitro/Cloudflare local: exit 0.** Não equivale a Worker hospedado.
- **Chrome headless local isolado, `scripts/qa-c27-crossflow.mjs`: 3/3 PASS** em 320, 390 e 1366 px; **12 screenshots** (`home`, `salon`, `drawer`, `cart` por viewport), sem erros JavaScript, sem overflow persistente, com rede externa bloqueada e sem pagamento. Confirma: visita que tinha Casa salvo escolhe Salão, persistência corrige a preferência; botão diminuir desabilitado em 1; modal bloqueia/restaura scroll; sacola persiste após fechar drawer.
- **Auditoria SSR `scripts/qa-c27-ssr-storefront.mjs`: 42/42 produtos ativos PASS**, SKU excluído `plex-vonix` HTTP 404, home, catálogo, sacola, checkout e sitemap. Arquivo `docs/VONIX_SSR_PREFLIGHT_C27_20261110.json`.
- Testes dirigidos de checkout rodam com **mocks de gateway/frete**, nenhum Pix, cartão, CPF, endereço, conta ou pedido real foi transmitido.

**Falha da primeira execução do navegador:** o QA media `scrollWidth` enquanto o drawer ainda executava `transform: translateX`, produzindo 0/3 no relatório inicial; a medição foi corrigida para ocorrer após a animação, e o teste final completo marcou 3/3. Não há prova de overflow persistente no navegador.

## Próximos bloqueios de produção

1. **Appmax sandbox:** Pix e cartão, antifraude, status, timeout, conciliação, repetição de pedidos, idempotência, `paid_at`, sem cobranças reais.
2. **Supabase staging isolado:** migrações, RLS/roles, concorrência e restauração de backup.
3. **Bling/expedição:** SKUs, quantidade física, estoque, embalagem, dimensões, valor/frete por CEP e reconciliação de pedido.
4. **Cloudflare Worker staging:** headers, cookies, rate limit distribuído/WAF, redes lentas, monitoramento e rollback.
5. **Privacidade e métricas:** consentimento e revogação pós-venda, verificação de origem dos depoimentos/contadores, GA4/Meta de compras pagas e funil único por sessão, tráfego e dispositivo.

**A origem da ausência de vendas continua inconclusiva sem dados de tentativas, recusas e pagamentos reais por canal.** Os números anteriores de visitantes, páginas de sacola e checkout não representam uma conversão atribuível. **Não liberar PR nem produção** com base apenas no resultado sintético local.
