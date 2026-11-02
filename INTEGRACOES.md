# Integrações: Appmax (pagamento) e Melhor Envio (frete)

Toda a comunicação com as duas APIs acontece no servidor (`src/lib/*.server.ts` e `src/lib/checkout.functions.ts`).
Os preços são sempre recalculados a partir do catálogo no servidor; o navegador só envia o que está no carrinho.

## Segredos necessários
Veja `.env.example`. No Lovable, cadastre-os como segredos do projeto. Nunca cole chaves no chat nem no código.

## Fluxo
1. Cliente informa o CEP → `quoteShipping` consulta o Melhor Envio e lista as opções. O frete grátis (acima de R$ 150 em produtos) zera a opção mais barata.
2. Pix → `createPayment` cria cliente, pedido e Pix na Appmax e devolve QR Code e código copia-e-cola. A tela consulta `getOrderStatus` a cada 5 s até a confirmação.
3. Cartão → o Appmax JS tokeniza o cartão no navegador (o número nunca passa pelo nosso servidor); `createPayment` envia o token.
4. Webhook: configure na Appmax a URL `https://SEU-DOMINIO/api/public/appmax-webhook`. Ele só registra eventos, depois de reconfirmar o pedido na API (a Appmax não assina os webhooks).

## Pendências conhecidas
- Medidas e peso das embalagens estão como estimativa (`MELHORENVIO_*`). Ajuste com os valores reais, senão o frete sai errado.
- Os status exatos de pedido da Appmax não estão todos na documentação; confirme em sandbox o texto de "aprovado" (`isPaid` em `appmax.server.ts`).
- Não há banco de pedidos neste projeto: os pedidos ficam no painel da Appmax. Compra do Melhor Envio (etiqueta) não é automática.
- "Até 6x sem juros" precisa estar configurado na própria Appmax; o site apenas envia o número de parcelas.
