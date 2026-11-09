import { env } from "./env.server";

/** Server-only durable storage for rotating Bling refresh tokens.
 * The SQL migration is required; never log refresh tokens or return them to browsers.
 */
async function rpc<T>(name: string, body: unknown): Promise<T> {
  const root = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!root || !key) throw new Error("Armazenamento seguro do Bling não configurado");
  const response = await fetch(`${root.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error(`Bling token storage HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function readBlingRefreshToken(): Promise<string> {
  const token = await rpc<string | null>("vonix_read_bling_refresh_token", {});
  if (token) return token;
  // One-time migration: persist the pre-existing secret instead of rotating in memory.
  const initial = env("BLING_REFRESH_TOKEN");
  if (!initial) throw new Error("Bling não autorizado");
  const stored = await rpc<boolean>("vonix_rotate_bling_refresh_token", {
    current_token: null,
    new_token: initial,
  });
  if (stored) return initial;
  const concurrent = await rpc<string | null>("vonix_read_bling_refresh_token", {});
  if (!concurrent) throw new Error("Não foi possível inicializar credencial Bling");
  return concurrent;
}

export async function rotateBlingRefreshToken(current: string | null, next: string): Promise<void> {
  if (!next || next.length < 20) throw new Error("Refresh token Bling inválido");
  const saved = await rpc<boolean>("vonix_rotate_bling_refresh_token", {
    current_token: current,
    new_token: next,
  });
  if (!saved)
    throw new Error("Token Bling foi renovado em outra instância; nova tentativa necessária");
}
