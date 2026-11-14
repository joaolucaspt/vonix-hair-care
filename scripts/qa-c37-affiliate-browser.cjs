// C37: synthetic read-only navigation smoke for the affiliate portal only.
// Blocks EVERY non-GET request and EVERY off-origin request. No auth, PII or real data.
const {
  chromium,
} = require("C:/Users/JL/AppData/Roaming/npm/node_modules/autonomousmcp/node_modules/playwright");
const base = (process.env.QA_DOMAIN || "http://127.0.0.1:5406").replace(/\/$/, "");
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
  let passed = 0,
    failed = 0;
  try {
    for (const width of [390, 1365])
      for (const path of paths) {
        const page = await browser.newPage({ viewport: { width, height: 920 } });
        const errors = [];
        let deniedWrites = 0;
        page.on("pageerror", (error) => errors.push(error.message.slice(0, 140)));
        await page.route("**/*", (route) => {
          const request = route.request(),
            url = request.url();
          if (request.method() !== "GET") {
            deniedWrites++;
            return route.abort();
          }
          if (url.startsWith(base + "/") || url.startsWith("data:")) return route.continue();
          return route.abort();
        });
        try {
          const response = await page.goto(base + path, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });
          await page.waitForTimeout(850);
          const ui = await page.evaluate(() => {
            const footer = document.querySelector("footer");
            const links = Array.from(footer?.querySelectorAll("a") || []);
            const footerHref = (label) =>
              links.find((a) => a.textContent?.trim() === label)?.getAttribute("href") || null;
            return {
              mains: document.querySelectorAll("main").length,
              codeHref: footerHref("Acompanhar inscrição por código"),
              legacyHref: footerHref("Inscrições antigas por e-mail"),
              adminSkip:
                document
                  .querySelector('a[href="#conteudo-admin-afiliadas"]')
                  ?.textContent?.trim() || null,
              adminMain: document.querySelector("main")?.id || "",
              inputMasked:
                document.querySelector("#affiliate-private-code")?.getAttribute("type") || null,
              overflow: document.documentElement.scrollWidth > window.innerWidth + 5,
            };
          });
          const navigationOK =
            path === "/admin/afiliadas"
              ? ui.adminSkip === "Pular para o painel de afiliadas" &&
                ui.adminMain === "conteudo-admin-afiliadas"
              : ui.codeHref === "/consultar-candidatura" &&
                ui.legacyHref === "/acompanhar-inscricao";
          const maskedOK = path !== "/consultar-candidatura" || ui.inputMasked === "password";
          const ok =
            response?.status() === 200 &&
            ui.mains === 1 &&
            navigationOK &&
            maskedOK &&
            !ui.overflow &&
            errors.length === 0 &&
            deniedWrites === 0;
          console.log(
            JSON.stringify({
              width,
              path,
              http: response?.status(),
              ...ui,
              errors,
              deniedWrites,
              ok,
            }),
          );
          if (ok) passed++;
          else failed++;
        } catch (e) {
          failed++;
          console.log(
            JSON.stringify({ width, path, ok: false, error: String(e.message).slice(0, 180) }),
          );
        } finally {
          await page.close();
        }
      }
    console.log(JSON.stringify({ total: passed + failed, passed, failed, strictGetOnly: true }));
    if (failed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("C37_BROWSER_ERROR: " + error.message);
  process.exitCode = 1;
});
