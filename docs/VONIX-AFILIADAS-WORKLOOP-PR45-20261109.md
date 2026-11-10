# Vonix Afiliadas — continuação via Workloop (pós-PR44)

Data: 09/11/2026. Workloop: `3586259e-7b7e-4180-9dd4-68b82db05b24` · Run `e053cfd1-51c8-4739-9aef-aacc02bf07b4`.

## Projeto único
- Vonix Haircare Showcase — inscrição de cinco etapas e seleção de candidaturas. Repositório `lucassilva1175/vonix-hair-care`, Lovable project `203d2f84-1058-4ca4-acc3-41a4a5d4e2b5`.
- Worktree `C:\Users\JL\code\vonix-affiliate-workloop-next-20261109` na branch `feat/vonix-affiliate-premium-workloop-20261109`.
- Base `4d77dc25133332e3dc7fbfbe26c2c0924cfc50e9` (PR #44).
- NÃO alterar checkout/e-commerce operacional, expedição, aplicativo independente de métricas, vendas, comissões ou cupons operacionais; não ler dados de candidatas, banco real, credenciais ou arquivos .env.

## Falhas diagnosticadas e corrigidas
1. **Perda de rascunho em navegação interna:** sair de uma prévia ou iniciar o formulário real descartava silenciosamente os dados digitados, apesar do aviso `beforeunload`. A página passa a solicitar confirmação de descarte (com opção **Continuar preenchendo**). O componente informa **apenas um booleano** de existência de rascunho, sem transferir PII ao componente pai.
2. **Validação insuficiente de telefone/CPF/CEP:** CPF e CEP eram validados apenas pela quantidade de dígitos, e o telefone também, aceitando lixo arbitrário e dezenas de milhares de caracteres com dígitos válidos embutidos. O schema agora limita tamanho e formato antes de aceitar campos pessoais.
3. **Máscara de CPF quebrada:** a entrada de `52998224725` no formulário gerava `529.982.24725`, formato incorreto. A máscara foi refeita para `529.982.247-25` e a validação estrita aceita tanto os onze dígitos puros quanto a máscara legítima.
4. **Leitor de tela e aceite:** quando o aceite é obrigatório e está desmarcado, o campo possui `aria-invalid` e `aria-describedby` para associar o texto de erro ao controle, permitindo detectar e corrigir o problema.

## Evidências
- Testes sintéticos foram adicionados **antes** das correções: saídas com rascunho sem confirmação e formatos maliciosos eram aceitos ou descartados sem proteção; 3 testes falharam no baseline.
- Após correção, testes de formulário validam descarte/cancelamento, reinício seguro, visibilidade dos dados somente no wizard, CPF mascarado corretamente, aceite acessível e rejeição de payloads superdimensionados.
- Verificação completa: `npm test`, `npx tsc --noEmit`, ESLint, `npm run build`, diff-check e navegador local em modo simulação. Confrontar resultados do CI remoto antes de aceitar merge.
- Não enviar candidaturas, e-mails, nem habilitar a abertura de inscrições; não acessar chave real do banco.

## Bloqueios operacionais preservados
- A vinculação efetiva e os segredos no servidor Lovable para o Supabase dedicado ref `jewbzrbbvxyqmxqbrwrq` ainda não estão comprovados.
- Governança LGPD, configuração segura do proxy, backup/restauração e MFA em ambiente de homologação não estão aprovados.
- `AFFILIATE_RECRUITMENT_OPEN` deve permanecer ausente/desligado. Um PR verde não significa lançamento.
