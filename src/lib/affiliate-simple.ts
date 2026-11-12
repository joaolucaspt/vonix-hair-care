import { z } from "zod";
import {
  instagramProfileUrl,
  normaliseUsername,
  onlyDigits,
  tiktokProfileUrl,
  validInstagramUsername,
  WIZARD_BRAZIL_STATES,
} from "./affiliate-wizard";

/** Public intake contains only the fields requested by Vonix. No e-mail,
 * birth date, government identifiers, hair type or marketing questions. */
const socialHandle = z.string().trim().min(1, "Informe o usuário da rede social.").max(50);
const followerCount = z.number().int().min(0).max(1_000_000_000);

export const affiliateSimpleSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome."),
    phone: z
      .string()
      .trim()
      .min(10)
      .max(20)
      .refine((v) => {
        if (!/^[+()\d. -]+$/.test(v)) return false;
        const digits = onlyDigits(v).replace(/^55(?=\d{10,11}$)/, "");
        return /^(?:[1-9]\d[2-5]\d{7}|[1-9]\d9\d{8})$/.test(digits);
      }, "Informe um telefone brasileiro com DDD."),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}-?\d{3}$/, "Informe um CEP com 8 dígitos."),
    street: z.string().trim().min(3).max(120),
    number: z
      .string()
      .trim()
      .min(1)
      .max(15)
      .regex(/^(?:\d+[A-Za-z]?|s\/n|sn|sem n[uú]mero)$/i, "Informe o número do imóvel ou s/n."),
    district: z.string().trim().min(2).max(90),
    city: z.string().trim().min(2).max(90),
    state: z.enum(WIZARD_BRAZIL_STATES),
    complement: z.string().trim().max(120).default(""),
    instagram: socialHandle.refine(
      (value) => validInstagramUsername(normaliseUsername(value)),
      "Informe um usuário válido do Instagram.",
    ),
    instagramFollowers: followerCount,
    tiktok: z
      .string()
      .trim()
      .max(50)
      .refine(
        (value) => value === "" || /^@?[A-Za-z0-9._]{2,30}$/.test(value),
        "Informe um usuário válido do TikTok, se informado.",
      )
      .default(""),
    tiktokFollowers: followerCount.nullable().default(null),
    privacyAccepted: z.literal(true),
    // An optional browser-issued 192-bit private receipt makes ambiguous
    // network failures retryable without querying an applicant by Instagram.
    // Older clients omit it; the server then issues a fresh secure receipt.
    trackingCode: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32}$/)
      .optional(),
    website: z.string().max(120).default(""), // anti-bot honeypot
  })
  .strict();

export type AffiliateSimpleInput = z.infer<typeof affiliateSimpleSchema>;
export type AffiliateSimpleDraft = z.input<typeof affiliateSimpleSchema>;

export function simpleAffiliateSocialUrls(data: AffiliateSimpleInput) {
  return {
    instagram_url: instagramProfileUrl(data.instagram),
    tiktok_url: tiktokProfileUrl(data.tiktok),
  };
}
