# Vonix Hair — Auditoria e melhorias C24 (10/11/2026)

**Repositório:** `C:\Users\JL\code\vonix-hair-care` — **somente e-commerce**, branch `fix/vonix-ecommerce-auditoria-2026-11-09` / PR #26. **Base verificada:** C23 `18d6131`. Não alterar aplicativo independente de candidatura ou qualquer outro projeto. **Não aprovado para produção**.

## Problema real e resultado para a cliente

| ID | Onde aparece | Problema antes | Correção e impacto |
| --- | --- | --- | --- |
| **N95** — acessibilidade | Hambúrguer **Abrir menu** de qualquer página do e-commerce | Menu era apenas um painel clicável sem semântica de diálogo e sem foco inicial; leitores de tela/teclado podiam continuar navegando no conteúdo atrás | Painel identificado como **Menu rápido** com `role=dialog`, `aria-modal=true`, título acessível, identificador, `aria-controls` e `aria-expanded`; ao abrir, foco vai para **Fechar menu** |
| **N96** — UX/teclado | Menu aberto, especialmente no celular | `Escape` não fechava, `Tab` não ficava dentro do menu e era possível rolar o fundo; fechamento não restaurava o foco | **Esc fecha**, a navegação com Tab/Shift+Tab fica dentro do diálogo, o corpo para de rolar e, ao fechar com Esc, X ou fundo, o foco volta ao botão que abriu. Rolagem anterior é restaurada |
| **N97** — conversão/navegação | Cliente entra diretamente em `/produto/kit-banana-e-mel`, vindo de rede social ou link | Único atalho de retorno era **Voltar**, que depende de um histórico de navegação que pode não existir ou voltar ao site anterior | Novo link explícito **Explorar loja**, com alvo de toque adequado, leva a `/loja` sem depender de histórico; **não aparece em checkout** para não distrair da compra |

### Evidência antes e depois no Chrome

Os cenários usaram navegador Chrome headless real em localhost e **redes externas bloqueadas**. Sem pedido, formulário, pagamento, avaliação ou integração real.

**Antes (RED):** `qa-artifacts/vonix-c24/red/report.json`: **0/3** (320, 390, 1366 px). Motivo reproduzido: `Menu lacks accessible dialog role/name`. Capturas do menu: `red/open-320.png`, `red/open-390.png`, `red/open-1366.png`.

**Depois (GREEN):** `qa-artifacts/vonix-c24/final/report.json`: **3/3** (320, 390, 1366 px). Em cada viewport, foco inicial em **Fechar menu**, bloqueio de scroll enquanto aberto, Shift+Tab contido no diálogo, fechamento com Escape e foco restaurado, fechamento/navegação pelo link Kits e retorno seguro da página de produto à loja. **9 imagens**: `final/open-*.png`, `final/navigation-*.png`, `final/return-to-store-*.png`. Sem erros JS.

**Testes de regressão:** `src/test/ecommerce-menu-audit.test.tsx`, **3/3**, incluindo fechamento por botão e fundo; produto direto com link para loja e checkout sem link alternativo.

## Validação de todo o sistema (depois das alterações)

- **656/656 testes Vitest aprovados em 80 arquivos**
- `npx tsc --noEmit` exit 0
- ESLint integral sem a regra Prettier histórica exit 0
- Prettier dos arquivos editados exit 0, `git diff --check` exit 0
- `npm run build` Nitro Cloudflare Module exit 0
- Auditoria SSR dos **42 produtos ativos**: 42/42, zero falhas. Recibo de C3 antigo preservado; apenas o timestamp de execução foi devolvido ao valor base
- Chrome **3/3**, nove screenshots, sem overflow nem erros JS, rede externa bloqueada

## O que NÃO foi modificado nem está concluído

Não alterei **preço, desconto, regras de frete, cálculo do checkout, gateway Appmax, autenticação, estoque Bling, banco Supabase**, nem conteúdo do aplicativo de inscrição de afiliadas separado. Os links de recrutamento já introduzidos na branch original permanecem no menu e no rodapé.

**Não é um redesign premium completo da loja**: melhora importante no menu e no retorno à vitrine, não refaz banners, identidade, categorias e PDP. Não houve deploy ou merge na `main` de origem. Permanecem P0: Appmax sandbox com cartão/Pix/idempotência/expiração/`paid_at`, Supabase staging isolado RLS/backups/restore, SKU/estoque/dimensões Bling, frete de transportadora real, consentimento LGPD pós-pedido, WAF/rate limit, GA4 paid-only, smoke no Worker hospedado. A formatação histórica Prettier/CRLF do repositório inteiro continua dívida separada.

**Prontidão de produção: NOT_APPROVED** até homologação operacional.
