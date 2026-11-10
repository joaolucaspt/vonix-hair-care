import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const modulePath = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(modulePath);
const origin = "http://127.0.0.1:43972";
const folder = resolve(process.cwd(), "qa-artifacts/vonix-c22", process.env.VONIX_C22_PHASE ?? "dev");
await mkdir(folder, { recursive: true });
const catalog = JSON.parse(await readFile(resolve(process.cwd(), "src/data/products.json"), "utf8"));
const banana = catalog.find((p) => p.slug === "kit-banana-e-mel");
if (!banana?.variants?.[0]?.label) throw Error("Missing local catalog fixture");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 900 ? 820 : 844 },
      serviceWorkers: "block",
    });
    let blocked = 0;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1" || url.protocol === "data:") await route.continue();
      else { blocked++; await route.abort(); }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const result = { width, passed: false };
    try {
      const response = await page.goto(origin + "/produto/kit-cachos", { waitUntil: "domcontentloaded", timeout: 20000 });
      if (response?.status() !== 200) throw Error("Source product HTTP " + response?.status());
      await page.getByRole("heading", { level: 1, name: /Kit Cachos/i }).waitFor();
      // In a CPU-heavy local dev run, markup may render before hydration finishes.
      // Retry the synthetic selection rather than reporting a user-facing regression.
      const selectThree = page.getByRole("radio", { name: /Leve 3 unidades/i });
      for (let attempt = 0; attempt < 3; attempt++) {
        await selectThree.click();
        try {
          await page.waitForFunction(() => document.querySelector('[data-testid="qty"]')?.textContent?.trim() === "3", null, { timeout: 3000 });
          break;
        } catch (error) {
          if (attempt === 2) throw error;
          await page.waitForTimeout(600);
        }
      }
      const sizeButtons = page.locator("text=Tamanho").locator("..").locator("button");
      if (await sizeButtons.count() > 1) await sizeButtons.nth(1).click();
      await page.screenshot({ path: resolve(folder, "before-" + width + ".png") });

      const link = page.locator('a[href="/produto/kit-banana-e-mel"]').last();
      await link.waitFor({ timeout: 10000 });
      await link.click();
      await page.waitForURL("**/produto/kit-banana-e-mel", { timeout: 10000 });
      await page.getByRole("heading", { level: 1, name: /Kit Banana e Mel/i }).waitFor();
      const qtyAfter = (await page.locator('[data-testid="qty"]').textContent())?.trim();
      result.quantityAfterSwitch = qtyAfter;
      await page.screenshot({ path: resolve(folder, "after-" + width + ".png") });
      if (qtyAfter !== "1") throw Error("Quantity from old product carried over: " + qtyAfter);
      const fav = page.getByRole("button", { name: /Adicionar Kit Banana e Mel aos favoritos/i });
      await fav.waitFor({ timeout: 6000 });
      if ((await fav.getAttribute("aria-pressed")) !== "false") throw Error("Favorite state not declared");
      await fav.click();
      await page.getByRole("button", { name: /Remover Kit Banana e Mel dos favoritos/i }).waitFor();
      if ((await page.getByRole("button", { name: /Remover Kit Banana e Mel dos favoritos/i }).getAttribute("aria-pressed")) !== "true") throw Error("Favorites toggle not announced");
      result.favoriteAccessibleToggle = true;
      await page.screenshot({ path: resolve(folder, "favorited-" + width + ".png") });
      const plus = page.getByRole("button", { name: /Aumentar quantidade de Kit Banana e Mel/i });
      const minus = page.getByRole("button", { name: /Diminuir quantidade de Kit Banana e Mel/i });
      const targets = await Promise.all([plus, minus].map(async (button) => button.boundingBox()));
      result.quantityTouchTargets = targets.map((box) => ({ width: box?.width, height: box?.height }));
      if (targets.some((box) => !box || box.width < 44 || box.height < 44)) throw Error("Quantity controls have <44px touch area");

      // Synthetic local cart only. Never use the payment provider, checkout POST or a real customer account.
      await page.evaluate(({ slug, variant }) => {
        localStorage.setItem("vonix-cart", JSON.stringify([{ slug, variant, qty: 1 }]));
      }, { slug: banana.slug, variant: banana.variants[0].label });
      await page.goto(origin + "/carrinho", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Carrinho" }).waitFor();
      await page.getByRole("button", { name: /Aumentar quantidade de Kit Banana e Mel/i }).waitFor();
      const sticky = page.locator('[role="region"][aria-label="Resumo do carrinho no celular"]');
      if (width < 900) {
        await sticky.waitFor({ state: "visible" });
        const initial = (await sticky.innerText()).replace(/\s+/g, " ");
        if (!initial.includes("Produtos, sem frete") || !initial.includes("R$"))
          throw Error("Mobile sticky purchase subtotal missing or misleading");
        const beforeIncrease = await sticky.textContent();
        await page.getByRole("button", { name: /Aumentar quantidade de Kit Banana e Mel/i }).click();
        await page.waitForFunction((oldText) => document.querySelector('[aria-label="Resumo do carrinho no celular"]')?.textContent !== oldText, beforeIncrease, { timeout: 9000 });
        const changed = await sticky.innerText();
        if (!changed.includes("Produtos, sem frete")) throw Error("Mobile sticky total lost its shipping caveat");
        result.mobileStickySubtotalChanges = true;
        const stickyBox = await sticky.boundingBox();
        if (!stickyBox || stickyBox.width > width + 1) throw Error("Mobile checkout CTA overflows");
      } else if (await sticky.isVisible()) {
        throw Error("Mobile cart CTA should be hidden on desktop");
      }
      await page.screenshot({ path: resolve(folder, "cart-" + width + ".png") });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow || errors.length) throw Error("Overflow or page JS errors " + JSON.stringify({overflow,errors}));
      result.passed = true;
    } catch (error) {
      result.error = String(error);
    } finally {
      result.blockedExternalRequests = blocked;
      result.pageErrors = errors;
      results.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  purpose: "C22: navigate between two real product pages without carrying old quantity; announce favorites and 44px touch targets",
  date: "2026-11-10",
  environment: "localhost synthetic; external requests blocked; no payments or orders",
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(folder, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
