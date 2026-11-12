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

/** Prazo rápido que a loja prefere para quem ganha frete grátis (dias úteis). */
export const FREE_MAX_DAYS = 3;

/** No frete grátis, a loja só paga a opção rápida se ela custar no máximo isto a mais que a mais barata (R$). */
export const FREE_EXTRA_FOR_SPEED = 8;

/**
 * Frete grátis (o frete sai do bolso da loja, então nunca pode dar prejuízo):
 * escolhe a opção MAIS BARATA; só prefere a rápida (até FREE_MAX_DAYS dias úteis) se ela custar no máximo
 * FREE_EXTRA_FOR_SPEED a mais. Antes a regra era "a mais barata em até 3 dias", que custava R$ 53 a R$ 79 para o
 * Nordeste, o Sul e o Norte, contra R$ 15 a R$ 31 da opção econômica (cotações de 12/11/2026). O prazo mostrado é sempre o real.
 */
export function pickFreeShipping<T extends Pick<ShippingQuote, "id" | "price" | "days">>(quotes: T[]): T | undefined {
  if (!quotes.length) return undefined;
  const byPrice = [...quotes].sort((a, b) => a.price - b.price || a.days - b.days);
  const cheapest = byPrice[0] as T;
  const fast = byPrice.find((q) => q.days <= FREE_MAX_DAYS);
  if (fast && fast.price - cheapest.price <= FREE_EXTRA_FOR_SPEED) return fast;
  return cheapest;
}
