import type { AffiliateStatus } from "./affiliate-application";
import {
  affiliateRejectionGuidance,
  affiliateRejectionLabel,
  type AffiliateRejectionReason,
} from "./affiliate-rejection";

/** Decision notifications are for historical, verified-email applications.
 * New phone-only candidates follow their result using the private status code.
 * A triage approval is not a promise of a contract, commission or products.
 */
export function affiliateDecisionEmail(
  decision: Exclude<AffiliateStatus, "pendente">,
  reason: AffiliateRejectionReason | null = null,
): { subject: string; text: string } {
  if (decision === "aprovada") {
    return {
      subject: "Candidatura aprovada na etapa de seleção | Vonix Hair",
      text: [
        "Olá!",
        "",
        "Sua candidatura foi aprovada nesta etapa de seleção de afiliadas da Vonix Hair.",
        "",
        "Nossa equipe poderá entrar em contato para conversar sobre os próximos passos e apresentar as condições de uma eventual parceria.",
        "",
        "Esta aprovação de triagem não representa contratação e não garante envio de produtos, cupom, pagamento ou comissão. Qualquer condição comercial deverá ser apresentada e aceita separadamente.",
        "",
        "Acompanhe as orientações pelos canais oficiais da Vonix Hair.",
        "",
        "Equipe Vonix Hair",
      ].join("\n"),
    };
  }
  return {
    subject: "Resultado da sua inscrição | Vonix Hair",
    text: [
      "Olá!",
      "",
      "Agradecemos seu interesse no programa de afiliadas Vonix Hair.",
      "Sua candidatura não foi selecionada nesta etapa.",
      "",
      ...(reason
        ? [
            "Motivo da avaliação: " + affiliateRejectionLabel(reason),
            affiliateRejectionGuidance(reason),
            "",
          ]
        : []),
      "Você poderá se candidatar novamente futuramente, inclusive com o mesmo Instagram após uma recusa.",
      "",
      "Se você se cadastrou usando e-mail, pode acompanhar sua candidatura pelo portal oficial:",
      "https://vonixhair.com/acompanhar-inscricao",
      "",
      "Equipe Vonix Hair",
    ].join("\n"),
  };
}
