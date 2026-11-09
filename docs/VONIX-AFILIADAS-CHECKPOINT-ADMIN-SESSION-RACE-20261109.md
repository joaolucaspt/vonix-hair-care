# Vonix Hair — painel de inscrições: sessão e prévia de retenção
Data: 09/11/2026 | Base: main após PR #40 (d5572d74)

## Escopo isolado
- Aplicativo: Vonix Haircare Showcase, Lovable project 203d2f84-1058-4ca4-acc3-41a4a5d4e2b5.
- Somente candidaturas, triagem administrativa e prévia LGPD, sem métricas de vendas, cupons operacionais, comissões, checkout ou Expedição Fácil.
- Não modificar segredos, banco de checkout, inscrições reais, flags de lançamento, e-mails ou publicação.

## Correções de segurança e experiência
1. Um retorno explícito "Acesso negado. Faça login novamente." agora invalida a sessão na interface, zera imediatamente os registros, e-mails e buscas pessoais e volta à autenticação — independentemente de o erro ter vindo da listagem, preparação, prévia LGPD, aprovação/recusa ou exclusão.
2. Ao recuperar o foco da aba ou torná-la visível, o painel verifica se a sessão HttpOnly continua válida. Se expirou, oculta dados privados sem esperar por outra tentativa de ação. Falhas transitórias da rede não são confundidas com expiração.
3. O cálculo de retenção LGPD invalida consultas antigas após alteração do prazo; uma resposta tardia, inclusive erro, não sobrescreve a consulta mais recente. Os critérios de dias ficam registrados junto aos contadores agregados exibidos.
4. A verificação de preparação impede múltiplas consultas sobrepostas e descarta respostas que chegam depois do logout.
5. Os testes são inteiramente sintéticos (sem enviar dados ou acessar Supabase).

## Verificações
- Testes de regressão com respostas de rede fora de ordem e sessões expiradas, inclusive logout durante consulta.
- TypeScript, ESLint, build e suíte completa executados na worktree isolada antes do PR.
- Navegador local sem credenciais: apenas tela de autenticação, nenhuma candidatura real.
- Não confundir teste de frontend com autorização para abrir inscrições.

## Pendências operacionais preservadas
- Credenciais de servidor Lovable para Supabase dedicado jewbzrbbvxyqmxqbrwrq ainda não confirmadas.
- AFFILIATE_RECRUITMENT_OPEN deve permanecer desabilitado até homologação completa de infraestrutura, backup, proxy confiável, privacidade LGPD, MFA e configuração segura do provedor.
