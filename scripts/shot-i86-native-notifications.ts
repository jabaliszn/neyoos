import { chromium } from "playwright";
async function main(){
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}, permissions: []});
 const page=await context.newPage();
 await page.goto("http://localhost:3000/login",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.setItem("neyo-cookie-ack",new Date().toISOString()));
 await page.request.post("http://localhost:3000/api/auth/password/login",{data:{email:"principal@karibuhigh.ac.ke",password:"Karibu2026!"}});
 await page.goto("http://localhost:3000/dashboard",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(1800);
 await page.getByRole("button", { name: "Notifications" }).last().click();
 await page.waitForTimeout(600);
 await page.screenshot({path:"screenshots/i86-native-notification-opt-in.png",fullPage:false});
 await browser.close();
 console.log("✓ screenshots/i86-native-notification-opt-in.png");
}
main();
