/** A voluntary local backup for the unique, private applicant status receipt.
 * No network requests, third-party share intent, PII or analytics.
 */
const CODE = /^[A-Za-z0-9_-]{32}$/;

export function affiliatePrivateReceiptText(code: string, confirmed: boolean): string {
  if (!CODE.test(code)) return "";
  const status = confirmed ? "INSCRIÇÃO RECEBIDA" : "TENTATIVA AINDA NÃO CONFIRMADA";
  return [
    "VONIX HAIR — CÓDIGO PRIVADO DA CANDIDATURA",
    status,
    "",
    "Código privado: " + code,
    "Consulte sua candidatura: https://vonixhair.com/consultar-candidatura",
    "",
    confirmed
      ? "Guarde este arquivo para consultar o resultado. Não compartilhe seu código."
      : "Este código não comprova que sua candidatura foi salva. Consulte o portal antes de tentar novamente.",
    "Este arquivo contém um código privado de acesso. Guarde-o em local seguro e não encaminhe.",
    "",
  ].join("\n");
}

export function downloadAffiliatePrivateReceipt(code: string, confirmed: boolean): boolean {
  const content = affiliatePrivateReceiptText(code, confirmed);
  if (
    !content ||
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    typeof URL.createObjectURL !== "function"
  )
    return false;
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "vonixhair-codigo-candidatura.txt";
    link.rel = "noopener noreferrer";
    link.hidden = true;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
    // Browsers may not have finished initiating the download immediately.
    // The private Blob URL is always revoked after the brief handoff.
    const privateBlobUrl = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(privateBlobUrl), 30000);
    return true;
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return false;
  }
}
