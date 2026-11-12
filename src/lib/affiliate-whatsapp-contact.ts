/**
 * A manual contact convenience, never an automatic message or notification.
 * The phone remains in encrypted applicant data until the authorized admin
 * explicitly requests a confidential detail. Never send names or receipt
 * tokens in the outbound URL.
 */
const PRIVATE_MESSAGE =
  "Olá! Somos da equipe Vonix Hair. Estamos entrando em contato sobre sua inscrição no programa de afiliadas. Podemos conversar por aqui?";

export function affiliateWhatsAppContactUrl(phone: string | null | undefined): string | null {
  if (!phone || phone.length > 24 || !/^[+().\d -]+$/.test(phone)) return null;
  const rawDigits = phone.replace(/\D/g, "");
  const national =
    rawDigits.startsWith("55") && (rawDigits.length === 12 || rawDigits.length === 13)
      ? rawDigits.slice(2)
      : rawDigits;
  // Match the already deployed Brazilian applicant phone schema exactly:
  // two-digit DDD, then local landline or nine-digit mobile.
  if (!/^(?:[1-9]\d[2-5]\d{7}|[1-9]\d9\d{8})$/.test(national)) return null;
  return "https://wa.me/55" + national + "?text=" + encodeURIComponent(PRIVATE_MESSAGE);
}
