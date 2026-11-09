# Vonix Hair — checkout seguro: IP antifraude, verificação neutra e token com prazo

**Projeto exclusivo:** e-commerce `lucassilva1175/vonix-hair-care`, PR #26.
**Base inicial verificada:** commit `58f40efe8c25b03b4f5cf385e94d87651135b1ae`.
**Data:** 09/11/2026. **Nenhuma publicação, pagamento ou migração real.**

## Correções

1. **IP antifraude:** `createPayment` não considera mais o campo `ip` enviado pelo navegador. O campo foi removido da validação de entrada e do checkout. O serviço lê `CF-Connecting-IP` do request no servidor e exige um IPv4/IPv6 válido com `node:net.isIP`; se indisponível, usa `0.0.0.0`. Não utiliza `X-Forwarded-For` de procedência arbitrária.
2. **Pré-requisito de infraestrutura:** `CF-Connecting-IP` só é confiável quando a origem está protegida atrás da Cloudflare e não aceita acesso direto que permita forjar esse header. **Homologar esse controle** no staging/produção antes do merge. Em servidores fora da Cloudflare, configurar explicitamente uma origem de IP confiável, pois `0.0.0.0` pode prejudicar a análise antifraude do gateway.
3. **Resultado incerto de Pix/cartão:** o servidor pode responder `method:"verification"` quando perdeu a resposta da Appmax ou identificou tentativa já existente. Antes o frontend tratava tudo que não fosse `pix` como pagamento em cartão. Agora esse resultado gera `verificationOnly:true` em uma sessão de acompanhamento, com título neutro **Pedido em verificação** e explicação específica de que não existe QR recuperável. Não cria outra cobrança automaticamente e continua consultando o mesmo número de pedido.
4. **Após refresh:** `pending-card.ts` preserva opcionalmente `verificationOnly` na sessão existente, valida o tipo do campo e não armazena cartão, CPF ou endereço. Sessões antigas de cartão permanecem compatíveis.
5. **Tokens de status:** assinatura HMAC-SHA256 passou do token determinístico v1, sem expiração, para `v2.<timestamp-base36>.<assinatura>`, vinculada ao ID de pedido, com 24 horas de validade e rejeição de emissões futuras, tokens alterados e tokens v1. Pedidos não resolvidos após esse prazo exigem atendimento. Não divulgar esse token em analytics ou URLs públicas.

## Validação realizada sem credenciais

- Testes direcionados: **32/32 aprovados**, incluindo IP fornecido pelo cliente, IPv6 vindo do edge, IP inválido, Pix sem QR, armazenamento pós-refresh, tokens vencidos, adulterados e de outro pedido.
- Navegador headless isolado (Chrome 157, `NODE_ENV=test`): a sessão fictícia de `verificationOnly` restaurou corretamente em **390×844** e **1366×768**. Confirmados título neutro, referência de pedido, ausência da mensagem falsa de cartão, ausência do formulário de cobrança, zero overflow horizontal e nenhuma exceção JavaScript.
- Validações complementares: suíte Vitest, TypeScript, lint focado e build antes do envio ao GitHub.
- Sem Appmax real, compras, cobrança, alteração de `.env`, tokens de produção, banco operacional ou acesso a outros projetos.

## Pendências antes de ativar o PR

- Validar **Appmax sandbox** com Pix, cartão, análise antifraude, timeout e status final.
- Validar migrações Supabase em **staging**, com backup, incluindo as tabelas de idempotência e de recuperação Meta.
- Revisar a cadeia de proxies Cloudflare e fechar acesso direto à origem; confirmar a entrega de IP real, sem confiar em cabeçalhos forjados.
- Comprovar contratos de Bling, pesos/dimensões e estoque por SKU.
- Validar eventos de compra confirmados e consentimento LGPD; configurar agendadores administrativos apenas após homologação.

## Reversão

A versão anterior desta rodada permanece preservada como commit `58f40ef`; criar um backup imutável antes de enviar a atualização. O PR não deve ser mesclado nem implantado sem a validação P0 e autorização operacional.
