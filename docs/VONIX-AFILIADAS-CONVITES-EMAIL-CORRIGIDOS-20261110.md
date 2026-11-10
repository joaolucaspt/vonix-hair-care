# Vonix Hair Afiliadas — correção de convites por e-mail

Data: 10/11/2026 · Repositório exclusivo `lucassilva1175/vonix-hair-care` · Banco dedicado `jewbzrbbvxyqmxqbrwrq`.

## Defeito encontrado

`src/lib/affiliate-invites.server.ts` validava e-mails por uma expressão regular escrita com `\\s` dentro de uma classe, quando o correto seria usar `\s`. Por isso, o servidor **rejeitava o caractere literal s em endereços válidos** e podia **aceitar espaços**, deixando de tentar gerar o acesso de candidatas já cadastradas.

Isso afetava o fluxo que tenta enviar convite de autenticação **após** confirmação de armazenamento de uma inscrição, mesmo que a inscrição estivesse salva. A validação incorreta podia produzir uma mensagem genérica de que o convite não foi confirmado.

## Alteração

- Substituída a expressão manual por `z.string().email().max(180)` para usar o validador de e-mails da aplicação.
- O e-mail é validado antes da chamada à API Auth privada; o endereço aceito é convertido para minúsculas para o convite.
- Endereços inválidos não geram chamadas HTTP para a API Auth.
- Mantida a regra de segurança existente: **o convite só é tentado depois de um resultado de candidatura persistida ou duplicidade por e-mail comprovada**. A página pública não cria contas livremente.
- A falha de envio do convite continua independente da candidatura já salva: o sistema não declara um envio concluído se o serviço de e-mail falhar.

## Verificação

- Regressão: **315/315 testes em 37 arquivos**, incluindo 11 testes específicos do módulo de convites.
- Cobertura nova para e-mails válidos com “s”, normalização de maiúsculas/minúsculas, espaços no início ou fim, espaços internos, barras invertidas, quebras de linha e formatos malformados.
- TypeScript, ESLint e build de produção concluídos com `exit 0`.

## Operação real — ainda bloqueada

- Não foram realizados envios reais de convites ou de candidaturas; todos os testes são sintéticos.
- No último diagnóstico, `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY` não estava cadastrado na hospedagem, e o cadastro público permanecia em prévia.
- O convite depende do serviço SMTP e da lista de URLs autorizadas do Supabase Auth, além das credenciais administrativas, backup, LGPD e teste público de ponta a ponta.
- **Não ativar `AFFILIATE_RECRUITMENT_OPEN=true` sem comprovar inserção, leitura integral no admin e acompanhamento pelo usuário autenticado.**
- Não houve alteração no checkout, em preços, pagamentos, encomendas, comissões ou outros projetos.
