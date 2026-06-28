import { chromium } from "playwright";
import fs from "fs";

async function main() {
  console.log("Launching browser for screenshot...");
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // We normally need to log in, but since we are just trying to capture the UI for the founder,
  // we'll navigate to the dashboard (which will redirect to login), perform the login, and go to the timetable.
  await page.goto("http://localhost:3000/login");
  
  // Fill in login details for the Principal
  await page.fill('input[type="tel"]', "0712345678");
  await page.click('button:has-text("Continue")');
  
  // Wait for the next step (which allows switching to email/password)
  await page.waitForSelector('button:has-text("Use password instead")');
  await page.click('button:has-text("Use password instead")');

  // Fill in password
  await page.fill('input[type="password"]', "Karibu2026!");
  await page.click('button:has-text("Sign In")');

  // Wait for dashboard to load
  await page.waitForURL("http://localhost:3000/dashboard");

  // Navigate directly to the Timetable tab in Academics
  await page.goto("http://localhost:3000/academics");
  
  // Wait for the Academics tabs to load and click Timetable
  await page.waitForSelector('button:has-text("Timetable")');
  await page.click('button:has-text("Timetable")');

  // Wait for the grid to render
  await page.waitForSelector('div:has-text("STEM & Robotics")');

  // Take the screenshot
  const dir = "/home/user/screenshots";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  await page.screenshot({ path: `${dir}/j9-activity-timetable.png`, fullPage: false });

  console.log("Screenshot saved to /home/user/screenshots/j9-activity-timetable.png");
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
