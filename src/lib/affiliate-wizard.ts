import { z } from "zod";

/**
 * Five-stage questionnaire based on the publicly accessible reference form, with
 * Vonix product choices. No reference service, social verification, or tracking calls.
 */
export const WIZARD_STEPS = [
  { title: "Dados pessoais", subtitle: "Identificação, endereço e perfis sociais" },
  { title: "Seu conteúdo", subtitle: "Nicho e tamanho da audiência" },
  { title: "Dados complementares", subtitle: "Inscrição municipal e dependentes" },
  { title: "Sua conexão com a Vonix", subtitle: "Produtos favoritos e nome do cupom" },
  { title: "Finalização", subtitle: "Tipo de cabelo e termos de participação" },
] as const;

export const CONTENT_NICHES = [
  "Lifestyle",
  "Cabelos",
  "Beleza",
  "Moda",
  "Fitness",
  "Viagem",
  "Maternidade",
  "Decoração",
  "Outro",
] as const;
export const INSTAGRAM_FOLLOWERS = [
  "Até 1.000 seguidores",
  "De 1.001 a 2.000 seguidores",
  "De 2.001 a 5.000 seguidores",
  "De 5.001 a 10.000 seguidores",
  "Acima de 10.000 seguidores",
] as const;
export const TIKTOK_FOLLOWERS = [
  "Até 1.000 seguidores",
  "De 1.001 a 2.000 seguidores",
  "De 2.001 a 5.000 seguidores",
  "Não utilizo TikTok",
] as const;
export const PREFERRED_VONIX_LINES = [
  "Progressiva Fio de Luz",
  "Botox Vonix",
  "Máscara de Reparação Nutri Repair",
  "Kit Cronograma Capilar",
  "Outra linha Vonix",
] as const;
export const WIZARD_HAIR_TYPES = ["Liso", "Cacheado", "Ondulado", "Crespo"] as const;
export const DEPENDENT_CHOICES = ["Somente filhos", "Não tenho"] as const;
export const WIZARD_BRAZIL_STATES = [
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

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function validCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (let n = 9; n <= 10; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(d[n])) return false;
  }
  return true;
}

export function validCnpj(value: string): boolean {
  // Accept only digits or the official display mask; discarding letters or
  // punctuation first would allow checksum-valid but corrupted identifiers.
  if (!/^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(value)) return false;
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  for (const [count, weights] of [
    [12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]],
    [13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]],
  ] as const) {
    const sum = Array.from({ length: count }, (_, i) => Number(d[i]) * weights[i]!).reduce(
      (a, b) => a + b,
      0,
    );
    const rem = sum % 11;
    if (Number(d[count]) !== (rem < 2 ? 0 : 11 - rem)) return false;
  }
  return true;
}

export function ageFromBirthDate(value: string, now = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return -1;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  )
    return -1;
  // Legal adulthood for Brazilian applicants must follow the Brazilian date.
  // UTC can accept an applicant hours before their 18th birthday in Brazil.
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const part = (type: "year" | "month" | "day") =>
    Number(dateParts.find((entry) => entry.type === type)?.value);
  const y = part("year");
  const m = part("month");
  const d = part("day");
  return y - year! - (m < month! || (m === month && d < day!) ? 1 : 0);
}

export function normaliseUsername(value: string): string {
  return value.trim().replace(/^@/, "");
}
export function instagramProfileUrl(value: string): string {
  return "https://www.instagram.com/" + normaliseUsername(value);
}
export function tiktokProfileUrl(value: string): string {
  return value.trim() ? "https://www.tiktok.com/@" + normaliseUsername(value) : "";
}

const BRAZILIAN_DDDS = new Set([
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "21",
  "22",
  "24",
  "27",
  "28",
  "31",
  "32",
  "33",
  "34",
  "35",
  "37",
  "38",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "53",
  "54",
  "55",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "71",
  "73",
  "74",
  "75",
  "77",
  "79",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
]);

export function validBrazilianMobilePhone(value: string): boolean {
  // A mobile number uses a Brazilian DDD, nine local digits, starting with 9.
  // Strict outer formatting prevents arbitrary text from being hidden inside.
  if (!/^(?:\d{11}|\(\d{2}\) \d{5}-\d{4})$/.test(value)) return false;
  const digits = onlyDigits(value);
  return BRAZILIAN_DDDS.has(digits.slice(0, 2)) && digits[2] === "9";
}

const RESERVED_INSTAGRAM_ROUTES = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "stories",
  "accounts",
  "direct",
]);

export function validInstagramUsername(value: string): boolean {
  const username = normaliseUsername(value);
  return (
    /^[A-Za-z0-9._]{1,30}$/.test(username) && !RESERVED_INSTAGRAM_ROUTES.has(username.toLowerCase())
  );
}

const username = z
  .string()
  .trim()
  .min(1, "Informe seu usuário.")
  .max(31)
  .refine(validInstagramUsername, "Informe um usuário válido do Instagram.");

const optionalTiktokUsername = z
  .string()
  .trim()
  .max(31)
  .refine(
    (value) => !value || /^@?[A-Za-z0-9._]{2,30}$/.test(value),
    "Informe um usuário válido do TikTok (2 a 30 caracteres).",
  );

const optionalUsername = z
  .string()
  .trim()
  .max(100)
  .refine((v) => !v || /^@?[\w.-]{2,100}$/.test(v), "Informe um usuário válido.");
const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(2, "Informe " + label + ".")
    .max(max);

