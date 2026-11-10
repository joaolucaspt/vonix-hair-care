import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runReadiness(overrides: Record<string, string> = {}) {
  // Isolated synthetic environment: never expose the operator's real secrets.
  const env: Record<string, string> = {
    AFFILIATE_RECRUITMENT_OPEN: "true",
    AFFILIATE_GOVERNANCE_MIGRATED: "true",
    AFFILIATE_PRIVACY_POLICY_APPROVED: "true",
    AFFILIATE_PROVIDER_VERIFIED: "true",
    AFFILIATE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    AFFILIATE_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    AFFILIATE_SUPABASE_SERVICE_ROLE_KEY: "synthetic-only-credential-1234",
    AFFILIATE_TRAFFIC_PEPPER: "synthetic-only-pepper-32-chars-minimum",
    AFFILIATE_QUESTIONNAIRE_KEY: "0123456789abcdef".repeat(4),
    AFFILIATE_TRUSTED_IP_HEADER: "cf-connecting-ip",
    AFFILIATE_ADMIN_PASSWORD: "synthetic-test-password",
    AFFILIATE_ADMIN_SESSION_SECRET: "synthetic-test-session-key-32-characters",
    AFFILIATE_ADMIN_TOTP_SECRET: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    ...overrides,
  };
  const result = spawnSync(process.execPath, ["scripts/check-affiliate-readiness.mjs", "--json"], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
  expect(result.stderr).toBe("");
  const output = JSON.parse(result.stdout) as {
    canOpenFromConfiguration: boolean;
    missing: string[];
    optionalNotificationsMissing: string[];
  };
  if (env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"])
    expect(result.stdout).not.toContain(env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"]);
  expect(result.stdout).not.toContain(env["AFFILIATE_ADMIN_PASSWORD"]);
  return { output, status: result.status };
}

describe("Checklist do cadastro sem serviços de comissão", () => {
  it("aceita cadastro configurado sem Resend e worker, sem habilitar envio de e-mails", () => {
    const { output, status } = runReadiness();
    expect(status).toBe(0);
    expect(output.canOpenFromConfiguration).toBe(true);
    expect(output.optionalNotificationsMissing).toEqual(
      expect.arrayContaining(["resend", "resend_sender", "worker_secret"]),
    );
    expect(output.missing).toEqual([]);
  });

  it("não considera as credenciais do checkout suficientes para receber candidaturas", () => {
    const { output, status } = runReadiness({
      AFFILIATE_SUPABASE_URL: "",
      AFFILIATE_SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_URL: "https://checkout.example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "store-only-service-role-key",
    });
    expect(status).toBe(2);
    expect(output.canOpenFromConfiguration).toBe(false);
    expect(output.missing).toContain("database_pair");
  });

  it("sinaliza ligação incorreta quando o Supabase do cadastro é fixado", () => {
    const expected = "jewbzrbbvxyqmxqbrwrq";
    const wrong = runReadiness({ AFFILIATE_SUPABASE_PROJECT_REF: expected });
    expect(wrong.status).toBe(2);
    expect(wrong.output.missing).toContain("database_pair");
    const correct = runReadiness({
      AFFILIATE_SUPABASE_PROJECT_REF: expected,
      AFFILIATE_SUPABASE_URL: "https://jewbzrbbvxyqmxqbrwrq.supabase.co",
    });
    expect(correct.status).toBe(0);
    expect(correct.output.canOpenFromConfiguration).toBe(true);
  });

  it("nunca aprova a mesma origem usada pelo checkout", () => {
    const result = runReadiness({
      SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    });
    expect(result.status).toBe(2);
    expect(result.output.missing).toContain("database_pair");
  });

  it("bloqueia credencial compartilhada com o checkout, mesmo em URLs diferentes", () => {
    const result = runReadiness({
      SUPABASE_URL: "https://checkout.example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-only-credential-1234",
    });
    expect(result.status).toBe(2);
    expect(result.output.missing).toContain("database_pair");
  });

  it("rejeita chave base64url não canônica embora tenha 43 caracteres válidos", () => {
    const base64url = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const index = alphabet.indexOf(base64url.at(-1)!);
    expect(index % 4).toBe(0);
    const nonCanonical = base64url.slice(0, -1) + alphabet[index + 1];
    expect(nonCanonical).toHaveLength(43);
    const result = runReadiness({ AFFILIATE_QUESTIONNAIRE_KEY: nonCanonical });
    expect(result.status).toBe(2);
    expect(result.output.canOpenFromConfiguration).toBe(false);
    expect(result.output.missing).toContain("encryption_key");
  });

  it("mantém bloqueios de proteção de dados, migrações e HTTPS", () => {
    for (const overrides of [
      { AFFILIATE_PRIVACY_POLICY_APPROVED: "false" },
      { AFFILIATE_GOVERNANCE_MIGRATED: "false" },
      { AFFILIATE_SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co" },
      { AFFILIATE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co/private" },
      { AFFILIATE_QUESTIONNAIRE_KEY: "short" },
      { AFFILIATE_TRUSTED_IP_HEADER: "unsafe" },
    ]) {
      const { output, status } = runReadiness(overrides);
      expect(status).toBe(2);
      expect(output.canOpenFromConfiguration).toBe(false);
      expect(output.missing.length).toBeGreaterThan(0);
    }
  });
});
