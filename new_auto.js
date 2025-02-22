import test from "node:test";
import puppeteer from 'puppeteer';

test("Puppeteer Extra Plugin", async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--window-size=1920,1080'
    ]
  });
  const page = await browser.newPage();
  await page.goto('https://app.nexus.xyz/');
  await page.evaluate(() => {
    document.querySelector('div[class*="cursor-pointer"].border-gray-400').click();
  });
});