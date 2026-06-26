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

    console.log("Navigating to Neyo Ecosystem Marketing Homepage...");
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Wait for animated flowchart to render

    console.log("Taking screenshot of the Marketing Homepage...");
    await page.screenshot({ path: '../neyo_marketing.png', fullPage: false });
    console.log("Screenshot successfully saved as /home/user/neyo_marketing.png!");

    await browser.close();
  } catch (error) {
    console.error("An error occurred during execution:", error);
  } finally {
    console.log("Shutting down the development server...");
    devServer.kill();
    process.exit(0);
  }
})();
