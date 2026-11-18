import { randomBytes } from "node:crypto";
import { z } from "zod";
import { affiliateDatabaseConfig } from "./affiliate-database.server";
import { affiliateActivatedOwnerStillAuthorized } from "./affiliate-owner-activation.server";
import { consumeAffiliateRateLimit } from "./affiliate-throttle.server";

/** Temporary credentials are generated only for the three pre-invited owners.
 * The authenticated owner receives the result once, via a no-store response.
 * Existing users are updated in Auth Admin; no new Auth identities are created.
 */
const target = z.enum([
  "isabela.cpcontato@gmail.com",
  "giovana.souza1.r@gmail.com",
  "lucassiqueirahotmail22@gmail.com",
]);
const user = z.object({ id: z.string().uuid(), email: z.string().email() });
const list = z.object({ users: z.array(user).max(100) });
const denied = {
  ok: false as const,
  reason: "Não foi possível provisionar. Confira a sessão e o estado da conta.",
};

export async function provisionOwnerTemporaryPassword(rawEmail: string) {
  const parsed = target.safeParse(rawEmail?.trim().toLowerCase());
  const db = affiliateDatabaseConfig();
  if (!parsed.success || !db || !(await affiliateActivatedOwnerStillAuthorized())) return denied;
  if (!(await consumeAffiliateRateLimit("admin")))
    return { ok: false as const, reason: "Limite de tentativas atingido. Aguarde." };
  const email = parsed.data;
  try {
    const claim = await fetch(
      db.url + "/rest/v1/rpc/vonix_affiliate_claim_owner_temporary_provision",
      {
        method: "POST",
        headers: db.headers,
        body: JSON.stringify({ p_email: email }),
        redirect: "manual",
        signal: AbortSignal.timeout(7000),
      },
    );
    if (!claim.ok || (await claim.json()) !== true) return denied;
    const request = await fetch(db.url + "/auth/v1/admin/users?page=1&per_page=100", {
      method: "GET",
      headers: db.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(8500),
    });
    if (!request.ok) return denied;
    const parsedUsers = list.safeParse(await request.json());
    if (!parsedUsers.success) return denied;
    const members = parsedUsers.data.users.filter((item) => item.email.toLowerCase() === email);
    if (members.length !== 1) return denied;
    const member = members[0]!;
    const temporaryPassword = randomBytes(24).toString("base64url");
    const updated = await fetch(db.url + "/auth/v1/admin/users/" + encodeURIComponent(member.id), {
      method: "PUT",
      headers: db.headers,
      body: JSON.stringify({ password: temporaryPassword, email_confirm: true }),
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
    });
    if (!updated.ok) return denied;
    const completed = await fetch(
      db.url + "/rest/v1/rpc/vonix_affiliate_complete_owner_temporary_provision",
      {
        method: "POST",
        headers: db.headers,
        body: JSON.stringify({ p_email: email, p_user_id: member.id }),
        redirect: "manual",
        signal: AbortSignal.timeout(7000),
      },
    );
    if (!completed.ok || (await completed.json()) !== true) return denied;
    return { ok: true as const, email, temporaryPassword };
  } catch {
    return denied;
  }
}
