import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { env } from "./env.server";
import type { ValidatedAffiliateWizard } from "./affiliate-wizard";

function encryptionKey(): Buffer | null {
  const supplied = env("AFFILIATE_QUESTIONNAIRE_KEY");
  if (/^[a-f0-9]{64}$/i.test(supplied)) return Buffer.from(supplied, "hex");
  // Lovable Secrets Manager can generate a 64-character cryptographically
  // random alphanumeric secret without exposing it to the application owner
  // or an AI chat. Deterministically derive the AES-256 key with a dedicated
  // domain separator. Existing hex and base64url keys keep their old meaning,
  // so previously stored ciphertext remains decryptable with its original key.
  // Production must preserve this original secret in a separate secure backup.
  if (/^[A-Za-z0-9]{64}$/.test(supplied)) {
    return createHash("sha256")
      .update("vonix-hair/affiliate/questionnaire-key/v1\u0000", "utf8")
      .update(supplied, "utf8")
      .digest();
  }
  // Node's base64 decoder silently ignores punctuation, padding and unused
  // trailing bits. Accept only the canonical 43-character representation to
  // avoid reporting a malformed, potentially miscopied data key as ready.
  if (!/^[A-Za-z0-9_-]{43}$/.test(supplied)) return null;
  try {
    const key = Buffer.from(supplied, "base64url");
    return key.length === 32 && key.toString("base64url") === supplied ? key : null;
  } catch {
    return null;
  }
}

export const affiliateQuestionnaireEncryptionReady = () => encryptionKey() !== null;

// A five-stage submission is bounded by field schemas. This is a defensive
// cap for malformed historical database payloads, not a limit on applicants.
export const MAX_AFFILIATE_QUESTIONNAIRE_CIPHERTEXT_LENGTH = 32_768;

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

// Historical ciphertext is authenticated, but the admin only needs this
// bounded, non-sensitive projection. Re-validating a person's DOB, CPF or
// current coupon rules could make a legitimate old application disappear from
// triage when the applicant ages or the onboarding rules change.
const summaryFieldsSchema = z.object({
  niche: z.string().min(1).max(120),
  otherNiche: z.string().max(120),
  instagramFollowers: z.string().max(100),
  tiktokFollowers: z.string().max(100),
  municipalRegistration: z.enum(["sim", "nao"]),
  dependents: z.string().min(1).max(100),
  preferredLine: z.string().min(1).max(120),
  couponSuggestion: z.string().min(1).max(40),
});

/**
 * Deliberately never exposes CPF, CNPJ, birth date, telephone, or address to the
 * regular candidate listing. This is a review summary, not an identity-verification API.
 */
export function affiliateWizardSummary(
  ciphertext: string | null | undefined,
): AffiliateWizardSummary | null {
  if (!ciphertext || ciphertext.length > MAX_AFFILIATE_QUESTIONNAIRE_CIPHERTEXT_LENGTH) return null;
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
    const data = summaryFieldsSchema.safeParse(payload.answers);
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

/**
 * On-demand, authenticated detail view only. Unlike the list projection, it
 * contains identifying answers. The server route must enforce session/TOTP
 * and Same-Origin, and the client must never cache this document persistently.
 */
// Read-only historical projection: do not revalidate age, catalogue values or
// present-day registration rules when decrypting an already accepted record.
const privateAnswersSchema = z.object({
  firstName: z.string().max(70),
  lastName: z.string().max(70),
  phone: z.string().max(20),
  email: z.string().max(180),
  cpf: z.string().max(14),
  cnpj: z.string().max(18),
  birthDate: z.string().max(10),
  birthCity: z.string().max(90),
  postalCode: z.string().max(9),
  city: z.string().max(90),
  state: z.string().max(2),
  street: z.string().max(120),
  district: z.string().max(90),
  number: z.string().max(15),
  complement: z.string().max(120),
  instagramUsername: z.string().max(31),
  tiktokUsername: z.string().max(31),
  xUsername: z.string().max(100),
  youtubeUsername: z.string().max(100),
  niche: z.string().max(120),
  otherNiche: z.string().max(120),
  instagramFollowers: z.string().max(100),
  tiktokFollowers: z.string().max(100),
  municipalRegistration: z.string().max(4),
  municipalNumber: z.string().max(40),
  dependents: z.string().max(100),
  preferredLine: z.string().max(120),
  couponSuggestion: z.string().max(40),
  hairType: z.string().max(50),
});
export type AffiliatePrivateAnswers = z.infer<typeof privateAnswersSchema>;
export type AffiliatePrivateDetail = {
  acceptedAt: string;
  answers: AffiliatePrivateAnswers;
};

export function decryptAffiliateWizardForAdmin(
  ciphertext: string | null | undefined,
): AffiliatePrivateDetail | null {
  if (!ciphertext || ciphertext.length > MAX_AFFILIATE_QUESTIONNAIRE_CIPHERTEXT_LENGTH) {
    return null;
  }
  const key = encryptionKey();
  if (!key) return null;
  try {
    const parts = ciphertext.split(".");
    if (parts.length !== 4) return null;
    const [version, iv64, tag64, encrypted64] = parts;
    if (version !== "v2" || !iv64 || !tag64 || !encrypted64) return null;
    const iv = Buffer.from(iv64, "base64url");
    const tag = Buffer.from(tag64, "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encrypted64, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    ) as unknown;
    const parsed = z
      .object({
        version: z.literal(2),
        acceptedAt: z.string().datetime({ offset: true }),
        answers: privateAnswersSchema,
      })
      .safeParse(payload);
    return parsed.success
      ? { acceptedAt: parsed.data.acceptedAt, answers: parsed.data.answers }
      : null;
  } catch {
    // No ciphertext, plaintext or decryption failure details in logs or API.
    return null;
  }
}
