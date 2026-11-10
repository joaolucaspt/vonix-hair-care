import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.APPDATA ? resolve(process.env.APPDATA,"npm/node_modules/autonomousmcp/node_modules/playwright") : "playwright");
const root="http://127.0.0.1:43972";
const dest=resolve(process.cwd(),"qa-artifacts/vonix-c24",process.env.VONIX_C24_PHASE??"red");
await mkdir(dest,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const report={goal:"C24 keyboard accessible global menu, focus restoration, keyboard trap, scroll lock and safe navigation; no checkout calls",views:[],passed:0,failed:0,externalBlocked:true,noPayments:true};
try{
for(const width of [320,390,1366]){
 const context=await browser.newContext({viewport:{width,height:width>=1000?820:844},serviceWorkers:"block"});
 let blocked=0;const jsErrors=[];
 await context.route("**/*", async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==="127.0.0.1"||u.protocol==="data:") await route.continue();else{blocked++;await route.abort();}
 });
 const page=await context.newPage();page.on("pageerror",e=>jsErrors.push(e.message));
 const r={width,passed:false};
 try{
  const response=await page.goto(root+"/loja?categoria=kits",{waitUntil:"domcontentloaded",timeout:20000});
  if(response?.status()!==200)throw Error("shop HTTP "+response?.status());
  await page.getByRole("heading",{level:1,name:"Kits"}).waitFor();
  await page.waitForTimeout(1400);
  const opener=page.getByRole("button",{name:"Abrir menu"});
  await opener.click();
  await page.getByRole("button",{name:"Fechar menu"}).waitFor();
  await page.screenshot({path:resolve(dest,"open-"+width+".png")});
  const dialog=page.getByRole("dialog",{name:"Menu rápido"});
  if(await dialog.count()!==1)throw Error("Menu lacks accessible dialog role/name");
  const focused=await page.evaluate(()=>document.activeElement?.getAttribute("aria-label")||document.activeElement?.tagName);
  r.initialFocus=focused;
  if(focused!=="Fechar menu")throw Error("Menu opens with focus outside close button: "+focused);
  const overflow=await page.evaluate(()=>({body:document.body.style.overflow,html:document.documentElement.scrollWidth>innerWidth+1}));
  r.scrollLock=overflow.body;
  if(overflow.body!=="hidden")throw Error("Menu leaves body scroll unlocked");
  await page.keyboard.press("Shift+Tab");
  const trapped=await page.evaluate(()=>document.querySelector('[role="dialog"]')?.contains(document.activeElement));
  if(!trapped)throw Error("Shift+Tab escapes menu focus trap");
  await page.keyboard.press("Escape");
  await dialog.waitFor({state:"detached",timeout:3000});
  const restored=await opener.evaluate(el=>document.activeElement===el);
  if(!restored)throw Error("Focus is not restored to menu opener on Escape");
  if(await page.evaluate(()=>document.body.style.overflow)!=="")throw Error("Body lock remains after closing menu");
  await opener.click();
  await dialog.getByRole("link",{name:"Kits"}).click();
  await page.waitForURL(url=>url.pathname==="/loja"&&url.searchParams.get("tiposProduto")==="Kits",{timeout:7000});
  await dialog.waitFor({state:"detached",timeout:3500});
  await page.getByRole("heading",{level:1,name:"Kits"}).waitFor();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error("Horizontal overflow");
  if(jsErrors.length)throw Error("Page JS errors: "+jsErrors.join("; "));
  await page.screenshot({path:resolve(dest,"navigation-"+width+".png")});
  // A visitor entering directly on a product page has no reliable in-app
  // history. There must still be a deterministic route to the store.
  await page.goto(root+"/produto/kit-banana-e-mel",{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{level:1,name:/Kit Banana e Mel/i}).waitFor();
  await page.getByRole("link",{name:"Explorar loja"}).click();
  await page.waitForURL(url=>url.pathname==="/loja",{timeout:7000});
  await page.getByRole("heading",{level:1,name:"Todos os Produtos"}).waitFor();
  if(jsErrors.length)throw Error("Product return JS errors: "+jsErrors.join("; "));
  await page.screenshot({path:resolve(dest,"return-to-store-"+width+".png")});
  r.safeDirectProductReturn=true;
  r.passed=true;
 }catch(e){r.error=String(e);}finally{
   r.blockedExternal=blocked;r.jsErrors=jsErrors;report.views.push(r);if(r.passed)report.passed++;else report.failed++;await context.close();
 }
}
}finally{await browser.close();}
await writeFile(resolve(dest,"report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
