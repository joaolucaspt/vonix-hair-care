import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright"),
);
const origin = process.env.VONIX_C34_ORIGIN ?? "http://127.0.0.1:43976";
const dir = resolve("qa-artifacts/vonix-c34/checkout");
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width >= 900 ? 900 : 844 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    await context.addInitScript(() => {
      try {
        if (!localStorage.getItem("vonix-cart")) {
          localStorage.setItem(
            "vonix-cart",
            JSON.stringify([{ slug: "kit-banana-e-mel", variant: "Kit", qty: 1 }]),
          );
        }
      } catch {}
    });
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      return u.hostname === "127.0.0.1" || u.protocol === "data:"
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const result = { width, passed: false, errors };
    try {
      const response = await page.goto(origin + "/checkout", {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      if (response?.status() !== 200) throw Error("Checkout HTTP " + response?.status());
      await page.waitForFunction(
        () => {
          const title = document.querySelector("h1")?.textContent ?? "";
          return (
            title.includes("Pagamento online indisponível") ||
            title.includes("Não foi possível verificar as formas de pagamento") ||
            (!!document.querySelector("#checkout-form") &&
              !document.querySelector("#checkout-form")?.hasAttribute("inert"))
          );
        },
        null,
        { timeout: 18000 },
      );
      const unavailable = await page
        .getByRole("heading", {
          name: /Pagamento online indisponível|Não foi possível verificar as formas de pagamento/,
        })
        .count();
      if (unavailable) {
        if (await page.locator("#checkout-form").count())
          throw Error("Payment form visible despite no gateway");
        if (await page.getByLabel("CPF").count())
          throw Error("CPF visible despite unavailable payment");
        await page.getByRole("link", { name: "Voltar à sacola" }).waitFor();
        result.state = "no gateway: form unavailable";
      } else {
        const form = page.locator("#checkout-form");
        if ((await form.getAttribute("inert")) !== null)
          throw Error("Payment form was not unlocked after config success");
        result.state = "gateway configured locally: no payment attempted";
      }
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("vonix-cart") || "[]"),
      );
      if (!saved.some((x) => x.slug === "kit-banana-e-mel" && x.qty === 1))
        throw Error("Checkout erased synthetic cart");
      if (errors.length) throw Error("Browser JavaScript error: " + JSON.stringify(errors));
      result.cartPreserved = true;
      result.passed = true;
      await page.screenshot({ path: resolve(dir, "checkout-" + width + ".png") });
    } catch (e) {
      result.error = String(e).slice(0, 400);
    }
    results.push(result);
    await context.close();
  }
} finally {
  await browser.close();
}
const report = {
  checkpoint: "C34",
  scope: "Checkout readiness and cart preservation, never click payment; external blocked",
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  results,
};
await writeFile(resolve(dir, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
