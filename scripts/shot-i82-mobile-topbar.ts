import { chromium, devices } from "playwright";

async function main(){
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({ ...devices["iPhone 13"], locale:"en-KE" });
 const page=await context.newPage();
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/dashboard",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(1800);
 await page.screenshot({path:"screenshots/i82-mobile-topbar-notifier-only.png",fullPage:false});
 const bell = page.locator('button[aria-label="Notifications"]').first();
 await bell.click({force:true});
 await page.waitForTimeout(120);
 await bell.click({force:true});
 await page.waitForTimeout(800);
 await page.screenshot({path:"screenshots/i82-mobile-topbar-expanded.png",fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i82-mobile-topbar-notifier-only.png");
 console.log("✓ screenshots/i82-mobile-topbar-expanded.png");
}
main();
