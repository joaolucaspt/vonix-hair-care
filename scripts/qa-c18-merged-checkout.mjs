import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const root = process.cwd();
const modulePath = process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright";
const { chromium } = require(modulePath);
const base = process.env.VONIX_C18_ORIGIN ?? "http://127.0.0.1:43972";
const output = resolve(root, "qa-artifacts/vonix-c18", process.env.VONIX_C18_LABEL ?? "dev");
await mkdir(output, { recursive: true });
const outcomes = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [320, 390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 900 ? 820 : 844 },
      serviceWorkers: "block",
    });
    let externalBlocked = 0;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.hostname === "127.0.0.1") {
        await route.continue();
      } else {
        externalBlocked += 1;
        await route.abort();
      }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message)));
    const step = { viewport: width, passed: false, pageErrors: errors, externalBlocked };
    try {
      const product = await page.goto(base + "/produto/kit-banana-e-mel", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (product?.status() !== 200) throw new Error("PDP HTTP " + product?.status());
      await page.getByRole("heading", { name: /banana e mel/i }).first().waitFor();
      await page.waitForTimeout(1600); // dev hydration; do not trigger a payment API.
      if (width === 320) {
        await page.getByRole("button", { name: "Recusar opcionais" }).click();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1100);
      }
      const buyButton = width === 320
        ? page.getByRole("button", { name: "Comprar agora" }).last()
        : page.getByRole("button", { name: "Comprar agora" }).first();
      await buyButton.click({ timeout: 8000 });
      const drawer = page.getByRole("dialog", { name: "Item adicionado" });
      await drawer.waitFor({ state: "visible", timeout: 8000 });
      const content = await drawer.innerText();
      if (!content.includes("Disponibilidade, valor e prazo sujeitos à cotação do CEP")) {
        throw new Error("Shipping quote qualification missing");
      }
      if (content.includes("Você ganhou frete grátis!")) {
        throw new Error("Unverified free shipping promise");
      }
      const quantity = drawer.getByRole("button", { name: /Aumentar quantidade de/ }).first();
      await quantity.click();
      await page.screenshot({ path: resolve(output, "drawer-" + width + ".png") });
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden", timeout: 4000 });
      await buyButton.click({ timeout: 8000 });
      await drawer.waitFor({ state: "visible", timeout: 4000 });
      await drawer.getByRole("button", { name: /Diminuir quantidade de/ }).first().click();
      await drawer.getByRole("button", { name: /Diminuir quantidade de/ }).first().click();
      await drawer.getByRole("button", { name: /Ir para o pagamento/ }).click({ timeout: 8000 });
      await page.waitForURL("**/checkout", { timeout: 12000 });
      await page.getByRole("heading", { name: /Finalizar compra/i }).waitFor();
      const editBag = page.getByRole("link", { name: "Editar sacola" });
      await editBag.waitFor({ state: "visible" });
      if (width <= 390) {
        const quick = page.getByText("Resumo rápido da compra");
        await quick.waitFor({ state: "visible" });
        const summary = await quick.locator("..").locator("..").innerText();
        if (!summary.includes("Frete calculado pelo CEP")) {
          throw new Error("Mobile checkout must disclose missing shipping quotation");
        }
        step.quickSummary = true;
      }
      const unsafePayment = page.getByRole("button", { name: /Gerar Pix/ });
      if (await unsafePayment.isEnabled()) throw new Error("Payment enabled without CEP quote");
      const totalBefore = await page.getByTestId("summary").innerText();
      if (!totalBefore.includes("Informe o CEP")) throw new Error("Missing explicit shipping caveat");
      await page.getByRole("button", { name: "Tem um cupom?" }).click();
      const couponInput = page.getByRole("textbox", { name: "Código do cupom" });
      await couponInput.fill("BEMVINDA5");
      await couponInput.press("Enter");
      await page.getByText(/Cupom ativo: BEMVINDA5/).waitFor({ state: "visible", timeout: 7000 });
      if (await unsafePayment.isEnabled()) throw new Error("Coupon Enter opened payment without quote");
      step.couponEnterAppliedWithoutPayment = true;
      await page.screenshot({ path: resolve(output, "checkout-" + width + ".png") });
      await editBag.click();
      await page.waitForURL("**/carrinho", { timeout: 12000 });
      if (!(await page.getByText(/Banana e Mel/i).count())) throw new Error("Cart items lost on return");
      const quantityButton = page.getByRole("button", { name: /Aumentar quantidade de .*Banana e Mel/i }).first();
      const removeButton = page.getByRole("button", { name: /Remover .*Banana e Mel/i }).first();
      for (const control of [quantityButton, removeButton]) {
        const box = await control.boundingBox();
        if (!box || box.width < 43.5 || box.height < 43.5) {
          throw new Error("Cart control touch target below 44px: " + JSON.stringify(box));
        }
      }
      await quantityButton.click();
      step.cartTouchTargets44px = true;
      await page.screenshot({ path: resolve(output, "cart-" + width + ".png") });
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /Finalizar compra/i }).waitFor();
      if (!(await page.getByText("Resumo do pedido").count())) {
        const aside = page.locator("aside[aria-label='Resumo do pedido']");
        if (!(await aside.count())) throw new Error("Order summary missing after navigation");
      }
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        cartStored: !!localStorage.getItem("vonix-cart"),
      }));
      if (metrics.overflow || !metrics.cartStored || errors.length) {
        throw new Error("Layout/cart/errors " + JSON.stringify({ metrics, errors }));
      }
      step.passed = true;
      step.metrics = metrics;
      step.externalBlocked = externalBlocked;
    } catch (err) {
      step.error = String(err);
    } finally {
      outcomes.push(step);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  scope: "C18 merged-main ecommerce local checkout/cart smoke, no payment submitted, external network blocked",
  date: "2026-11-09",
  origin: base,
  outcomes,
  passed: outcomes.filter((x) => x.passed).length,
  failed: outcomes.filter((x) => !x.passed).length,
};
await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.failed > 0) process.exitCode = 1;
