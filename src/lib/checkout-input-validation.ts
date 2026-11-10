/**
 * Browser + server validation for delivery data. No account, payment,
 * external API or affiliate module should be needed to validate a form.
 */
const BRAZIL_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);
const STATES = new Set([
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
]);

/**
 * Both 11-digit mobile WhatsApp and 10-digit fixed-line WhatsApp Business
 * numbers are valid. A +55 country prefix is optional. In all cases DDD
 * must be a real Brazilian area code and the local number must be plausible.
 */
export function normalizeBrazilWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
}

export function isValidBrazilWhatsapp(raw: string): boolean {
  if (!/^(?:\+)?[0-9\s().-]+$/.test(raw.trim())) return false;
  const digits = normalizeBrazilWhatsapp(raw);
  if (digits.length !== 10 && digits.length !== 11) return false;
  if (!BRAZIL_DDDS.has(Number(digits.slice(0, 2)))) return false;
  const subscriber = digits.slice(2);
  if (subscriber.length === 9) return subscriber[0] === "9";
  return /^[2-5]/.test(subscriber);
}

export const isValidBrazilUF = (value: string): boolean => STATES.has(value.trim().toUpperCase());

export const hasDeliveryAddress = (address: {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
}): boolean =>
  [address.rua, address.numero, address.bairro, address.cidade].every(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
