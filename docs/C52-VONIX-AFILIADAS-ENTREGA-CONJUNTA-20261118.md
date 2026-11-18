# Vonix Afiliadas — C52 — entrega conjunta de credenciais provisórias

**Escopo:** somente o painel administrativo de candidaturas da Vonix Hair;
não alterar o e-commerce, pedidos, pagamentos ou checkout.

## Objetivo
Permitir que o proprietário previamente autenticado renove as três senhas
provisórias da equipe e copie as três credenciais numa única ação, sem que
a navegação entre abas descarte senhas ainda não transferidas.

## Fluxo
- Exige confirmação do proprietário sobre os três destinatários conhecidos.
- Aciona sequencialmente a função owner-only C51 da API oficial Supabase Auth,
  **sem criar novas identidades**.
- Mostra e-mail e senha provisória de cada destinatário em memória da aba.
- Copia todos os acessos em um único clique; limpa os valores após cópia.
- Limpa também os valores se a aba for ocultada ou a confirmação for retirada.
- Se uma chamada falhar, preserva temporariamente na tela os acessos gerados
  anteriormente para permitir cópia e recuperação individual dos demais.
- Toda nova senha revoga a senha provisória anterior e exige mudança no
  primeiro login, antes de liberar sessão privilegiada.
- Nunca faz commit, armazenamento persistente ou logging de senhas reais.

## Qualidade local
- 711/711 testes aprovados em 74 arquivos na execução completa.
- TypeScript `--noEmit`, ESLint dos arquivos alterados e build Next/TanStack aprovados.
- Dois testes antigos C41 de retomada de sessão ganharam espera explícita de
  microtarefa entre ocultar e reexibir aba, evitando flutuação do CI sob carga,
  sem remover afirmações de autorização.
- Novos testes de lote completo, falha parcial e limpeza em tab-hide aprovados.

## Operação
Após publicação e confirmação do novo bundle no site, acessar o painel do
proprietário, confirmar os destinatários e clicar
**Gerar e reunir as 3 senhas temporárias**. Antes de sair da aba, copiar todos
os acessos para um local privado controlado pelo proprietário. Verificar
no Supabase dedicado `jewbzrbbvxyqmxqbrwrq` os três e-mails, marcadores de
ativação e `must_rotate_password=true` até cada troca pessoal.

**Não incluir senhas nos recibos de QA, mensagens de console, capturas,
capturas de rede ou documentação.**
