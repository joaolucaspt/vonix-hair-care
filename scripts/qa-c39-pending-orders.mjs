import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const playwrightPath = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(playwrightPath);
const origin = process.env.VONIX_C39_ORIGIN || "http://127.0.0.1:43983";
const directory = resolve("qa-artifacts/vonix-c39/pending-orders");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width > 900 ? 900 : 844 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    let blocked = 0;
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" || u.protocol === "data:") return route.continue();
      blocked++;
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const entry = { width, passed: false };
    try {
      const response = await page.goto(origin + "/loja", { waitUntil: "domcontentloaded" });
      if (response?.status() !== 200) throw Error("Loja HTTP " + response?.status());
      const report = await page.evaluate(async () => {
        const mod = await import("/src/lib/pending-purchase-basket.ts");
        sessionStorage.clear();
        const a = { slug: "kit-banana-e-mel", variant: "Kit", qty: 1 };
        const b = { slug: "serum-argan", variant: "60ml", qty: 1 };
        const now = Date.now();
        mod.savePurchaseBasket(99101, [a], now);
        mod.savePurchaseBasket(99102, [b], now + 1);
        const before = {
          first: mod.restorePurchaseBasket(99101, now + 2),
          second: mod.restorePurchaseBasket(99102, now + 2),
        };
        mod.clearPurchaseBasket(99102);
        const after = {
          first: mod.restorePurchaseBasket(99101, now + 3),
          second: mod.restorePurchaseBasket(99102, now + 3),
        };
        mod.clearPurchaseBasket(99101);
        const cleanup = mod.restorePurchaseBasket(99101, now + 3);
        const noPII = !/customer|cpf|phone|email|token|paid|status|total/.test(
          sessionStorage.getItem(mod.PENDING_PURCHASE_BASKET_KEY) ?? "",
        );
        return { before, after, cleanup, noPII, a, b };
      });
      if (
        JSON.stringify(report.before.first) !== JSON.stringify([report.a]) ||
        JSON.stringify(report.before.second) !== JSON.stringify([report.b]) ||
        JSON.stringify(report.after.first) !== JSON.stringify([report.a]) ||
        report.after.second !== null ||
        report.cleanup !== null ||
        !report.noPII ||
        errors.length
      )
        throw Error("Multiorder browser invariant failed " + JSON.stringify({ report, errors }));
      entry.passed = true;
      entry.checked = "two order IDs, independent restore and cleanup, no PII, no payment";
    } catch (error) {
      entry.error = String(error);
    } finally {
      entry.externalRequestsBlocked = blocked;
      results.push(entry);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C39",
  scope: "Chrome sessionStorage multi-pending-order identity with external network blocked",
  passed: results.filter((x) => x.passed).length,
  failed: results.filter((x) => !x.passed).length,
  results,
};
await writeFile(resolve(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
