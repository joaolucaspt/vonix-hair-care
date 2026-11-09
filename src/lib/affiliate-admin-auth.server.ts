import {
  affiliateAdminSameOrigin,
  affiliateAdminSecondFactorValid,
  createAffiliateAdminSession,
} from "./affiliate-admin-session.server";
import { affiliateAdminAuthorized } from "./affiliate-applications.server";
import { affiliateRateLimitAllowed, consumeAffiliateRateLimit } from "./affiliate-throttle.server";

type AffiliateAdminLoginResult = { ok: true } | { ok: false; reason: string };

const UNAVAILABLE = "Acesso indisponível. Verifique as configurações e tente mais tarde.";
const INVALID = "Credenciais inválidas ou autenticação não configurada.";

/**
 * Check the durable IP lockout before verifying credentials. Only invalid credentials
 * consume the failure quota; a correct password + TOTP never increments it.
 * Already locked out addresses remain blocked even with valid credentials.
 */
export async function attemptAffiliateAdminLogin(
  password: string,
  otp: string,
): Promise<AffiliateAdminLoginResult> {
  if (!affiliateAdminSameOrigin()) return { ok: false, reason: UNAVAILABLE };

  try {
    if (!(await affiliateRateLimitAllowed("admin"))) {
      return { ok: false, reason: UNAVAILABLE };
    }
  } catch {
    return { ok: false, reason: UNAVAILABLE };
  }

  const passwordValid = affiliateAdminAuthorized(password);
  const totpValid = affiliateAdminSecondFactorValid(otp);
  if (!passwordValid || !totpValid) {
    // The denial itself is intentionally non-enumerating; record a failed attempt
    // even when the DB is unavailable, without telling the caller the exact factor.
    try {
      if (!(await consumeAffiliateRateLimit("admin"))) {
        return { ok: false, reason: UNAVAILABLE };
      }
    } catch {
      return { ok: false, reason: UNAVAILABLE };
    }
    return { ok: false, reason: INVALID };
  }

  if (!createAffiliateAdminSession()) return { ok: false, reason: UNAVAILABLE };
  return { ok: true };
}
