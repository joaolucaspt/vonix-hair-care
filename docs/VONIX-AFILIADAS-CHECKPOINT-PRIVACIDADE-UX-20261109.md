# Vonix Hair — proteção do rascunho, formulário e sessão privada
Data: 09/11/2026 | Continuação a partir do PR #42 (merge d732ea09481ea9f88eff71f5f4af8b4127d10a2c)

## Isolamento do trabalho
- Projeto: Vonix Haircare Showcase, Lovable `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Worktree exclusiva: `C:\Users\JL\code\vonix-affiliate-ui-safety-20261109`.
- Somente inscrição, triagem e proteção de dados das candidatas. Não modificar checkout, vendas, comissões, métricas, cupons operacionais, gateways, expedição ou outros projetos.
- Nenhum cadastro real, credencial, mensagem, migracão, deploy ou ativação de inscrições.

## Melhorias implementadas
1. O link de Política de Privacidade no quinto passo abre em **nova aba** com `noopener noreferrer`, sem desmontar o questionário atual. O texto informa que não haverá perda do progresso.
2. O navegador recebe evento `beforeunload` enquanto existir rascunho não enviado; a implementação não armazena CPF, endereço, telefone, senhas ou rascunho em localStorage/sessionStorage. O suporte do aviso varia por navegador.
3. Campos condicionais (detalhamento do nicho `Outro` e inscrição municipal) são apagados em memória quando a escolha principal os torna inaplicáveis.
4. O servidor também exclui as respostas condicionais não aplicáveis **antes da criptografia AES-256-GCM**, inclusive se o cliente enviar valores ocultos indevidos. Mantida retrocompatibilidade de leitura dos questionários antigos.
5. Durante revalidação da sessão ao voltar para uma aba administrativa, o conteúdo privado fica oculto. Ao esconder a aba, os dados são mascarados da interface; no retorno, a sessão HttpOnly precisa ser revalidada.
6. Na falha de rede, o painel mantém os dados ocultos, oferece "Tentar verificar novamente" e evita confundir erro de conectividade com cookie expirado. Se o cookie estiver expirado, remove dados privados e volta ao login.
7. O login exige seis dígitos do autenticador antes de habilitar o botão de acesso; validação TOTP real continua no servidor.

## Evidências de homologação sem dados reais
- Testes de UI: rascunho ativo vs descartado, saída antes de enviar, privacidade em outra aba, limpeza de campos condicionais, bloqueio de PII em aba escondida/retomada, expiração de sessão, recuperação de falha de rede, prevenção de respostas atrasadas.
- Teste do backend: descriptografia da resposta cifrada usando apenas chave **sintética de teste**, confirmando que campos ocultos não foram armazenados.
- Playwright com Google Chrome headless: fluxo completo das 5 etapas em 390px e 1280px, abertura do documento de privacidade em popup local, permanência de nome/e-mail no cadastro, simulação sem submissão, OTP inicialmente bloqueado, 0 requisições de escrita, 0 erros JS.
- Para o painel autenticado, a evidência é de teste de componente sintético (sem senha real ou dados de candidatas). Chrome foi usado apenas para verificações sem login.
- Suíte npm test, TypeScript, ESLint, build e CI devem ser anexados na revisão da branch antes de aceitar o PR.

## Bloqueios operacionais que permanecem
- Supabase dedicado: `jewbzrbbvxyqmxqbrwrq`. Ainda não está comprovado que a chave privada e URL foram configuradas no servidor Lovable.
- `AFFILIATE_RECRUITMENT_OPEN` deve permanecer false/ausente até aprovação de privacidade LGPD, proxy confiável, backups/restauração, credenciais seguras e homologação de produção.
- Não inferir publicação do site apenas porque o Lovable reconheceu um commit GitHub.
