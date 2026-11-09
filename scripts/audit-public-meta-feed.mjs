import { readFile, writeFile } from "node:fs/promises";

if (!process.argv.includes("--live")) {
  console.error("Use --live to perform a read-only public Meta feed audit.");
  process.exit(2);
}
const base = "https://vonixhair.com";
const products = JSON.parse(await readFile(new URL("../src/data/products.json", import.meta.url), "utf8"));
const response = await fetch(base + "/api/public/meta-catalog", {
  headers: { "Accept": "text/csv", "Cache-Control": "no-cache" },
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw Error("Public Meta catalog HTTP " + response.status);
const csv = await response.text();

function parseCsv(data) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < data.length; i++) {
    const ch = data[i];
    if (ch === '"') {
      if (quoted && data[i+1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(value); value = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && data[i+1] === "\n") i++;
      row.push(value); value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      value += ch;
    }
  }
  if (quoted) throw Error("Malformed CSV: missing quote");
  if (row.length || value) { row.push(value); rows.push(row); }
  return rows;
}
const rows = parseCsv(csv);
const headings = rows.shift();
const expectedColumns = ["id","title","description","availability","condition","price","sale_price","link","image_link","brand"];
if (JSON.stringify(headings) !== JSON.stringify(expectedColumns)) throw Error("Unexpected feed column schema");
const feed = rows.map((r) => Object.fromEntries(headings.map((k,i)=>[k,r[i]??""])));
function catalogId(slug) {
  const id="VONIX-"+slug.replace(/^kit-/,"combo-").toUpperCase();
  const aliases={
    "VONIX-MASCARA-EFEITO-TEIA-COCO-NUTRI":"VONIX-MASCARA-COCO-NUTRI",
    "VONIX-COMBO-MATIZADOR-SHAMPOO-E-MASCARA":"VONIX-KIT-MATIZADOR",
  };
  return aliases[id]??id.replace(/^VONIX-COMBO-/,"VONIX-KIT-");
}
const feedById=new Map(feed.map(r=>[r.id,r]));
const checks=products.map(p=>{
  const id=catalogId(p.slug),r=feedById.get(id);
  if(!r) return {slug:p.slug,id,missing:true,priceMatches:false};
  const price=(r.sale_price||r.price).trim();
  const expected=p.variants[0].price.toFixed(2)+" BRL";
  const img=new URL(p.images[0],base).href;
  return {
    slug:p.slug,id,expected,price,
    priceMatches:price===expected,
    productLinkMatches:r.link===base+"/produto/"+p.slug,
    imageLinkMatches:r.image_link===img,
    availability:r.availability,
  };
});
const mismatch=checks.filter(c=>!c.priceMatches||!c.productLinkMatches||!c.imageLinkMatches);
const unknownIds=feed.filter(r=>!checks.some(c=>c.id===r.id)).map(r=>r.id);
const report={
  auditedAt:new Date().toISOString(),publicUrl:base+"/api/public/meta-catalog",rowCount:feed.length,
  expectedProducts:products.length,
  priceLinkOrImageMismatches:mismatch.length,
  unknownIds,missingOrDifferent:mismatch,
  advertisedInStock:feed.filter(r=>r.availability==="in stock").length,
  stockDataVerified:false,
  note:"Read-only public feed check. A value of 'in stock' is not evidence of real SKU inventory. No Commerce Manager/API credentials, stock systems or live orders were accessed.",
};
await writeFile(new URL("../docs/VONIX_PUBLIC_META_FEED_AUDIT_20261109.json",import.meta.url),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(mismatch.length||unknownIds.length||feed.length!==products.length)process.exitCode=1;
