import { chromium } from "playwright";

async function main(){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/settings/security",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(1800);
 await page.getByText("Device App Unlock").scrollIntoViewIfNeeded().catch(()=>{});
 await page.evaluate(() => window.scrollBy(0, 260));
 await page.waitForTimeout(500);
 await page.screenshot({path:"screenshots/i80-device-app-unlock-settings.png",fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i80-device-app-unlock-settings.png");
}
main();
