const { chromium } = require('playwright');
(async () => {
  try {
    const browser = await chromium.launch();
    console.log("SUCCESSFULLY LAUNCHED PLAYWRIGHT!");
    await browser.close();
  } catch (err) {
    console.error("ERROR LAUNCHING PLAYWRIGHT:", err);
  }
})();
