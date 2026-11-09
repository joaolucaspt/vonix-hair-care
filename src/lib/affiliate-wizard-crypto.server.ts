import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env.server";
import { affiliateWizardSchema, type ValidatedAffiliateWizard } from "./affiliate-wizard";

function encryptionKey(): Buffer | null {
  const supplied = env("AFFILIATE_QUESTIONNAIRE_KEY");
  if (!supplied) return null;
  try {
    const key = /^[a-f0-9]{64}$/i.test(supplied)
      ? Buffer.from(supplied, "hex")
      : Buffer.from(supplied, "base64url");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export const affiliateQuestionnaireEncryptionReady = () => encryptionKey() !== null;

/** Stores personal documents and mailing address exclusively as authenticated ciphertext. */
export function encryptAffiliateWizard(wizard: ValidatedAffiliateWizard): string {
  const key = encryptionKey();
  if (!key) throw new Error("Criptografia do questionário não configurada.");
  const { emailConfirmation: _confirmation, termsAccepted: _terms, ...answers } = wizard;
  // A crafted submission can include stale values for fields hidden by
  // conditional questions. Do not persist data that is no longer applicable.
  const minimizedAnswers = {
    ...answers,
    otherNiche: answers.niche === "Outro" ? answers.otherNiche : "",
    municipalNumber: answers.municipalRegistration === "sim" ? answers.municipalNumber : "",
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const raw = Buffer.from(
    JSON.stringify({
      version: 2,
      acceptedAt: new Date().toISOString(),
      answers: minimizedAnswers,
    }),
    "utf8",
  );
  const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
  return [
    "v2",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export type AffiliateWizardSummary = {
  niche: string;
  otherNiche: string | null;
  instagramFollowers: string | null;
  tiktokFollowers: string;
  municipalRegistration: string;
  dependents: string;
  preferredLine: string;
  couponSuggestion: string;
};

/**
 * Deliberately never exposes CPF, CNPJ, birth date, telephone, or address to the
 * regular candidate listing. This is a review summary, not an identity-verification API.
 */
export function affiliateWizardSummary(
  ciphertext: string | null | undefined,
): AffiliateWizardSummary | null {
  if (!ciphertext) return null;
  const key = encryptionKey();
  if (!key) return null;
  try {
    const [version, iv64, tag64, encrypted64] = ciphertext.split(".");
    if (version !== "v2" || !iv64 || !tag64 || !encrypted64) return null;
    const iv = Buffer.from(iv64, "base64url");
    const tag = Buffer.from(tag64, "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([
      decipher.update(Buffer.from(encrypted64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(json) as { version?: number; answers?: unknown };
    if (payload.version !== 2) return null;
    const data = affiliateWizardSchema.safeParse({
      ...(payload.answers as Record<string, unknown>),
      emailConfirmation: (payload.answers as Record<string, unknown>)?.["email"],
      termsAccepted: true,
    });
    if (!data.success) return null;
    const w = data.data;
    return {
      niche: w.niche,
      otherNiche: w.niche === "Outro" ? w.otherNiche || null : null,
      instagramFollowers: w.instagramFollowers || null,
      tiktokFollowers: w.tiktokFollowers,
      municipalRegistration: w.municipalRegistration,
      dependents: w.dependents,
      preferredLine: w.preferredLine,
      couponSuggestion: w.couponSuggestion,
    };
  } catch {
    return null;
  }
}
