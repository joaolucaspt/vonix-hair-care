# C57 — Vonix Afiliadas: e-mail obrigatório e jornada premium de recrutamento

Data: 18/11/2026. **Exclusivo ao programa de afiliadas Vonix Hair**. Nenhuma alteração ao e-commerce, carrinho, checkout, pagamentos, estoque, preços ou pedidos. Base: merge C56 `64f76299e2e45d5e05e63e73bf3ccf956df30dc5`.

## Objetivos e referências verificadas

- Solicitação explícita: **e-mail NÃO pode ser opcional; é obrigatório em TODA nova candidatura**.
- Referência editorial e de organização: `https://skence.com.br/pages/skence-creators`. Inspiração apenas de estrutura (benefícios, etapas, clareza, CTA, creator paths), sem copiar texto, testemunhos, percentuais, incentivos, imagens, descontos ou promessas de outra marca.
- Site e catálogo próprios: `https://vonixhair.com`, `https://vonixhair.com/seja-afiliada`, produtos reais localizados em `public/images/products`; imagens de Kit Banana e Mel, Máscara Nutri Repair e Botox Vonix.
- Condições comunicadas no próprio site Vonix: 8% sobre vendas elegíveis/confirmadas/pagas após aprovação, programa sem estoque próprio, bônus por metas e possibilidade de supervisão conforme critérios. Nenhum ganho é garantido; candidatas não recebem benefícios apenas por se inscrever.

## Engenharia do e-mail obrigatório (sem perda de históricos)

1. `src/lib/affiliate-simple.ts`: esquema estrito de novas inscrições `affiliateSimpleSchema` rejeita e-mail ausente, vazio, só espaços ou inválido e normaliza e-mail válido para minúsculas. `affiliateSimpleBaseSchema` mantém valor padrão vazio apenas para **descriptografar dados históricos v3** que foram salvos antes do campo existir. Esse esquema base não valida uma nova submissão.
2. `src/lib/affiliate-applications.server.ts`: `createSimpleAffiliateApplication` executa a validação estrita e persiste `email: data.email` (jamais `null` para NOVA candidatura). Campo SQL `public.vonix_affiliate_applications.email` já existia como nullable em C56; não aplicamos `NOT NULL`, pois registros antigos legitimamente não possuem e-mail. Não geramos endereços fictícios, não alteramos candidaturas existentes, não fizemos backfill. Telefone/endereço continuam em ciphertext com AES-256-GCM.
3. `src/components/affiliate-simple-form.tsx`: `type=email` com `required`, marca visível de obrigatório, validação HTML e Zod, aviso de que a equipe pode contatar por e-mail. O código privado de acompanhamento NÃO é enviado por e-mail: a pessoa deve guardar o recibo. A prévia nunca envia candidaturas e usa o mesmo formulário seguro.
4. `src/components/affiliate-landing.tsx`, `affiliate-application-prep.tsx`, `src/routes/seja-afiliada.tsx`: FAQ, checklist e passos alinhados à nova exigência. TikTok continua opcional.
5. Novos testes negativos verificam que submissão sem e-mail NÃO chama `fetch` e que a ausência continua compatível com decodificação histórica.

## Conversão e apresentação premium

- Novo componente `src/components/affiliate-selling-flow.tsx` explica em três cards com fotos oficiais: conteúdo/link após habilitação, compra pelo site Vonix, comissão anunciada quando a venda for elegível e confirmada. CTA contextual para candidatura ou prévia, dependendo da disponibilidade real. Sem testemunhos de afiliadas ou vendas inventadas. Cards com alt, loading lazy e foco seguro.
- Hero com fundo editorial original em tons da marca, CTA **Quero ser afiliada Vonix** quando candidaturas abertas, e três informações transparentes: 8% após aprovação, sem estoque próprio, inscrição gratuita.
- Nova imagem de compartilhamento `public/affiliate-creators-share.png`, 1200×630, gerada da foto oficial do Kit Banana e Mel e design vinho/rosé original, com mensagem comercial condicionada à aprovação; divulgada no Open Graph e Twitter do portal. Sem fotografias externas ou de outras marcas.
- SEO/meta mais descritivos e só com termos aplicáveis à Vonix. As avaliações existentes de clientes de **produtos** seguem identificadas como tais e NÃO se tornam depoimentos falsos de participantes do programa.
- Uma futura seção de prova social de **afiliadas** só pode ser adicionada quando houver conteúdo verdadeiro, autorizado e auditável. Depoimentos, volume de vendas e ganhos reais de creators não foram fabricados.

## Segurança e QA

- Sem leitura de `.env`, chaves, tokens, bancos locais originais ou dados pessoais reais. Nenhuma mudança em papéis, RLS, service role, autorização ou sessões administrativas.
- TypeScript `--noEmit`, ESLint dos arquivos modificados, Prettier, build Nitro/Vite e `git diff --check`: PASS.
- Suite integral `npm test`: **745/745 PASS em 78 arquivos** depois da atualização das expectativas C53/C54 para nova redação.
- Chrome local `C57-browser-QA.cjs`: 360×780, 390×844, 768×1024, 1440×900, **4/4 PASS**, verificando layout sem overflow, três imagens carregadas, CTA/FAQ, Open Graph, e-mail obrigatório, rejeição de formato inválido, aceitação de e-mail válido, nenhum POST de candidatura, zero erros JS, painel administrativo sem mostrar dados antes de autenticar. PNG 1200×630 servido HTTP 200.
- Scripts locais de QA (`C57-browser-QA.cjs`, `C57-og-build.cjs`, `C57-email-patches.cjs`), screenshots e logs ficam **fora do commit**. A imagem final de campanha em `public/` entra no PR; scripts de geração não.
- Não houve end-to-end autenticado com contas reais (não conhecemos senhas individuais). Nem real envio de formulário em produção para evitar dados fictícios. Para candidatas antigas sem e-mail, a consulta protegida continua mostrando que o campo nunca foi informado.

## Publicação

Abrir PR do C57 com apenas código afiliadas, asset social e testes. Confirmar checks GitHub (RLS isolado, TypeScript/lint/build), merge em `main`, sincronização exata no Lovable, deploy e smoke do domínio real antes de declarar publicado.
