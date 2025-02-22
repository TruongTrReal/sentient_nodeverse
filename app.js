import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { connect } from "puppeteer-real-browser";
import proxyChain from "proxy-chain";
import MtmService from "./mtm.js";


async function createDriverWithProxy(proxyUrl) {

  // Process and anonymize the proxy similar to automationManager
  const anonymizedProxyUrl = await proxyChain.anonymizeProxy(`http://${proxyUrl}`);
  const parsedProxy = new URL(anonymizedProxyUrl);
  console.log(`Anonymized proxy URL: ${anonymizedProxyUrl}`);

  // add metamask extension
  const extensionPath = path.resolve("./nkbihfbeogaeaoehlefnkodbefgpgknn/12.12.0_0");
  console.log('extensionPath :>> ', extensionPath);
  const { browser, page } = await connect({ 
    headless: false,

    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--window-size=1920,1080'
    ],

    customConfig: {},

    turnstile: true,

    connectOption: {},

    disableXvfb: false,
    ignoreAllFlags: false,
    proxy:{
        host:parsedProxy.hostname,
        port:parsedProxy.port,
        username:parsedProxy.username,
        password:parsedProxy.password
    }
  });

  return { browser, page };
}

async function clearExtraTabs(page) {
  const pages = await page.browser().pages();
  for (let i = pages.length - 1; i > 0; i--) {
    await pages[i].close();
  }
}

function readLinesFromFile(filePath) {
  return fs
    .readFileSync(path.resolve(filePath), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const seeds = readLinesFromFile("seedphares.txt");
const proxies = readLinesFromFile("proxies.txt");

const count = Math.min(seeds.length, proxies.length);

(async function main() {
  for (let i = 0; i < count; i++) {
    const seed = seeds[i];
    const proxy = proxies[i];
    const seedWords = seed.split(" ");
    console.log(`Starting automation for wallet ${i + 1} using proxy ${proxy}`);

    const { browser, page } = await createDriverWithProxy(proxy);
    await page.setViewport({ width: 1920, height: 1080});
    // await clearExtraTabs(page);

    // await page.locator('body').scroll({
    //   scrollTop: 20,
    // });

    try {
      await new MtmService().setupOldWallet(page, seedWords);
      console.log(`Wallet ${i + 1} setup complete`);

      // await page.goto("https://dobby-arena.sentient.xyz/");
      // console.log(`Navigated wallet ${i + 1} to dobby-arena.sentient.xyz`);

    } catch (error) {
      console.error(`Error processing wallet ${i + 1}:`, error);
    } finally {
      // Optionally, close the browser when done.
      // await browser.close();
    }
  }
})();
