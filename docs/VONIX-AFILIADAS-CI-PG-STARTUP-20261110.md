# Vonix Afiliadas — estabilização do PostgreSQL descartável no CI

Data: 10/11/2026 · Somente workflow de testes do sistema de inscrição de afiliadas.

## Ocorrência observada

O PR #62 passou nos dois jobs do GitHub. Após o merge, o run da `main` [#42838879632](https://github.com/lucassilva1175/vonix-hair-care/actions/runs/42838879632) apresentou falha no job `Isolated PostgreSQL RLS, migration and concurrency` antes de executar as migrações.

No log: o contêiner `postgres:16` retornou `pg_isready: accepting connections`, mas o primeiro `psql -d vonix_affiliates_qa` falhou com `FATAL: database "vonix_affiliates_qa" does not exist`.

**Causa:** o PostgreSQL oficial inicializa primeiro um servidor temporário para criar o banco solicitado em `POSTGRES_DB`. O antigo `pg_isready` detectava esse servidor como pronto antes da criação do banco. Não é falha de RLS, aplicação, criptografia ou migração de produção.

## Correção no workflow

- Mantido o contêiner **descartável e sem rede**, e credenciais sintéticas do QA; nenhuma chave ou banco de produção é acessado pelo CI.
- Substituída a espera por `pg_isready` por duas provas em conjunto: conclusão registrada do processo de inicialização do Postgres **e** sucesso de consulta SQL `SELECT 1` no banco `vonix_affiliates_qa`.
- Limite de 45 tentativas com intervalo de 1 segundo. Se a inicialização não concluir, o job falha com diagnóstico claro do próprio contêiner, em vez de executar migrações prematuramente.
- O restante dos testes de RLS, concorrência e segurança permanece inalterado.

## Validação exigida

A alteração requer dois jobs do GitHub verdes no PR **e no merge de `main`**. Um PR verde não substitui a prova do run da `main` após publicação.

O formulário público da Vonix continua deliberadamente fechado enquanto as credenciais privadas da hospedagem, SMTP, autenticação administrativa, controles LGPD e envio completo de uma candidatura não estiverem homologados.
