import { chromium } from "playwright";
async function main(){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"support@neyo.co.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/settings/school",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(2500);
 await page.getByText("My Liquid Glass Intensity").scrollIntoViewIfNeeded().catch(()=>{});
 await page.locator('input[type="range"]').first().evaluate((el:any)=>{el.value=85; el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForTimeout(500);
 await page.screenshot({path:"screenshots/i81-liquid-glass-intensity-slider.png",fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i81-liquid-glass-intensity-slider.png");
}
main();
