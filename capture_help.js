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

    console.log("Navigating to login page with tenant override...");
    await page.goto('http://localhost:3000/login?tenant=karibu-high', { waitUntil: 'networkidle' });

    console.log("Switching to email/password login...");
    await page.click('text="Sign in with email & password"');

    console.log("Filling in Principal credentials...");
    await page.fill('input[id="email"]', 'principal@karibuhigh.ac.ke');
    await page.fill('input[id="password"]', 'Karibu2026!');

    console.log("Submitting login form...");
    await page.click('button[type="submit"]');

    console.log("Waiting for navigation to dashboard...");
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log("Successfully logged in! Waiting for dashboard to load...");
    await page.waitForTimeout(3000);

    console.log("Opening Keyboard Shortcuts Help Overlay by pressing '?'...");
    await page.keyboard.press('?');
    await page.waitForTimeout(1000); // Wait for modal fade-in animation

    console.log("Taking screenshot of the Help Overlay...");
    await page.screenshot({ path: '../help_screenshot.png', fullPage: false });
    console.log("Screenshot successfully saved as /home/user/help_screenshot.png!");

    await browser.close();
  } catch (error) {
    console.error("An error occurred during execution:", error);
  } finally {
    console.log("Shutting down the development server...");
    devServer.kill();
    process.exit(0);
  }
})();
