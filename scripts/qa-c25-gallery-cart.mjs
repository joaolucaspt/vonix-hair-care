import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.APPDATA
  ? resolve(process.env.APPDATA, "npm/node_modules/autonomousmcp/node_modules/playwright")
  : "playwright");
const origin = "http://127.0.0.1:43972";
const output = resolve(process.cwd(), "qa-artifacts/vonix-c25", process.env.VONIX_C25_PHASE ?? "red");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({channel:"chrome",headless:true});
const records = [];
try {
  for (const width of [320,390,1366]) {
    const context = await browser.newContext({viewport:{width,height:width>=1000?830:844},serviceWorkers:"block"});
    let blocked=0;const errors=[];const result={width,passed:false};
    await context.route("**/*", async r=>{const url=new URL(r.request().url());if(url.hostname==="127.0.0.1"||url.protocol==="data:")await r.continue();else{blocked++;await r.abort();}});
    const page=await context.newPage();page.on("pageerror",e=>errors.push(String(e.message)));
    try {
      const res=await page.goto(origin+"/produto/kit-banana-e-mel",{waitUntil:"domcontentloaded",timeout:20000});
      if(res?.status()!==200)throw Error("PDP HTTP "+res?.status());
      await page.getByRole("heading",{level:1,name:/Kit Banana e Mel/i}).waitFor();
      await page.waitForTimeout(900);
      await page.waitForTimeout(1400); // Dev SSR hydrates before click interactions work.
      const trigger=page.getByRole("button",{name:/Ampliar imagem de Kit Banana e Mel/i});
      await trigger.click();
      const modal=page.getByRole("dialog",{name:/Kit Banana e Mel: imagem ampliada/i});
      await modal.waitFor();
      await page.screenshot({path:resolve(output,"gallery-open-"+width+".png")});
      const focused=await page.evaluate(()=>document.activeElement?.getAttribute("aria-label")||document.activeElement?.tagName);
      result.initialZoomFocus=focused;
      if(focused!=="Fechar")throw Error("Zoom opens without focus on Fechar: "+focused);
      const close=modal.getByRole("button",{name:"Fechar"});
      const bbox=await close.boundingBox();
      if(!bbox||bbox.width<44||bbox.height<44)throw Error("Zoom close touch target <44px: "+JSON.stringify(bbox));
      if(await page.evaluate(()=>document.body.style.overflow)!=="hidden")throw Error("Zoom does not lock body scrolling");
      await page.keyboard.press("Shift+Tab");
      const trapped=await page.evaluate(()=>document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      if(!trapped)throw Error("Zoom keyboard Shift+Tab leaves dialog");
      await page.keyboard.press("Escape");
      await modal.waitFor({state:"detached"});
      const restored=await trigger.evaluate(el=>document.activeElement===el);
      if(!restored)throw Error("Zoom exit does not return focus to image opener");
      await page.screenshot({path:resolve(output,"gallery-closed-"+width+".png")});

      await page.goto(origin+"/carrinho",{waitUntil:"domcontentloaded"});
      await page.getByRole("heading",{name:"Carrinho",level:1}).waitFor();
      await page.getByRole("heading",{name:"Sua sacola está vazia"}).waitFor({timeout:7000});
      await page.getByRole("link",{name:"Explorar kits"}).waitFor();
      result.cartKitLink = await page.getByRole("link",{name:"Explorar kits"}).getAttribute("href");
      if (!result.cartKitLink?.includes("tiposProduto=Kits")) throw Error("Empty cart kit link lacks Kits filter");
      await page.getByRole("link",{name:"Explorar produtos"}).waitFor();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      if(overflow||errors.length)throw Error("Overflow / JS errors: "+JSON.stringify({overflow,errors}));
      await page.screenshot({path:resolve(output,"cart-empty-"+width+".png")});
      result.passed=true;
    }catch(e){result.error=String(e)}finally{result.blockedExternal=blocked;result.pageErrors=errors;records.push(result);await context.close()}
  }
}finally{await browser.close()}
const report={purpose:"C25 product image zoom keyboard/focus and empty cart discovery, synthetic localhost only",passed:records.filter(x=>x.passed).length,failed:records.filter(x=>!x.passed).length,widths:records,noExternal:true,noPayments:true};
await writeFile(resolve(output,"report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
