import type { ShippingQuote } from "./melhorenvio.server";

/** Prazo máximo que a loja quer prometer na opção rápida e na econômica (dias úteis). */
export const FAST_MAX_DAYS = 3;
export const ECONOMY_MAX_DAYS = 5;

/**
 * Reduz as cotações a no máximo duas opções no checkout:
 * - rápida: a de menor prazo (empate: a mais barata), de preferência em até FAST_MAX_DAYS;
 * - econômica: a mais barata das demais, de preferência em até ECONOMY_MAX_DAYS.
 * Os prazos e preços são sempre os reais da cotação; nada é inventado.
 */
export function pickTwoShipping<T extends Pick<ShippingQuote, "id" | "price" | "days">>(quotes: T[]): T[] {
  if (quotes.length <= 1) return quotes;

  const byDaysThenPrice = [...quotes].sort((a, b) => a.days - b.days || a.price - b.price);
  const fast = byDaysThenPrice[0] as T;

  const others = quotes.filter((q) => q.id !== fast.id);
  const byPrice = [...others].sort((a, b) => a.price - b.price || a.days - b.days);
  const withinLimit = byPrice.filter((q) => q.days <= ECONOMY_MAX_DAYS);
  const economy = (withinLimit[0] ?? byPrice[0]) as T;

  // Se a opção "econômica" não for realmente mais barata que a rápida, só a rápida faz sentido.
  if (economy.price >= fast.price && economy.days >= fast.days) return [fast];

  return [fast, economy].sort((a, b) => a.days - b.days || a.price - b.price);
}