export const affiliateWizardFieldsSchema = z
  .object({
    firstName: requiredText("seu primeiro nome", 70),
    lastName: requiredText("seu sobrenome", 70),
    phone: z
      .string()
      .trim()
      .max(20, "Informe um celular com DDD.")
      .refine(validBrazilianMobilePhone, "Informe um celular válido com DDD e nove dígitos."),
    email: z.string().trim().email("Informe um e-mail válido.").max(180),
    emailConfirmation: z.string().trim().email("Confirme seu e-mail.").max(180),
    cpf: z
      .string()
      .trim()
      .max(14, "Informe um CPF válido.")
      .refine(
        (value) => /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value) && validCpf(value),
        "Informe um CPF válido.",
      ),
    cnpj: z
      .string()
      .trim()
      .max(18)
      .refine((v) => !v || validCnpj(v), "Informe um CNPJ válido."),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
      .refine((v) => {
        const age = ageFromBirthDate(v);
        return age >= 18 && age <= 100;
      }, "É necessário ter entre 18 e 100 anos."),
    birthCity: requiredText("sua cidade de nascimento", 90),
    postalCode: z
      .string()
      .trim()
      .max(9, "Informe um CEP válido.")
      .regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido."),
    city: requiredText("sua cidade", 90),
    state: z.enum(WIZARD_BRAZIL_STATES),
    street: requiredText("o logradouro", 120),
    district: requiredText("o bairro", 90),
    number: z.string().trim().min(1, "Informe o número.").max(15),
    complement: z.string().trim().max(120),
    instagramUsername: username,
    tiktokUsername: optionalTiktokUsername,
    xUsername: optionalUsername,
    youtubeUsername: z.string().trim().max(100),
    niche: z.enum(CONTENT_NICHES),
    otherNiche: z.string().trim().max(120),
    instagramFollowers: z.union([z.enum(INSTAGRAM_FOLLOWERS), z.literal("")]),
    tiktokFollowers: z.enum(TIKTOK_FOLLOWERS),
    municipalRegistration: z.enum(["sim", "nao"]),
    municipalNumber: z.string().trim().max(40),
    dependents: z.enum(DEPENDENT_CHOICES),
    preferredLine: z.enum(PREFERRED_VONIX_LINES),
    couponSuggestion: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine(
        (v) => /^[A-Z0-9]{3,28}10$/.test(v),
        "Use letras e números e finalize com 10 (ex.: MARINA10).",
      ),
    hairType: z.enum(WIZARD_HAIR_TYPES),
    termsAccepted: z.boolean().refine((v) => v === true, "É necessário aceitar os termos."),
  })
  .strict();

export const affiliateWizardSchema = affiliateWizardFieldsSchema.superRefine((w, ctx) => {
  if (w.email.trim().toLowerCase() !== w.emailConfirmation.trim().toLowerCase()) {
    ctx.addIssue({
      code: "custom",
      path: ["emailConfirmation"],
      message: "Os e-mails não coincidem.",
    });
  }
  if (w.niche === "Outro" && w.otherNiche.length < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["otherNiche"],
      message: "Informe qual é o outro nicho.",
    });
  }
  if (w.municipalRegistration === "sim" && w.municipalNumber.length < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["municipalNumber"],
      message: "Informe o número da inscrição municipal.",
    });
  }
});
export type AffiliateWizardAnswers = z.input<typeof affiliateWizardSchema>;
export type ValidatedAffiliateWizard = z.output<typeof affiliateWizardSchema>;
export type WizardKey = keyof AffiliateWizardAnswers;
export type AffiliateWizardDraft = { [K in WizardKey]: string | boolean };

export const WIZARD_FIELDS: readonly WizardKey[][] = [
  [
    "firstName",
    "lastName",
    "phone",
    "email",
    "emailConfirmation",
    "cpf",
    "cnpj",
    "birthDate",
    "birthCity",
    "postalCode",
    "city",
    "state",
    "street",
    "district",
    "number",
    "complement",
    "instagramUsername",
    "tiktokUsername",
    "xUsername",
    "youtubeUsername",
  ],
  ["niche", "otherNiche", "instagramFollowers", "tiktokFollowers"],
  ["municipalRegistration", "municipalNumber", "dependents"],
  ["preferredLine", "couponSuggestion"],
  ["hairType", "termsAccepted"],
] as const;

export function stepErrors(step: number, values: AffiliateWizardDraft): Record<string, string> {
  const parsed = affiliateWizardSchema.safeParse(values);
  const keys = new Set(WIZARD_FIELDS[step] ?? []);
  const errors: Record<string, string> = {};
  if (!parsed.success)
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (keys.has(key as WizardKey) && !errors[key]) errors[key] = issue.message;
    }
  // Conditional errors must appear even when fields in *other* stages are empty.
  if (
    step === 0 &&
    values.email &&
    values.emailConfirmation &&
    String(values.email).trim().toLowerCase() !==
      String(values.emailConfirmation).trim().toLowerCase()
  )
    errors["emailConfirmation"] = "Os e-mails não coincidem.";
  if (step === 1 && values.niche === "Outro" && String(values.otherNiche).trim().length < 2)
    errors["otherNiche"] = "Informe qual é o outro nicho.";
  if (
    step === 2 &&
    values.municipalRegistration === "sim" &&
    String(values.municipalNumber).trim().length < 2
  )
    errors["municipalNumber"] = "Informe o número da inscrição municipal.";
  return errors;
}

export function buildAffiliatePayload(w: ValidatedAffiliateWizard) {
  return {
    fullName: w.firstName + " " + w.lastName,
    age: ageFromBirthDate(w.birthDate),
    city: w.city,
    state: w.state,
    hairType: w.hairType,
    email: w.email,
    instagram: instagramProfileUrl(w.instagramUsername),
    tiktok: tiktokProfileUrl(w.tiktokUsername),
    privacyAccepted: true as const,
    website: "",
    wizard: w,
  };
}
