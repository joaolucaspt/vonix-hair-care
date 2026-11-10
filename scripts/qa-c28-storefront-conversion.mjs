import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const browserPackage = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(browserPackage);
const origin = "http://127.0.0.1:43972";
const dir = resolve(process.cwd(), "qa-artifacts/vonix-c28");
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
for (const width of [320, 390, 1366]) {
  const context = await browser.newContext({
    viewport: { width, height: width < 900 ? 844 : 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" || url.protocol === "data:"
      ? route.continue()
      : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const result = { width, passed: false, errors };
  try {
    const home = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (home?.status() !== 200) throw Error("Home HTTP " + home?.status());
    const section = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /Mais Vendidos/i }) })
      .first();
    await section.waitFor({ timeout: 12000 });
    const text = await section.innerText();
    if (!text.includes("03/11/2026") || !text.includes("Não indica estoque atual"))
      throw Error("Historical sales context missing");
    const hrefs = await section
      .locator('a[href^="/produto/"]')
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((n) => n.getAttribute("href")).filter(Boolean)),
      ]);
    const expected = [
      "/produto/botox-vonix",
      "/produto/kit-banana-e-mel",
      "/produto/kit-cronograma-capilar",
    ];
    if (JSON.stringify(hrefs.slice(0, 3)) !== JSON.stringify(expected))
      throw Error("Home rank mismatch " + JSON.stringify(hrefs.slice(0, 3)));
    // The first SSR paint provides a native product link. An interactive CTA appears only after hydration.
    await section
      .getByRole("button", { name: /Adicionar .* à sacola|Escolher opções de/ })
      .first()
      .waitFor({ state: "visible", timeout: 20000 });
    result.hydratedCardCTA = true;
    result.homeRank = true;
    await page.screenshot({ path: resolve(dir, "home-" + width + ".png"), fullPage: true });
    const listing = await page.goto(origin + "/loja?secao=mais-vendidos", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    if (listing?.status() !== 200) throw Error("Listing HTTP " + listing?.status());
    await page
      .getByRole("heading", { level: 1, name: "Mais Vendidos" })
      .waitFor({ timeout: 12000 });
    await page
      .getByText(/03\/11\/2026/)
      .first()
      .waitFor();
    const listed = await page
      .locator('a[href^="/produto/"]')
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((n) => n.getAttribute("href")).filter(Boolean)),
      ]);
    if (JSON.stringify(listed.slice(0, 3)) !== JSON.stringify(expected))
      throw Error("Listing rank mismatch " + JSON.stringify(listed.slice(0, 3)));
    result.listRank = true;
    await page.waitForTimeout(1200); // Diagnostic: test after hydration, separate from the first-paint failure.
    const add = page.getByRole("button", { name: /^Adicionar .* à sacola$/ }).first();
    await add.waitFor({ timeout: 12000 });
    const addedName = await add.getAttribute("aria-label");
    await add.click();
    await page.waitForTimeout(400);
    const storedCart = await page.evaluate(() => localStorage.getItem("vonix-cart"));
    result.afterClick = storedCart;
    if (!storedCart || JSON.parse(storedCart).length === 0)
      throw Error("Add CTA did not persist any product");
    await page.screenshot({ path: resolve(dir, "catalog-" + width + ".png") });
    const cart = await page.goto(origin + "/carrinho", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    if (cart?.status() !== 200) throw Error("Cart HTTP " + cart?.status());
    await page
      .getByRole("heading", { level: 1, name: /Carrinho|Sua sacola/i })
      .first()
      .waitFor();
    if (await page.getByText("Sua sacola está vazia").count())
      throw Error("Add CTA did not preserve cart");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    );
    if (overflow || errors.length) throw Error(JSON.stringify({ overflow, errors }));
    result.cartCTA = addedName;
    await page.screenshot({ path: resolve(dir, "cart-" + width + ".png") });
    await page.goto(origin + "/loja?q=kit+cachos", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const choose = page.getByRole("button", { name: /Escolher opções de Kit Cachos/i }).first();
    await choose.waitFor({ timeout: 15000 });
    await choose.click();
    await page.waitForURL("**/produto/kit-cachos", { timeout: 15000 });
    await page.getByRole("heading", { level: 1, name: "Kit Cachos" }).waitFor();
    const afterChoose = await page.evaluate(() => localStorage.getItem("vonix-cart"));
    if (afterChoose !== storedCart)
      throw Error("Choosing a size altered the cart before confirming a variant");
    result.variantChoice = true;
    if (errors.length) throw Error("Page errors " + JSON.stringify(errors));
    result.passed = true;
    await page.screenshot({ path: resolve(dir, "variant-" + width + ".png") });
  } catch (e) {
    result.error = String(e);
  }
  results.push(result);
  await context.close();
}
await browser.close();
const report = {
  checkpoint: "C28",
  network: "external denied",
  scope: "Home ranking, catalog ranking, card CTA, in-memory cart; no payment or PII",
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(dir, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
