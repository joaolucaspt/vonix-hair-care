/**
 * Vonix Hair public catalogue audit. Read-only: GETs public product pages;
 * never requests /checkout server functions, sends credentials or places orders.
 * Usage: node scripts/audit-public-catalog.mjs --live
 */
import { readFile, writeFile } from "node:fs/promises";

if (!process.argv.includes("--live")) {
  console.error("Explicit --live flag required for public HTTP audit.");
  process.exit(2);
}
const products = JSON.parse(await readFile(new URL("../src/data/products.json", import.meta.url), "utf8"));
const site = "https://vonixhair.com";
const output = new URL("../docs/VONIX_PUBLIC_CATALOG_AUDIT_20261109.json", import.meta.url);
const results = new Array(products.length);
let next = 0;

async function check(product, i) {
  const url = site + "/produto/" + encodeURIComponent(product.slug);
  const expected = product.variants[0].price.toFixed(2);
  try {
    const response = await fetch(url, {
      headers: { "Cache-Control": "no-cache", "Accept": "text/html", "User-Agent": "VonixHairAuditReadOnly/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    const html = await response.text();
    const found = html.match(/"priceCurrency":"BRL","price":"([0-9]+(?:\.[0-9]{2})?)"/);
    const price = found?.[1] ?? null;
    return {
      slug: product.slug,
      status: response.status,
      expectedPrice: expected,
      livePrice: price,
      priceMatches: response.ok && price === expected,
      oldCarriersAdvertised: html.includes("Loggi, Jadlog, Correios e Total Express"),
      hasCanonicalUrl: html.includes('<link rel="canonical" href="' + url + '"'),
      hasImage: html.includes('property="og:image"'),
    };
  } catch (error) {
    return { slug: product.slug, expectedPrice: expected, error: String(error), priceMatches: false };
  }
}
async function worker() {
  while (next < products.length) {
    const i = next++;
    results[i] = await check(products[i], i);
  }
}
await Promise.all([worker(), worker()]);
const broken = results.filter((r) => !r.priceMatches);
const incorrectCarriers = results.filter((r) => r.oldCarriersAdvertised);
const missingCanonical = results.filter((r) => !r.hasCanonicalUrl);
const report = {
  auditedAt: new Date().toISOString(),
  site,
  localCatalogProducts: products.length,
  publicPagesChecked: results.length,
  priceMismatches: broken.length,
  oldCarrierClaims: incorrectCarriers.length,
  missingCanonical: missingCanonical.length,
  checks: results,
  note: "Public HTTP/SSR check only, not checkout payment confirmation, stock verification or production release validation.",
};
await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  auditedAt: report.auditedAt,
  checked: results.length,
  priceMismatches: broken.length,
  oldCarrierClaims: incorrectCarriers.length,
  missingCanonical: missingCanonical.length,
  examples: [...broken.slice(0, 4), ...incorrectCarriers.slice(0, 2)],
  savedTo: output.pathname,
}, null, 2));
if (broken.length) process.exitCode = 1;
