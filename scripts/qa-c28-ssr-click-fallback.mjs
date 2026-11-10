import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(
  resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright"),
);
const origin = "http://127.0.0.1:43972";
const dir = resolve("qa-artifacts/vonix-c28/ssr-no-js");
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 900 ? 844 : 900 },
      javascriptEnabled: false,
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      return u.hostname === "127.0.0.1" || u.protocol === "data:"
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    const r = { width, passed: false };
    try {
      const response = await page.goto(origin + "/loja?secao=mais-vendidos", {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      if (response?.status() !== 200) throw Error("SSR listing returned " + response?.status());
      await page.getByRole("heading", { name: "Mais Vendidos", level: 1 }).waitFor();
      const first = page.getByRole("link", { name: /Ver produto Botox Vonix sem formol/ }).first();
      await first.waitFor({ timeout: 7000 });
      const href = await first.getAttribute("href");
      if (href !== "/produto/botox-vonix") throw Error("No safe non-JS destination: " + href);
      await page.screenshot({ path: resolve(dir, "catalog-" + width + ".png") });
      await first.click();
      await page.waitForURL("**/produto/botox-vonix", { timeout: 15000 });
      await page.getByRole("heading", { level: 1, name: /Botox Vonix sem formol/ }).waitFor();
      const buyButtons = page.getByRole("button", { name: "Comprar agora" });
      if ((await buyButtons.count()) && !(await buyButtons.first().isDisabled()))
        throw Error("Pre-hydration buy action looks enabled without handler");
      r.passed = true;
      r.nativeLinkWorks = true;
      r.buyButtonsDisabledWithoutJs = true;
      await page.screenshot({ path: resolve(dir, "product-" + width + ".png") });
    } catch (e) {
      r.error = String(e);
    }
    results.push(r);
    await context.close();
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C28",
  network: "external denied",
  mode: "JavaScript disabled",
  passed: results.filter((x) => x.passed).length,
  failed: results.filter((x) => !x.passed).length,
  results,
};
await writeFile(resolve(dir, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
