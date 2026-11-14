// C40 GET-only local browser proof. No real applicant data, no external ViaCEP call.
const {
  chromium,
} = require("C:/Users/JL/AppData/Roaming/npm/node_modules/autonomousmcp/node_modules/playwright");
const origin = process.env.QA_ORIGIN || "http://127.0.0.1:5414";
const clean = {
  logradouro: "Rua do CEP Atual",
  bairro: "Bairro Exemplo",
  localidade: "Contagem",
  uf: "MG",
};
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let failed = 0;
  try {
    for (const width of [390, 1365]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      let pendingRoute = null;
      let lookups = 0;
      let nonGet = 0;
      page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));
      await page.route("**/*", async (route) => {
        const req = route.request();
        if (req.method() !== "GET") {
          nonGet++;
          return route.abort();
        }
        const url = req.url();
        if (url.startsWith("https://viacep.com.br/ws/")) {
          lookups++;
          if (lookups === 1) {
            pendingRoute = route;
            return;
          }
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(clean),
          });
        }
        if (url.startsWith(origin + "/") || url.startsWith("data:")) return route.continue();
        return route.abort();
      });
      try {
        const response = await page.goto(origin + "/seja-afiliada", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        // When recruitment is intentionally closed, open the non-submitting preview.
        // Never enable a real signup or use applicant data just for a browser test.
        if (!(await page.locator("#simple-postalCode").count())) {
          await page
            .getByRole("button", { name: /Visualizar formulário \(prévia\)/ })
            .click({ timeout: 10000 });
        }
        await page.locator("#simple-postalCode").fill("30110012", { timeout: 10000 });
        await page.getByRole("button", { name: "Buscar CEP" }).click({ timeout: 10000 });
        for (let n = 0; n < 90 && !pendingRoute; n++) await page.waitForTimeout(75);
        if (!pendingRoute) throw Error("CEP request never started");
        await page.evaluate(() => {
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden",
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await pendingRoute.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logradouro: "Rua Obsoleta",
            bairro: "Antigo",
            localidade: "Belo Horizonte",
            uf: "MG",
          }),
        });
        await page.waitForTimeout(260);
        const staleStreet = await page.locator("#simple-street").inputValue();
        const staleCity = await page.locator("#simple-city").inputValue();
        await page.evaluate(() => {
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
          });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.getByRole("button", { name: "Buscar CEP" }).click({ timeout: 9000 });
        await page.waitForFunction(
          () => document.querySelector("#simple-street")?.value === "Rua do CEP Atual",
          { timeout: 10000 },
        );
        const finalStreet = await page.locator("#simple-street").inputValue();
        const ok =
          response?.status() === 200 &&
          !staleStreet &&
          !staleCity &&
          finalStreet === clean.logradouro &&
          lookups === 2 &&
          nonGet === 0 &&
          errors.length === 0;
        if (!ok) failed++;
        console.log(
          JSON.stringify({
            width,
            http: response?.status(),
            staleStreet,
            staleCity,
            finalStreet,
            lookups,
            blockedWrites: nonGet,
            errors,
            ok,
          }),
        );
      } catch (e) {
        failed++;
        console.log(
          JSON.stringify({
            width,
            failed: String(e.message).slice(0, 180),
            lookups,
            blockedWrites: nonGet,
            errors,
          }),
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ total: 2, passed: 2 - failed, failed, strictGetOnly: true }));
  if (failed) process.exitCode = 1;
})().catch((e) => {
  console.error(String(e.message));
  process.exitCode = 1;
});
