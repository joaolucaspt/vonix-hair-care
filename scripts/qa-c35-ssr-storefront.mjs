import { readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rawProducts = JSON.parse(
  await readFile(new URL("../src/data/products.json", import.meta.url), "utf8"),
);
// The storefront excludes known unavailable SKUs in src/lib/store.ts. Audit the
// exact active catalog instead of falsely flagging deliberate 404 product pages.
// Fail closed if the source declaration changes or references unknown products.
const storeSource = await readFile(new URL("../src/lib/store.ts", import.meta.url), "utf8");
const excludedDeclaration =
  /export const OUT_OF_STOCK\s*=\s*new Set<string>\(\s*(\[[\s\S]*?\])\s*\)/.exec(storeSource);
if (!excludedDeclaration) throw new Error("Catalog availability declaration not found");
const excludedSlugs = JSON.parse(excludedDeclaration[1]);
if (
  !Array.isArray(excludedSlugs) ||
  excludedSlugs.some(
    (slug) => typeof slug !== "string" || !rawProducts.some((p) => p.slug === slug),
  ) ||
  new Set(excludedSlugs).size !== excludedSlugs.length
)
  throw new Error("Invalid or stale OUT_OF_STOCK declaration");
const excluded = new Set(excludedSlugs);
const products = rawProducts.filter((p) => !excluded.has(p.slug));
const origin = process.env.VONIX_C35_ORIGIN ?? "http://127.0.0.1:43972";
const canonicalOrigin = "https://vonixhair.com";
const get = async (path) => {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(15_000) });
  return { status: response.status, body: await response.text() };
};
const errors = [];
const details = [];
let next = 0;
async function worker() {
  while (next < products.length) {
    const idx = next++;
    const p = products[idx];
    const path = "/produto/" + p.slug;
    try {
      const { status, body } = await get(path);
      const meta = body.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
      const canonical = body.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
      const og = body.match(/<meta property="og:image" content="([^"]*)"/)?.[1] ?? "";
      const scripts = [...body.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)];
      const ld = scripts.map((m) => {
        try {
          return JSON.parse(m[1]);
        } catch {
          return null;
        }
      });
      const productLd = ld.find((o) => o?.["@type"] === "Product");
      const expectedPrice = p.variants[0].price.toFixed(2);
      const imagesMissing = [];
      for (const img of p.images) {
        if (!img.startsWith("/")) continue;
        try {
          await stat(join(fileURLToPath(new URL("../public/", import.meta.url)), img.slice(1)));
        } catch {
          imagesMissing.push(img);
        }
      }
      const issues = [];
      if (status !== 200) issues.push("HTTP " + status);
      if (canonical !== canonicalOrigin + path) issues.push("canonical");
      if (meta.length < 60 || meta.length > 170) issues.push("meta_length_" + meta.length);
      if (!meta.includes("até 5% no Pix em itens sem outra oferta")) issues.push("pix_copy");
      if (!meta.includes("sujeito à cotação do CEP")) issues.push("shipping_copy");
      if (!og.startsWith("https://")) issues.push("og_image");
      if (!productLd) issues.push("jsonld_product_missing");
      else {
        if (Object.hasOwn(productLd.offers ?? {}, "availability"))
          issues.push("jsonld_unverified_availability");
        if (productLd.offers?.price !== expectedPrice) issues.push("jsonld_price");
        if (productLd.offers?.url !== canonicalOrigin + path) issues.push("jsonld_url");
        if (
          !Array.isArray(productLd.image) ||
          !productLd.image.every((x) => x.startsWith("https://"))
        )
          issues.push("jsonld_images");
      }
      if (imagesMissing.length) issues.push("local_images_missing");
      if (body.includes("Total Express") || body.includes("Loggi")) issues.push("obsolete_carrier");
      details.push({
        slug: p.slug,
        status,
        metaLength: meta.length,
        price: expectedPrice,
        issues,
        imagesMissing,
      });
      if (issues.length) errors.push({ slug: p.slug, issues });
    } catch (e) {
      errors.push({ slug: p.slug, issues: ["fetch_exception", String(e).slice(0, 150)] });
    }
  }
}
await Promise.all(Array.from({ length: 6 }, () => worker()));
const excludedPages = [];
for (const slug of excludedSlugs) {
  try {
    const { status } = await get("/produto/" + slug);
    excludedPages.push({ slug, status });
    if (status !== 404)
      errors.push({ slug, issues: ["excluded_product_accessible", "HTTP " + status] });
  } catch (e) {
    excludedPages.push({ slug, status: null });
    errors.push({ slug, issues: ["excluded_product_fetch_failed", String(e).slice(0, 150)] });
  }
}
const extra = {};
for (const route of [
  "/",
  "/loja",
  "/carrinho",
  "/checkout",
  "/sitemap.xml",
  "/robots.txt",
  "/rota-inexistente-auditoria-c3-20261109",
]) {
  try {
    const { status, body } = await get(route);
    extra[route] = {
      status,
      descriptionHasCep: route === "/" ? body.includes("conforme cotação do CEP") : null,
      productUrls:
        route === "/sitemap.xml"
          ? (body.match(/<loc>https:\/\/vonixhair\.com\/produto\//g) ?? []).length
          : null,
    };
  } catch (e) {
    extra[route] = { error: String(e) };
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  environment: origin,
  target: "Local SSR only; no payment, leads or DB operations",
  productCount: products.length,
  sourceProductCount: rawProducts.length,
  excludedProductSlugs: excludedSlugs,
  excludedPages,
  pagesChecked: details.length,
  passed: details.filter((d) => !d.issues.length).length,
  failed: errors.length,
  descriptionLengthRange: {
    min: Math.min(...details.map((d) => d.metaLength)),
    max: Math.max(...details.map((d) => d.metaLength)),
  },
  inventoryAvailabilityValidated: false,
  note: "JSON-LD does not claim InStock without Bling verification; the separate public feed and real inventory remain unverified.",
  extra,
  failures: errors,
};
await writeFile(
  new URL("../docs/VONIX_SSR_PREFLIGHT_C35_20261110.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(report, null, 2));
if (
  errors.length ||
  details.length !== products.length ||
  extra["/sitemap.xml"].productUrls !== products.length ||
  extra["/checkout"].status !== 200 ||
  extra["/rota-inexistente-auditoria-c3-20261109"].status !== 404
)
  process.exitCode = 1;
