import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const OUT = "screenshots/i42-id-document-design.png";
async function main() {
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await page.goto(`${BASE}/login`,{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.evaluate(async()=>{await fetch("/api/auth/password/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"})});});
 await page.goto(`${BASE}/students`,{waitUntil:"domcontentloaded"});
 await page.waitForSelector("text=Students",{timeout:20000});
 await page.getByRole("button", { name: /Bulk ID Cards/i }).click().catch(async()=>{ await page.getByText(/ID Cards/i).first().click(); });
 await page.waitForSelector("text=Customize & Print ID Cards",{timeout:15000});
 await page.waitForTimeout(800);
 await page.screenshot({path:OUT,fullPage:false});
 await browser.close();
 console.log(`✓ captured ${OUT}`);
}
main().catch(e=>{console.error(e);process.exit(1);});
