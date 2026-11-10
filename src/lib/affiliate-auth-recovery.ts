/** Map known Supabase Auth error fragments to actionable, non-sensitive recovery states.
 * Never reflect provider-supplied descriptions, emails, or tokens in the UI.
 */
export type AffiliateLinkRecoveryReason = "expired" | "failed" | null;

export function affiliateLinkRecoveryReason(href: string): AffiliateLinkRecoveryReason {
  try {
    const url = new URL(href);
    const fragment = url.hash.startsWith("#")
      ? new URLSearchParams(url.hash.slice(1))
      : new URLSearchParams();
    const code = (
      fragment.get("error_code") ??
      url.searchParams.get("error_code") ??
      ""
    ).toLowerCase();
    const error = (fragment.get("error") ?? url.searchParams.get("error") ?? "").toLowerCase();

    if (!code && !error) return null;
    if (code === "otp_expired" || code === "expired_token" || code === "invalid_token") {
      return "expired";
    }
    return "failed";
  } catch {
    return null;
  }
}

export function affiliateLinkRecoveryMessage(reason: Exclude<AffiliateLinkRecoveryReason, null>) {
  if (reason === "expired") {
    return "Este link de acesso expirou ou já foi utilizado. Solicite um novo acesso abaixo. Se a nova mensagem trouxer um código, digite-o nesta página; se trouxer um link, use apenas o mais recente.";
  }
  return "Não foi possível confirmar o link de acesso. Solicite novo acesso abaixo e use o código numérico ou o link mais recente que chegar por e-mail. Links antigos podem deixar de funcionar após um novo pedido.";
}
