import type { AffiliateStatus } from "./affiliate-application";

export function affiliateDecisionEmail(decision: Exclude<AffiliateStatus, "pendente">): {
  subject: string;
  text: string;
} {
  if (decision === "aprovada") {
    return {
      subject: "Parabéns! Você foi aprovada na Vonix Hair!",
      text: [
        "Olá!",
        "",
        "Temos uma ótima notícia: sua inscrição foi aprovada e você foi selecionada para fazer parte do programa de afiliados Vonix Hair!",
        "",
        "Estamos muito felizes em ter você conosco.",
        "",
        "Para dar continuidade ao processo, você deverá seguir as orientações e regras do nosso programa, apresentadas durante a etapa de triagem.",
        "",
        "Em breve, você receberá as próximas instruções para começar a divulgar nossos produtos e ganhar comissões pelas suas vendas.",
        "",
        "Seja muito bem-vinda à Vonix Hair!",
      ].join("\n"),
    };
  }
  return {
    subject: "Resultado da sua inscrição | Vonix Hair",
    text: [
      "Olá!",
      "",
      "Agradecemos muito pelo seu interesse em fazer parte do programa de afiliados Vonix Hair.",
      "",
      "Neste momento, infelizmente, não foi possível aprovar sua inscrição.",
      "",
      "Mas não desanime! Continue acompanhando nossas redes sociais para ficar por dentro das próximas oportunidades de participação.",
      "",
      "Agradecemos por considerar fazer parte da nossa marca!",
      "",
      "Atenciosamente,",
      "Equipe Vonix Hair.",
    ].join("\n"),
  };
}
