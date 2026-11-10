import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

/** Read-only preflight. Never asserts that the merchant actually has stock. */
function parseCsv(csv) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x.length)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  return rows;
}
const root = process.cwd();
const products = JSON.parse(await readFile(resolve(root, "src/data/products.json"), "utf8"));
const response = await fetch("https://vonixhair.com/api/public/meta-catalog", {
  headers: { accept: "text/csv" },
});
if (response.status !== 200) throw new Error("Public feed HTTP " + response.status);
const rows = parseCsv(await response.text());
const header = rows.shift() || [];
const expected = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "brand",
];
if (JSON.stringify(header) !== JSON.stringify(expected))
  throw new Error("Unexpected feed columns: " + JSON.stringify(header));
const entries = rows.map((row) => Object.fromEntries(header.map((k, i) => [k, row[i] ?? ""])));
const mismatches = [],
  duplicates = [];
const idset = new Set();
for (const row of entries) {
  if (row.id && idset.has(row.id)) duplicates.push(row.id);
  idset.add(row.id);
  if (!row.link?.startsWith("https://vonixhair.com/produto/"))
    mismatches.push({ id: row.id, issue: "invalid product link" });
  if (!/^\d+\.\d{2} BRL$/.test(row.price)) mismatches.push({ id: row.id, issue: "invalid price" });
  if (row.sale_price && !/^\d+\.\d{2} BRL$/.test(row.sale_price))
    mismatches.push({ id: row.id, issue: "invalid sale price" });
}
// Cross-check the catalog feed against the actual public prices, SKU mappings and images.
const specials = {
  "VONIX-MASCARA-EFEITO-TEIA-COCO-NUTRI": "VONIX-MASCARA-COCO-NUTRI",
  "VONIX-COMBO-MATIZADOR-SHAMPOO-E-MASCARA": "VONIX-KIT-MATIZADOR",
};
const feedId = (slug) => {
  const legacy = `VONIX-${slug.replace(/^kit-/, "combo-").toUpperCase()}`;
  return specials[legacy] ?? legacy.replace(/^VONIX-COMBO-/, "VONIX-KIT-");
};
const byId = new Map(entries.map((row) => [row.id, row]));
const activeProducts = products.filter((p) => p.slug !== "plex-vonix");
for (const p of activeProducts) {
  const id = feedId(p.slug);
  const row = byId.get(id);
  if (!row) {
    mismatches.push({ id, issue: "missing catalog SKU" });
    continue;
  }
  const first = p.variants[0].price;
  const hasCompare = typeof p.compareBase === "number" && p.compareBase > first;
  const expected = {
    title: p.name,
    description: p.short,
    price: `${(hasCompare ? p.compareBase : first).toFixed(2)} BRL`,
    sale_price: hasCompare ? `${first.toFixed(2)} BRL` : "",
    link: `https://vonixhair.com/produto/${p.slug}`,
    image_link: new URL(p.images[0], "https://vonixhair.com").href,
    brand: "Vonix Hair",
    condition: "new",
  };
  for (const [field, value] of Object.entries(expected)) {
    if (row[field] !== value)
      mismatches.push({ id, issue: `${field} differs from current catalog` });
  }
}
for (const row of entries) {
  if (!activeProducts.some((p) => feedId(p.slug) === row.id))
    mismatches.push({ id: row.id, issue: "feed SKU not in active catalog" });
}
const outOfStockExcluded = !entries.some((row) => row.link?.endsWith("/plex-vonix"));
const missingImageCount = products.filter((p) => p.slug !== "plex-vonix" && !p.images?.[0]).length;
const report = {
  checkpoint: "C34",
  date: "2026-11-10",
  scope:
    "Public GET Meta CSV vs local current catalog; no inventory, ERP, ad account or orders accessed",
  feedHttp: response.status,
  totalSourceProducts: products.length,
  activeFeedRows: entries.length,
  excludedPlexVonix: outOfStockExcluded,
  distinctIds: idset.size,
  duplicateIds: duplicates,
  missingImageCount,
  feedFormatIssues: mismatches,
  availabilityClaims: Object.fromEntries(
    [...new Set(entries.map((x) => x.availability))].map((v) => [
      v,
      entries.filter((x) => x.availability === v).length,
    ]),
  ),
  unsupportedInStockClaims: entries.filter((x) => x.availability === "in stock").length,
  inventoryProof: "NOT_PRESENT_IN_REPOSITORY",
  readiness: "BLOCKED_UNTIL_VERIFIED_STOCK_BY_SKU",
  decision: "DO_NOT_DEPLOY_FEED_CHANGE_WITHOUT_BLING_STOCK_AND_ADS_REVIEW",
  note: "The CSV claims availability for all active SKUs while only a static OUT_OF_STOCK exclusion is present. This does NOT prove products are unavailable, only that live availability remains unverified.",
};
const path = resolve(root, "docs/VONIX_META_FEED_PUBLIC_C34_20261110.json");
await mkdir(resolve(root, "docs"), { recursive: true });
await writeFile(path, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    feedRows: report.activeFeedRows,
    unsupportedInStockClaims: report.unsupportedInStockClaims,
    formatIssues: mismatches.length,
    duplicates: duplicates.length,
    readiness: report.readiness,
  }),
);
if (
  mismatches.length ||
  duplicates.length ||
  !outOfStockExcluded ||
  entries.length !== products.length - 1
)
  process.exitCode = 1;
