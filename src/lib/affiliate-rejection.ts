import { z } from "zod";
/** Standardized, candidate-safe moderation reasons. No free-text PII. */
export const affiliateRejectionReasons = [
  {
    value: "seguidores_insuficientes",
    label: "Poucos seguidores no Instagram",
    guidance:
      "Seu perfil ainda não atende à quantidade de seguidores considerada nesta seleção. Você poderá se candidatar novamente quando seu perfil crescer.",
  },
  {
    value: "perfil_privado",
    label: "Perfil privado ou indisponível",
    guidance:
      "Não foi possível avaliar o perfil informado. Confira se o perfil está acessível antes de uma nova inscrição.",
  },
  {
    value: "conteudo_incompativel",
    label: "Conteúdo fora do perfil da campanha",
    guidance:
      "O conteúdo apresentado ainda não está alinhado com esta seleção. Você poderá se candidatar novamente futuramente.",
  },
  {
    value: "engajamento_insuficiente",
    label: "Engajamento insuficiente",
    guidance:
      "As interações observadas ainda não atendem aos critérios desta seleção. Você poderá tentar novamente após desenvolver seu perfil.",
  },
  {
    value: "dados_incompletos",
    label: "Dados insuficientes para avaliação",
    guidance:
      "Algumas informações não permitiram concluir a análise. Revise seu cadastro ao se candidatar novamente.",
  },
  {
    value: "outros_criterios",
    label: "Outros critérios de seleção",
    guidance:
      "Seu perfil não foi selecionado nesta etapa. Você poderá tentar novamente em uma próxima oportunidade.",
  },
] as const;
export const affiliateRejectionReasonSchema = z.enum([
  "seguidores_insuficientes",
  "perfil_privado",
  "conteudo_incompativel",
  "engajamento_insuficiente",
  "dados_incompletos",
  "outros_criterios",
]);
export type AffiliateRejectionReason = z.infer<typeof affiliateRejectionReasonSchema>;
export function affiliateRejectionLabel(value: string | null | undefined): string {
  return (
    affiliateRejectionReasons.find((reason) => reason.value === value)?.label ??
    "Motivo não informado em candidatura anterior"
  );
}
export function affiliateRejectionGuidance(value: string | null | undefined): string {
  return (
    affiliateRejectionReasons.find((reason) => reason.value === value)?.guidance ??
    "A candidatura não foi selecionada. Você poderá enviar uma nova inscrição futuramente."
  );
}
