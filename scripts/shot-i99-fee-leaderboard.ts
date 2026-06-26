import { chromium } from "playwright";
async function main(){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"bursar@karibuhigh.ac.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/finance",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(2500);
 await page.getByText("Fee collection leaderboard").scrollIntoViewIfNeeded().catch(()=>{});
 await page.waitForTimeout(500);
 await page.screenshot({path:"screenshots/i99-fee-collection-leaderboard.png",fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i99-fee-collection-leaderboard.png");
}
main();
