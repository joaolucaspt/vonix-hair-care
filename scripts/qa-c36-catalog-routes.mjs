import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const base = process.env.VONIX_C36_ORIGIN ?? "http://127.0.0.1:43980";
const products = JSON.parse(await readFile("src/data/products.json", "utf8"));
const active = products.filter((p) => p.slug !== "plex-vonix");
const errors = [];
const seenSlugs = new Set();
const assetPaths = new Set();
let imageRefs = 0;
for (const p of products) {
  if (seenSlugs.has(p.slug)) errors.push({ type: "duplicate_slug", slug: p.slug });
  seenSlugs.add(p.slug);
  const seenVariants = new Set();
  for (const variant of p.variants ?? []) {
    if (seenVariants.has(variant.label))
      errors.push({ type: "duplicate_variant", slug: p.slug, variant: variant.label });
    seenVariants.add(variant.label);
    if (!(
      Number.isFinite(variant.price) &&
      variant.price > 0 &&
      Math.round(variant.price * 100) / 100 === variant.price
    ))
      errors.push({ type: "price", slug: p.slug, variant: variant.label });
  }
  for (const image of p.images ?? []) {
    imageRefs++;
    if (typeof image !== "string" || !image.startsWith("/") || image.includes("..")) {
      errors.push({ type: "unsafe_image_path", slug: p.slug, image });
      continue;
    }
    const file = resolve("public", image.slice(1));
    try {
      const a = await stat(file);
      if (!a.isFile() || a.size === 0) errors.push({ type: "empty_image", slug: p.slug, image });
    } catch {
      errors.push({ type: "missing_image", slug: p.slug, image });
    }
    assetPaths.add(image);
  }
}
if (active.length !== 42) errors.push({ type: "active_count", found: active.length });
const paths = [
  "/",
  "/loja",
  "/sobre",
  "/contato",
  "/politica-de-trocas-e-devolucoes",
  "/politica-de-frete",
  "/politica-de-privacidade",
  "/termos-de-uso",
  "/carrinho",
  "/checkout",
  "/favoritos",
  "/conta",
  "/sitemap.xml",
  "/robots.txt",
  "/produto/plex-vonix",
];
const routes = [];
let sitemap = "";
for (const path of paths) {
  let status = 0,
    html = "";
  try {
    const resp = await fetch(base + path, { signal: AbortSignal.timeout(10000) });
    status = resp.status;
    html = await resp.text();
    if (path === "/sitemap.xml") sitemap = html;
    const expected = path === "/produto/plex-vonix" ? 404 : 200;
    if (status !== expected)
      errors.push({ type: "unexpected_route_status", path, status, expected });
    if (
      ["/carrinho", "/checkout", "/favoritos", "/conta"].includes(path) &&
      !/name="robots"[^>]*content="noindex/i.test(html)
    )
      errors.push({ type: "missing_robots_noindex", path });
    if (["/", "/loja"].includes(path) && !html.includes('rel="canonical"'))
      errors.push({ type: "missing_canonical", path });
  } catch (e) {
    errors.push({ type: "route_unreachable", path, error: String(e).slice(0, 160) });
  }
  routes.push({ path, status });
}
if (sitemap) {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
  if (new Set(locs).size !== locs.length) errors.push({ type: "duplicate_sitemap_url" });
  for (const p of active) {
    if (!locs.includes(`https://vonixhair.com/produto/${p.slug}`))
      errors.push({ type: "missing_sitemap_sku", slug: p.slug });
  }
  if (locs.some((loc) => loc.endsWith("/plex-vonix")))
    errors.push({ type: "retired_sku_in_sitemap" });
  for (const path of paths.slice(0, 8)) {
    const loc = "https://vonixhair.com" + (path === "/" ? "" : path);
    if (!locs.includes(loc)) errors.push({ type: "missing_sitemap_static", path });
  }
}
const result = {
  checkpoint: "C36",
  scope: "Read-only local SSR/asset/sitemap structural audit. No third-party inventory or billing.",
  base,
  sourceProducts: products.length,
  activeProducts: active.length,
  imageReferences: imageRefs,
  distinctImages: assetPaths.size,
  routeChecks: routes.length,
  routes,
  errors,
  passed: errors.length === 0,
};
await mkdir("qa-artifacts/vonix-c36", { recursive: true });
await writeFile(
  "qa-artifacts/vonix-c36/catalog-routes-report.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      passed: result.passed,
      active: result.activeProducts,
      imageReferences: imageRefs,
      distinctImages: assetPaths.size,
      routeChecks: routes.length,
      errors,
    },
    null,
    2,
  ),
);
if (!result.passed) process.exitCode = 1;
