# C53 — Landing de afiliadas Vonix Hair

## Resultado para revisão

Implementação somente na prévia do projeto original. Não publicada. A revisão global permanece bloqueada pelos testes e lint fora do escopo descritos abaixo; não considerar o repositório integralmente aprovado.

Base anterior às mudanças: `8a479f6de73fd5e46a466cf2be4ed28ec37f9868`. A plataforma Lovable registra commits automaticamente; último commit de implementação verificado antes deste documento: `5420261c8609e3925b83a8805a0c6ab1bc241d31`. Nenhum comando de commit, push, deploy ou alteração de histórico foi executado.

## Arquivos do lote

- `src/components/affiliate-landing.tsx`
- `src/components/affiliate-shell.tsx`
- `src/components/affiliate-creator-opportunity.tsx` (novo)
- `src/routes/seja-afiliada.tsx`
- `src/test/affiliate-landing-v2.test.tsx`
- `src/test/affiliate-c53.test.tsx` (novo)
- Este documento.

O diff acumulado em relação à base foi conferido: nenhum arquivo do e-commerce, formulário, status, autenticação, integração, banco, secrets ou dependências foi alterado pelo lote. O `bun.lock` já estava modificado no início; não foi editado ou instalado nada nesta execução. Não foram alterados planos, roadmap ou AGENTS.md para respeitar a lista exclusiva de arquivos autorizados.

## Changelog

- Apresentação editorial com marca, inscrição gratuita, seleção individual, CTA visível no primeiro viewport móvel, condições claras e produtos oficiais.
- Paleta burgundy/champagne por tokens delimitados ao shell de afiliadas, sem alterar CSS global nem o tema da loja. Apenas Inter e Playfair Display.
- Navegação com ganhos, consulta de status e dúvidas; sem rodapé fixo intrusivo.
- Bloco comercial mantém 8%, bônus anunciado de R$ 500 a cada R$ 10.000 e possibilidade de supervisora. Texto torna explícitas aprovação, venda confirmada/paga e elegibilidade, sem criar garantias.
- Simulador ilustrativo acessível: intervalo R$ 0–20.000, passo R$ 500, comissão, bônus condicional e soma separados. Cálculo em centavos, limites e NaN tratados. Não consulta elegibilidade, não calcula pagamentos operacionais, não persiste nem envia dados.
- Galeria “Uma marca para conhecer. Muitas histórias para criar” com três produtos reais e CTA. Preferência WebP por `picture/source`, JPG oficial somente como fallback. Todas as imagens efetivamente servidas nos testes de Chromium foram WebP locais e carregaram.
- Não foram incluídos os comentários fornecidos: adotada a alternativa autorizada de galeria sem opiniões, pois não houve verificação independente dos comentários nesta execução. Aviso explícito de que produtos não são depoimentos de afiliadas ou evidência de ganhos.
- Critérios, duas personas, ideias e três momentos preservados com hierarquia mais limpa. Formulário simplificado intacto: nome, telefone, endereço/CEP/número, Instagram/seguidores; TikTok opcional. Nenhuma lógica de gates ou envio foi alterada.
- Metadados próprios na rota pública com descrição condicional, `og:type` e `twitter:card`. Imagens relativas: não adicionados URLs sociais fictícios. Indexação privada intocada.

## Verificações

- Testes focados: **71 PASS / 0 FAIL**, cinco arquivos, incluindo formulário real protegido, navegação, status/reabertura e shell.
- Suíte completa final: **718 PASS / 4 FAIL**, **73 arquivos PASS / 2 FAIL**, total 722 testes.
- Falhas restantes: dois casos em `affiliate-invites.test.ts` e dois em `leads.test.tsx`. Os testes não isolam todos os caminhos de integração atualmente disponíveis: convite pode escolher a entrega personalizada e lead pode usar o aplicativo conectado quando webhook está ausente. Código e testes dessas áreas permanecem idênticos à base. Não corrigidos porque autenticação, integrações e cadastro estão explicitamente fora do escopo. Não houve execução de testes contra uma cópia anterior para estabelecer baseline independente.
- Validação automática Lovable após as correções: **build OK**, incluindo TypeScript, registrada em `/tmp/observability/build-errors.log` às 15:33:25 UTC. Não há script separado de TypeScript em package.json. Não foi executado build ou typecheck manual por restrição do ambiente.
- Lint dos seis arquivos TS/TSX do lote: **0 erros / 1 aviso** (Fast Refresh devido à função pura exportada junto aos componentes). Mantida no arquivo permitido para não criar módulo fora do escopo.
- `bun run lint` global não concluiu: encerrou por timeout mesmo com 600 segundos. Fallback `eslint src`: **1.325 erros / 14 avisos** no código fonte. Não foram aplicadas correções globais fora do escopo.
- Navegador real em **360, 390, 768 e 1440px**: `scrollWidth` igual à largura em todos; CTA principal 44px no móvel e 48px em tablet/desktop, visível no primeiro viewport; zero erros de página.
- Simulador real: R$ 10.000 + tecla seta direita → R$ 10.500, comissão R$ 840, bônus hipotético R$ 500, soma R$ 1.340. Limites 0/2.500/10.000/20.000/NaN cobertos automaticamente.
- Formulário em prévia exercitado sem envio de candidatura, sem pagamento e sem dados reais. Status pode executar suas próprias consultas existentes; não confundir chamadas de disponibilidade/telemetria com envio. Teste de componente confirma `submitSimpleAffiliateApplication` nunca chamado em prévia. Nenhuma candidatura foi submetida.
- Fontes/paleta isoladas: token primário da afiliada diferente do token global da loja, verificado após navegar à home sem alterar essa página.
- Evidências temporárias de screenshots e logs em `/tmp/browser/c53/` e `/tmp/c53-*`; não são arquivos do repositório e podem ser apagados quando o sandbox reiniciar.

## Arquitetura delimitada ao escopo

- Keep illustrative commission arithmetic inside the affiliate-only opportunity component; it must never be reused for settlement or eligibility decisions.
- Keep recruitment palette tokens scoped to AffiliateShell; the shared commerce design system must not inherit recruitment styling.
- Preserve AffiliateSimpleForm and availability gates as the sole intake path; presentation components never submit candidatures.

## Reversão e bloqueios

Reverter somente os sete arquivos deste lote à base citada por uma ação de revisão autorizada no Lovable, removendo os dois arquivos novos e este handoff quando apropriado. Não tocar backup independente, secrets, dados ou produção; não fazer reset/checkout de todo o repositório.

Próximo passo: revisão do diff pelo proprietário/Autonomous Workloop. Aprovação global exige uma tarefa separada autorizada para as quatro falhas de testes externas, lint global e eventual confirmação da configuração de ambiente dos testes. Não publicar nesta etapa.