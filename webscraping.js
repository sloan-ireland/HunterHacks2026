const playwright = require("playwright");
//Reference: 
    //https://github.com/oxylabs/playwright-web-scraping#nodejs
    //https://globalsearch.cuny.edu/CFGlobalSearchTool/CFSearchToolController
    //https://playwright.dev/docs/input
const URL = "https://globalsearch.cuny.edu/CFGlobalSearchTool/CFSearchToolController";

// async function requisite(link) {
//     const browser = await playwright[browserType].launch({ headless: true });
//     const context = await browser.newContext();
//     const page = await context.newPage();
    
//     await page.goto(link);
    
// }

(async () => {
  for (const browserType of ['chromium']) {
    const browser = await playwright[browserType].launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(URL);
    await page.locator('#HTR01').click();


    const courses = await page.$$eval('tr.cursor-pointer', rows => {
      return rows.map(row => {
        const code = row.querySelector('td:nth-child(1)')?.innerText.trim() || 'No Code';
        const link = row.querySelector('td:nth-child(1) a')?.href || 'No Code';        
        const title = row.querySelector('td:nth-child(2)')?.innerText.trim() || 'No Title';
        const credits = row.querySelector('td:nth-child(3)')?.innerText.trim() || 'No Credits';
        const attributes = row.querySelector('td:nth-child(5)')?.innerText.trim() || 'No Attributes';
        return { code, link, title, credits, attributes };
      });
    });

    console.log(courses);
    await browser.close();
  }
})();
