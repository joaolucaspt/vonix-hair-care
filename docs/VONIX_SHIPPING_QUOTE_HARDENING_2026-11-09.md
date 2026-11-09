# Vonix Hair — validação defensiva de frete e bloqueio de cotações inválidas

**Data:** 09/11/2026. **Escopo exclusivo:** `lucassilva1175/vonix-hair-care`, PR #26. **Base preservada:** `f949d2740f9c09c677286f83871ed0b00d8a396f`.

## Motivo

O adaptador do Melhor Envio convertia `price`, `custom_price` e prazos diretamente com `Number(...)` e não verificava valores monetários negativos, campos não numéricos, IDs repetidos ou pacotes inválidos. Em falhas do provedor, isso poderia criar uma opção de entrega enganosa ou preço incorreto.

## Implementação

- `src/lib/melhorenvio.server.ts`: `normalizeShippingQuotes` filtra rigorosamente cotações inválidas antes de exibi-las: ID inteiro seguro e positivo, preço finito não negativo, prazo inteiro de 0 a 365 dias, descrição presente, transportadora permitida; respostas com erro ou duplicadas não produzem linhas inseguras. Em duplicatas, mantém a cotação válida mais barata e, em empate, a mais rápida.
- Dimensões ambientais da embalagem: largura, altura e comprimento exigem valores finitos entre 1 e 200 cm; peso entre 0,01 e 100 kg. Entradas inválidas interrompem a cotação **antes** da chamada externa. CEPs devem ter exatamente oito dígitos, com hífen opcional.
- Itens de envio: recusa produtos sem SKU, quantidade inteira positiva e preço unitário finito e não negativo. `insurance_value` é arredondado a centavos. A consulta possui timeout de oito segundos e não registra o corpo de erro do provedor, que pode conter informações operacionais.
- `src/lib/checkout.functions.ts`: defesa adicional impede que cotações com preço, ID ou prazo inválidos apareçam no checkout ou sejam selecionadas para criar pedido na Appmax, mesmo se um adaptador futuro regredir.
- `src/routes/checkout.tsx`: a mensagem de cotação vazia não afirma sem comprovação que nenhuma transportadora atende ao CEP; orienta conferir o CEP ou contatar o suporte. O botão de Pix permanece indisponível sem uma entrega válida.
- `src/test/melhorenvio-safety.test.ts` e outros testes: respostas inválidas, negativas, duplicadas, vazias, erros de configuração, ausência de vazamento de detalhes do provedor e proteção de cotação/preço no servidor e no navegador.

## Limitações essenciais

1. **Pesos e dimensões reais por SKU continuam pendentes.** Os valores padronizados no sistema (16×12×22 cm e 0,6 kg por unidade, salvo override) são **suposições**, não medidas certificadas. A equipe precisa cadastrar as dimensões reais das embalagens e verificar o efeito dos kits e pedidos com vários itens.
2. Os testes automatizados usam dados simulados do Melhor Envio. **Nenhuma cotação autenticada de produção**, etiqueta, compra ou movimentação financeira foi executada.
3. Outros bloqueios P0 continuam: Appmax em sandbox, migrações no Supabase staging, Bling com dados fictícios, controle de estoque, privacidade/LGPD e validação de infraestrutura.
4. Os testes de build/TypeScript/CI comprovam compilação e comportamento local, **não** garantem frete adequado para todos os CEPs, nem autorização para publicar o PR.

## Reversão e preservação

Backup anterior às alterações: `backup/vonix-pr26-before-shipping-quote-safety-20261109` no fork de revisão, apontando para `f949d27`. A `main` original não deve ser alterada automaticamente. Integrar somente mediante PR revisado após homologação operacional.

## Validação de saída

Os arquivos de teste, build e relatório do GitHub Actions devem ser registrados no histórico de revisão do PR #26. Nenhum token, CPF, pedido real, banco operacional, outro projeto ou deploy é necessário para esta implementação.
