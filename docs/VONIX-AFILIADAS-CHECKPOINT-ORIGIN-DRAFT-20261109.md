# Vonix Hair — proteção de origem e descarte de rascunho de afiliadas
Data: 09/11/2026 | Continuidade após PR #39 (merge d2e7ba1d)

## Escopo isolado
- Aplicativo: Vonix Haircare Showcase, Lovable 203d2f84-1058-4ca4-acc3-41a4a5d4e2b5.
- Apenas candidaturas: nenhum checkout, pagamento, expedição, comissão, cupom operacional ou outro projeto.
- Alterações apenas em código de inscrições, testes e documentação; nenhuma candidatura ou envio real.

## Implementação
1. Envio público POST requer Origin da própria origem HTTPS (ou HTTP localhost para testes), antes do rate limit e do banco. Ausência de Origin ou outra origem é negada.
2. A validação compartilhada com o painel administrativo falha sem contexto da requisição.
3. Formulário de cinco etapas agora permite limpar dados com confirmação e opção de cancelar. Apaga nome, documento, telefone, endereço, perfis, consentimento e demais campos em memória; não grava rascunho em armazenamento do navegador.
4. Consultas pendentes de CEP são invalidadas após descarte para impedir restauração de endereço apagado.
5. A conexão do banco de inscrições rejeita chave de serviço idêntica à do checkout, além de exigir ref e URL próprios.

## Evidências
- Testes sintéticos cobrem origem maliciosa/ausente, bloqueio por quota, manutenção de cadastro fechado, confirmação e cancelamento de descarte e a corrida com resposta de CEP.
- Chrome headless local, viewport 390x844: rota /seja-afiliada HTTP 200, indica inscrições em preparação, permite prévia, limpar dados com confirmação e confirma limpeza. Nenhum erro JS, nenhum POST para host local; analytics de terceiros bloqueado no ensaio.
- Verificações de compilação/CI devem ser anexadas ao PR após execução.
- Nenhuma migração, envio, alteração de banco ou publicação foi executada.

## Estado
O Supabase dedicado é jewbzrbbvxyqmxqbrwrq, mas a conexão com segredos de servidor do Lovable não está comprovada. A flag AFFILIATE_RECRUITMENT_OPEN permanece desabilitada. Homologação operacional, privacidade LGPD, backup, proxy e MFA ainda necessários antes de receber pessoas reais.
