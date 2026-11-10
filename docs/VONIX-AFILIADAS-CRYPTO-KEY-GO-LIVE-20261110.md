# Vonix Afiliadas — chave do questionário, formato e operação

Data: 10/11/2026. Somente `lucassilva1175/vonix-hair-care`, sem tocar checkout ou sistemas de comissões.

## Proteção de respostas
- O formulário de cinco etapas armazena CPF, endereço e demais respostas no campo `questionnaire_encrypted`, usando AES-256-GCM e IV novo aleatório por candidatura.
- A configuração `AFFILIATE_QUESTIONNAIRE_KEY` aceita as duas formas anteriores, de 64 caracteres hexadecimais ou 43 base64url canônicos (32 bytes), preservando a capacidade de decifrar registros históricos.
- A partir deste ciclo, também aceita um segredo de **64 caracteres alfanuméricos gerado por CSPRNG no gerenciador de Secrets do Lovable**. A chave AES de 256 bits é derivada por SHA-256 com separador de domínio específico ao sistema Vonix. Um segredo arbitrário fraco de 64 caracteres seria inseguro — use somente gerador criptográfico.
- Não escreva, comite, exponha ou envie o segredo em chat, anúncios, frontend, URL ou respostas JSON. Nunca reutilize o segredo do checkout.
- **Backup independente obrigatório antes de captar pessoas reais.** A perda, substituição ou rotação não planejada deste segredo torna o conteúdo criptografado de candidaturas anteriores ilegível. Recuperação exige cópia segura do mesmo valor original ou migração criptográfica previamente testada.
- A configuração de chave sozinha não habilita inscrições. `AFFILIATE_RECRUITMENT_OPEN` deve permanecer `false` até validação de gravação/leitura real, SMTP, proteção de IP, credenciais administrativas e LGPD.

## Evidência local deste ciclo
- 306/306 testes aprovados em 37 arquivos, incluindo nova validação de segredo de 64 caracteres e rejeição de decifragem com chave trocada.
- TypeScript, lint dos arquivos alterados e build de produção executados.
- Banco Supabase dedicado confirmou fluxo transacional sintético pendente → aprovada → recusada, com rollback e zero registros residuais.
- Acesso Auth administrativo: dois convites aceitos (entrega ainda não confirmada), um rejeitado pelo limite 429 de e-mails. Nenhuma conta ativada.

## Bloqueios que não devem ser ocultados
- Credencial `AFFILIATE_SUPABASE_SERVICE_ROLE_KEY` deve ser definida pelo dono via interface segura do Lovable, vinculada somente ao projeto `jewbzrbbvxyqmxqbrwrq`. Não é fornecida pelo SDK público nem pelo banco da loja.
- Precisa confirmar Auth redirect allowlist, SMTP próprio e entrega real dos links/códigos.
- Para proteção proprietária do painel antigo, configurar senha administrativa forte e seed TOTP no ambiente seguro. A criação das três contas de revisão depende de verificação por e-mail, senha pessoal e ativação individual.
- Política LGPD, backups restauráveis, origem confiável do IP e governança devem ser aprovados.
