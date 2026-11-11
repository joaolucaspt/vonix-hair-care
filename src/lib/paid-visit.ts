import { useEffect, useState } from "react";

const KEY = "vonix-visita-paga";

/** A visita veio de anúncio? (utm de mídia paga ou clique do Meta). Dura só a sessão do navegador. */
export function isPaidSearch(search: string): boolean {
  const p = new URLSearchParams(search);
  const medium = (p.get("utm_medium") ?? "").toLowerCase();
  return p.has("fbclid") || ["paid", "cpc", "paid_social", "ppc"].includes(medium);
}

export function markPaidVisit(search: string) {
  if (typeof window === "undefined" || !isPaidSearch(search)) return;
  try { sessionStorage.setItem(KEY, "1"); } catch { /* sem armazenamento */ }
}

export function readPaidVisit(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Só depois de montar (evita diferença entre servidor e navegador). Quem veio de anúncio vê menos distração. */
export function usePaidVisit(): boolean {
  const [paid, setPaid] = useState(false);
  useEffect(() => { setPaid(readPaidVisit()); }, []);
  return paid;
}
