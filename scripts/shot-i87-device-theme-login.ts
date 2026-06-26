import { chromium } from "playwright";
async function main(){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, colorScheme:"dark", deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>{ localStorage.removeItem("neyo-theme"); localStorage.setItem("neyo-cookie-ack",new Date().toISOString()); });
 await page.reload({waitUntil:"domcontentloaded"});
 await page.waitForTimeout(1200);
 await page.screenshot({path:"screenshots/i87-login-follows-device-dark.png",fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i87-login-follows-device-dark.png");
}
main();
