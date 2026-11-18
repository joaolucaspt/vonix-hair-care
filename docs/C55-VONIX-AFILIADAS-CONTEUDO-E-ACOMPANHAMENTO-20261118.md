# Vonix Hair Afiliadas C55 — roteiros originais e acompanhamento claro

**Data:** 18 de novembro de 2026. **Projeto:** sistema de afiliados Vonix Hair, exclusivamente página pública `/seja-afiliada`. **Baseline:** merge C54 `8d4565c133fca2315dbeb144abf4bcd6b9ab5aa4`.

## Referências verificadas

- Página pública atual: https://vonixhair.com/seja-afiliada
- Loja e produtos reais da marca: https://vonixhair.com/ e https://vonixhair.com/produto/botox-vonix
- Referência de arquitetura editorial: https://skence.com.br/pages/skence-creators
- O catálogo e os comentários reais de clientes da loja já integrados em C53/C54 foram preservados e continuam **explicitamente identificados como informações de produtos, não resultados de afiliadas**.
- **Não foram copiados** vídeos, criadoras, depoimentos, vantagens, valores de comissão, fotos ou direitos da marca de referência.
- Não existem depoimentos consentidos ou métricas verificadas do programa Vonix suficientes para criar uma área de provas sociais de afiliadas reais. Não foram inventados.

## Escopo efetivamente alterado

1. `src/components/affiliate-landing.tsx`: expandiu os quatro cards existentes de formatos (unboxing, rotina capilar, resenha sincera e foto de produto) com seção expansível nativa `details/summary`. Cada card mostra uma **abertura original sugerida**, três ideias práticas e um aviso de transparência. Foram mantidas as imagens oficiais e as âncoras/CTAs atuais.
2. `src/components/affiliate-next-steps.tsx` (novo): seção pós-inscrição, sem dados de usuárias nem API, com três ações claras: guardar código **apenas após confirmação real**, acompanhar por `/consultar-candidatura`, esperar comunicação oficial condicional sem prazo garantido. Diferencia candidatura confirmada de prévia sem envio.
3. Botão de copiar **somente o endereço público canônico** `https://vonixhair.com/seja-afiliada`, sem códigos, perfis, tokens, UTM, dados pessoais ou tracking. Feedback acessível de sucesso/falha; uso opcional.
4. `src/routes/seja-afiliada.tsx`: inclusão da seção informativa entre formulário e perguntas frequentes, com estado verdadeiro aberto/prévia, sem tocar nas regras de disponibilidade e submissão.
5. `src/test/affiliate-c55-content.test.tsx` (novo): 5 testes de roteiros, semântica de abas/expansões, regras do seguimento, cópia segura de URL e fallback de bloqueio.

## Verificações e limitações

- `npx tsc --noEmit`: PASS.
- ESLint dos arquivos modificados: PASS, zero erros.
- Prettier: PASS.
- **735/735 testes** em 77 arquivos PASS, incluindo fluxos anteriores do portal, recuperação e autorização.
- Build de produção: PASS.
- Chrome headless em **360×780, 390×844, 768×1024, 1440×900**: **4/4 PASS**, status HTTP 200, zero erro JS, zero overflow horizontal, 4 cards com 4 expansões/roteiros e 3 instruções por roteiro, 3 passos após cadastro, link de status correto, copiar URL pública, CTA levando a `#inscricao` sem ficar oculto e **zero envios de candidatura**.
- O primeiro script de QA produziu um falso negativo intermitente em 360 px por ler o mock da área de transferência antes de completar o evento assíncrono. Corrigido aguardar a escrita e repetidos todos os quatro tamanhos com PASS; nenhuma alteração no app foi exigida.
- Evidências locais não commitadas: `C55-browser-QA.cjs`, `C55-browser-qa-final.log`, `C55-browser-shots/`, `C55-section-qa.cjs`.
- A melhoria na conversão é uma **hipótese editorial**, não um crescimento comprovado: não há dados A/B ou novas submissões de produção analisados.

## Exclusões de escopo

Nenhuma alteração nos arquivos do e-commerce (catálogo, preços, carrinho, checkout, pagamento, entrega), regras de Auth/admin, conta das três administradoras, bancos, candidaturas reais, e-mails, arquivos `.env`, políticas RLS, comissão devida ou integração publicitária. Não houve POST real nem leitura de dados pessoais.

## Critérios de publicação

Criar PR delimitado e acompanhar CI. Merge apenas com os dois gates remotos verdes. A versão no Lovable e em `vonixhair.com/seja-afiliada` deve ser confirmada com leitura real do script e do DOM em 4 viewports. Sem evidência, manter status como pendente.
