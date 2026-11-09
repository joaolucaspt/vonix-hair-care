#!/usr/bin/env node
/**
 * Safe, read-only checklist. Reads already-provided process environment variables,
 * not .env files. Never prints credentials, tokens, passwords or database endpoints.
 * It cannot verify actual bank migrations, provider domain ownership, or legal sign-off.
 */
const raw = process.env;
const present = (key, min = 1) => (raw[key] || "").length >= min;
const positive = (key) => raw[key] === "true";
const validUrl = (key) => {
  if (!present(key)) return false;
  try { return new URL(raw[key]).protocol === "https:"; } catch { return false; }
};
const hasDedicated = present("AFFILIATE_SUPABASE_URL") || present("AFFILIATE_SUPABASE_SERVICE_ROLE_KEY");
const db = hasDedicated
  ? validUrl("AFFILIATE_SUPABASE_URL") && present("AFFILIATE_SUPABASE_SERVICE_ROLE_KEY",16)
  : validUrl("SUPABASE_URL") && present("SUPABASE_SERVICE_ROLE_KEY",16);
const encryptionKey = (() => {
  const value = raw["AFFILIATE_QUESTIONNAIRE_KEY"] || "";
  if (/^[a-f0-9]{64}$/i.test(value)) return true;
  return /^[A-Za-z0-9_-]{43}$/.test(value);
})();
const checks = [
  {id:"database_pair",ok:db,kind:"configuration",description:"Credenciais de banco configuradas no servidor"},
  {id:"admin_password",ok:present("AFFILIATE_ADMIN_PASSWORD",16),kind:"configuration",description:"Senha administrativa"},
  {id:"session_secret",ok:present("AFFILIATE_ADMIN_SESSION_SECRET",32),kind:"configuration",description:"Segredo de sessão"},
  {id:"totp",ok:/^[A-Z2-7]{32,128}$/i.test(raw["AFFILIATE_ADMIN_TOTP_SECRET"] || ""),kind:"configuration",description:"TOTP de produção"},
  {id:"hmac_pepper",ok:present("AFFILIATE_TRAFFIC_PEPPER",32),kind:"configuration",description:"Proteção de limite de IP"},
  {id:"proxy_header",ok:["cf-connecting-ip","x-real-ip","x-forwarded-for"].includes(raw["AFFILIATE_TRUSTED_IP_HEADER"]),kind:"configuration",description:"Cabeçalho de proxy selecionado (deve ser verificado na borda)"},
  {id:"encryption_key",ok:encryptionKey,kind:"configuration",description:"Chave privada de criptografia AES-256-GCM"},
  {id:"resend",ok:present("RESEND_API_KEY",10),kind:"configuration",description:"Chave Resend"},
  {id:"resend_sender",ok:/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw["AFFILIATE_FROM_EMAIL"]||""),kind:"configuration",description:"Endereço remetente"},
  {id:"worker_secret",ok:present("AFFILIATE_WORKER_SECRET",24),kind:"configuration",description:"Segredo de worker"},
  {id:"migration_attestation",ok:positive("AFFILIATE_GOVERNANCE_MIGRATED"),kind:"operator_approval",description:"Migração SQL aplicada e auditada no banco correto"},
  {id:"privacy_attestation",ok:positive("AFFILIATE_PRIVACY_POLICY_APPROVED"),kind:"operator_approval",description:"Aviso de privacidade e política de retenção aprovados"},
  {id:"provider_attestation",ok:positive("AFFILIATE_PROVIDER_VERIFIED"),kind:"operator_approval",description:"Envio do provedor e proxy homologados"},
  {id:"launch_switch",ok:positive("AFFILIATE_RECRUITMENT_OPEN"),kind:"operator_approval",description:"Abertura pública explicitamente solicitada"},
];
const canOpen = checks.every(x=>x.ok);
const report = {
  canOpenFromConfiguration:canOpen,
  caveat:"Variáveis e atestações declaradas não comprovam banco, RLS, domínio, cron nem revisão jurídica. Homologar fora deste script.",
  missing:checks.filter(x=>!x.ok).map(x=>x.id),
  checks,
};
if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(report,null,2)+"\n");
else {
  process.stdout.write("Vonix afiliadas — checklist local, sem leitura de arquivos de segredos\n");
  for (const item of checks) process.stdout.write((item.ok?"OK  ":"PEND")+" "+item.id+" — "+item.description+"\n");
  process.stdout.write(canOpen?"Configuração declarada completa; homologação real ainda necessária.\n"
    :"Cadastro deve permanecer fechado; pendências acima.\n");
}
if(!canOpen) process.exitCode=2;
