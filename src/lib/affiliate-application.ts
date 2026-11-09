import { z } from "zod";

export const HAIR_TYPES = [
  "Liso",
  "Ondulado",
  "Cacheado",
  "Crespo",
  "Misto / em transição",
  "Outro",
] as const;

export const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

function validSocialProfile(value: string, host: "instagram.com" | "tiktok.com"): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || hostname !== host || url.username || url.password)
      return false;
    // Exact profile paths only: reject //, extra segments and content links.
    if (host === "instagram.com") {
      const match = url.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
      return (
        !!match &&
        !["p", "reel", "reels", "explore", "stories", "accounts", "direct"].includes(
          match[1]!.toLowerCase(),
        )
      );
    }
    return /^\/@[a-zA-Z0-9._]{2,30}\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export const affiliateApplicationSchema = z
  .object({
    fullName: z.string().trim().min(3).max(120),
    age: z.number().int().min(18).max(100),
    city: z.string().trim().min(2).max(90),
    state: z.enum(BRAZIL_STATES),
    hairType: z.enum(HAIR_TYPES),
    email: z.string().trim().toLowerCase().email().max(180),
    instagram: z
      .string()
      .trim()
      .max(240)
      .refine(
        (v) => validSocialProfile(v, "instagram.com"),
        "Informe o link de seu perfil do Instagram.",
      ),
    tiktok: z
      .string()
      .trim()
      .max(240)
      .refine(
        (v) => validSocialProfile(v, "tiktok.com"),
        "Informe o link de seu perfil do TikTok.",
      ),
    motivation: z.string().trim().min(30).max(3000),
    privacyAccepted: z.literal(true),
    // Honeypot: must stay empty for humans.
    website: z.string().max(120).optional().default(""),
  })
  .strict();

export type AffiliateApplicationInput = z.infer<typeof affiliateApplicationSchema>;
export type AffiliateStatus = "pendente" | "aprovada" | "recusada";
export type AffiliateMailStatus = "pendente" | "processando" | "enviado" | "falhou" | "incerto";

export interface AffiliateApplicationRecord {
  id: string;
  full_name: string;
  age: number;
  city: string;
  state: string;
  hair_type: string;
  email: string;
  instagram_url: string;
  tiktok_url: string;
  motivation: string;
  status: AffiliateStatus;
  created_at: string;
  reviewed_at: string | null;
  vonix_affiliate_mail_outbox?: { status: AffiliateMailStatus; sent_at: string | null }[] | null;
}

export const affiliateAdminSchema = z
  .object({
    password: z.string().min(1).max(240),
  })
  .strict();
