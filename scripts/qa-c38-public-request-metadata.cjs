// C38: public network metadata audit. GET-only, no request payload or identity collected.
const {
  chromium,
} = require("C:/Users/JL/AppData/Roaming/npm/node_modules/autonomousmcp/node_modules/playwright");
const origin = "https://vonixhair.com";
const paths = [
  "/seja-afiliada",
  "/consultar-candidatura",
  "/acesso-equipe-afiliadas",
  "/admin/afiliadas",
];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    for (const path of paths) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const blocked = [],
        jsErrors = [];
      page.on("pageerror", (e) => jsErrors.push(String(e.message).slice(0, 130)));
      await page.route("**/*", (r) => {
        const request = r.request(),
          url = new URL(request.url());
        if (request.method() !== "GET") {
          // pathname only: never log cookies, tokens, query, POST content or headers.
          blocked.push({
            method: request.method(),
            sameOrigin: url.origin === origin,
            path: url.pathname,
          });
          return r.abort();
        }
        if (url.origin !== origin && !request.url().startsWith("data:")) return r.abort();
        return r.continue();
      });
      try {
        const response = await page.goto(origin + path, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(1000);
        console.log(JSON.stringify({ path, http: response?.status(), blocked, jsErrors }));
      } catch (e) {
        console.log(
          JSON.stringify({ path, error: String(e.message).slice(0, 130), blocked, jsErrors }),
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("BROWSER_FAILED");
  process.exitCode = 1;
});
