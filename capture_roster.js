const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

// Helper to wait for a port to become ready
function waitForPort(port, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        clearInterval(interval);
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error(`Port ${port} not ready within timeout`));
        }
      });
    }, 1000);
  });
}

(async () => {
  console.log("Starting Next.js development server...");
  const devServer = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: '3000' }
  });

  try {
    // Wait for Next.js to start
    console.log("Waiting for server on port 3000 to become responsive...");
    await waitForPort(3000, 90000);
    console.log("Server is ready! Launching Playwright...");

    const browser = await chromium.launch({
      headless: true
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    console.log("Navigating to login page...");
    await page.goto('http://localhost:3000/login?tenant=karibu-high');
    await page.waitForTimeout(2000);

    console.log("Switching to email/password login...");
    await page.click('text="Sign in with email & password"');

    console.log("Filling in Principal credentials...");
    await page.fill('input[id="email"]', 'principal@karibuhigh.ac.ke');
    await page.fill('input[id="password"]', 'Karibu2026!');

    console.log("Submitting login form...");
    await page.click('button[type="submit"]');

    console.log("Waiting for navigation to dashboard...");
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(2000);

    console.log("Navigating directly to Academics...");
    await page.goto('http://localhost:3000/academics');
    await page.waitForTimeout(3000);

    console.log("Clicking 'Duty Roster' tab...");
    await page.click('text="Duty Roster"');
    await page.waitForTimeout(2000);

    console.log("Clicking 'Compile Conflict-Free Duty Roster' button...");
    await page.click('text="Compile Conflict-Free Duty Roster"');
    await page.waitForTimeout(3000); // Wait for roster to animate and render

    console.log("Taking screenshot of the Teachers Duty Roster...");
    await page.screenshot({ path: '../duty_roster_screenshot.png', fullPage: false });
    console.log("Screenshot successfully saved as /home/user/duty_roster_screenshot.png!");

    await browser.close();
  } catch (error) {
    console.error("An error occurred during execution:", error);
  } finally {
    console.log("Shutting down the development server...");
    devServer.kill();
    process.exit(0);
  }
})();
