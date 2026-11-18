/**
 * Arithmetic examples for the PUBLIC affiliate landing only.
 * Never use this function to determine eligibility or payable commissions.
 */
export function illustrativeEarnings(input: number) {
  const sales = Number.isFinite(input) ? Math.min(20000, Math.max(0, input)) : 0;
  const salesCents = Math.round(sales * 100);
  const commissionCents = Math.round((salesCents * 8) / 100);
  const bonusCents = Math.floor(salesCents / 1000000) * 50000;
  return {
    sales: salesCents / 100,
    commission: commissionCents / 100,
    bonus: bonusCents / 100,
    total: (commissionCents + bonusCents) / 100,
  };
}
