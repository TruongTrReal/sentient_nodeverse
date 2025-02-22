import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// NEW: Generic click helper function
async function safeClick(page, selector) {
  await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (element) {
      element.click();
    } else {
      throw new Error(`Element not found: ${sel}`);
    }
  }, selector);
}

async function copyRecoveryPhrase(page) {
  try {
    const chipElements = await page.$$('[data-testid^="recovery-phrase-chip-"]');
    const phrases = await Promise.all(chipElements.map(async (chipElement) => {
      const text = await chipElement.evaluate(node => node.textContent.trim());
      return text;
    }));

    const recoveryPhrase = phrases.join(" ");
    const outputDir = path.join(__dirname, "./output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const filePath = path.join(outputDir, "recovery_phrase.txt");
    fs.writeFileSync(filePath, recoveryPhrase, "utf8");

    return phrases;
  } catch (error) {
    console.error("Error copying recovery phrase:", error);
  }
}

async function fillRecoveryInputsWithClickAndSendKeys(page, recoveryKeyArray) {
  try {
    const inputElements = await page.$$('[data-testid^="recovery-phrase-input-"]');

    for (let i = 0; i < inputElements.length; i++) {
      const word = recoveryKeyArray[i];
      // MODIFIED: Use JavaScript click
      await page.evaluate((element) => element.click(), inputElements[i]);
      await inputElements[i].focus();
      await inputElements[i].type(word);
    }
  } catch (error) {
    console.error("Error filling recovery inputs:", error);
  }
}

class MtmService {
  constructor() {
    this.mtm_config = {
      loginUrl: 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#onboarding/welcome',
      selectors: {
        // MODIFIED: Converted XPaths to CSS selectors
        agreeCheckbox: `agreeCheckbox: '.onboarding__terms-checkbox input[type="checkbox"]'`,
        createWalletButton: 'button[data-testid="onboarding-create-wallet"]',
        importWalletButton: 'button[data-testid="onboarding-import-wallet"]',
        agreeCheckbox2: '#metametrics-opt-in',
        iagreeButton: 'button.btn-primary',
        passwordInput: 'input[type="password"]:first-of-type',
        passwordRepeatInput: 'input[type="password"]:last-of-type',
        iunderstandCheckbox: 'input[type="checkbox"]',
        createNewWalletButton: 'button[data-testid="create-new-vault-submit"]',
        secureMyWalletButton: 'button:has-text("Secure my wallet")',
        revealMySecretButton: 'button:has-text("Reveal secret")',
        nextButton: 'button:has-text("Next")',
        confirmButton: 'button:has-text("Confirm")',
        doneButton: 'button:has-text("Done")',
        mainetText: 'p:has-text("Mainnet")'
      }
    }
  }

  async setupNewWallet(page) {
    try {
      const { loginUrl, selectors } = this.mtm_config;
      await page.goto(loginUrl);

      // MODIFIED: All clicks use safeClick
      await safeClick(page, selectors.agreeCheckbox);
      await safeClick(page, selectors.createWalletButton);
      await safeClick(page, selectors.agreeCheckbox2);
      await page.waitForSelector(selectors.iagreeButton);
      await safeClick(page, selectors.iagreeButton);

      await page.type(selectors.passwordInput, "Rtn@2024");
      await page.type(selectors.passwordRepeatInput, "Rtn@2024");
      await safeClick(page, selectors.iunderstandCheckbox);
      await safeClick(page, selectors.createNewWalletButton);

      await page.waitForSelector(selectors.secureMyWalletButton);
      await safeClick(page, selectors.secureMyWalletButton);
      await safeClick(page, selectors.revealMySecretButton);

      const recoveryKeyArray = await copyRecoveryPhrase(page);
      await safeClick(page, selectors.nextButton);
      await fillRecoveryInputsWithClickAndSendKeys(page, recoveryKeyArray);
      await safeClick(page, selectors.confirmButton);
      await safeClick(page, selectors.doneButton);
      await safeClick(page, selectors.nextButton);
      await safeClick(page, selectors.doneButton);
      await page.waitForSelector(selectors.mainetText);

      await browser.close();
      return true;
    } catch (error) {
      console.error("Mtm setup failed:", error);
      return false;
    }
  }

  async lockMetamask(page) {
    try {
      // MODIFIED: CSS selector version
      await safeClick(page, 'span[data-testid="account-menu-icon"]');
      await safeClick(page, 'div[data-testid="global-menu-lock"]');
    } catch (error) {
      console.error("Error locking MetaMask:", error);
    }
  }

  async confirm_any(page) {
    try {
      const timeout = 10; // timeout in seconds
      const startTime = Date.now();

      while (Date.now() - startTime < timeout * 1000) {
        const pages = await browser.pages();
        
        for (const popup of pages) {
          const url = popup.url();
          if (url.includes("notification.html")) {
            await popup.bringToFront();
            
            // Use CSS selector for confirmation buttons
            await safeClick(popup, 'button[data-testid="page-container-footer-next"]');
            await popup.waitForTimeout(500);
            
            // If multiple confirmations needed
            const confirmButton = await popup.$('button:has-text("Confirm")');
            if (confirmButton) {
              await safeClick(popup, 'button:has-text("Confirm")');
            }
            
            await popup.close();
            await page.bringToFront();
            return;
          }
        }
        await page.waitForTimeout(500);
      }
    } catch (error) {
      console.error("Error confirming popup:", error);
    }
  }

  async setupOldWallet(page, seedPhrases) {
    try {
      const { loginUrl, selectors } = this.mtm_config;
      await page.goto(loginUrl);

      const currentUrl = page.url();
      if (currentUrl.endsWith("#unlock")) {
        // MODIFIED: Use CSS selector for "Import using recovery phrase"
        await safeClick(page, 'a[data-testid="unlock-page-import-link"]');
        
        await this.fillImportSrpRecoveryWords(page, seedPhrases);
        
        await page.type(selectors.passwordInput, "Rtn@2024");
        await page.type(selectors.passwordRepeatInput, "Rtn@2024");
        await safeClick(page, selectors.createNewWalletButton);
        
        await safeClick(page, selectors.doneButton);
        await safeClick(page, selectors.nextButton);
        await safeClick(page, selectors.doneButton);
        await page.waitForSelector(selectors.mainetText);
      } else {
        await safeClick(page, selectors.agreeCheckbox);
        await safeClick(page, selectors.createWalletButton);

        await page.waitForSelector(selectors.importWalletButton);
        await safeClick(page, selectors.importWalletButton);

        await safeClick(page, selectors.agreeCheckbox2);
        await page.waitForSelector(selectors.iagreeButton);
        await safeClick(page, selectors.iagreeButton);

        await this.fillImportSrpRecoveryWords(page, seedPhrases);
        await safeClick(page, selectors.confirmSecretInputButton);

        await page.type(selectors.passwordInput, "Rtn@2024");
        await page.type(selectors.passwordRepeatInput, "Rtn@2024");
        await safeClick(page, selectors.iunderstandCheckbox);
        await safeClick(page, selectors.createNewWalletButton);

        await safeClick(page, selectors.doneButton);
        await safeClick(page, selectors.nextButton);
        await safeClick(page, selectors.doneButton);
        await page.waitForSelector(selectors.mainetText);
      }

      await browser.close();
      return true;
    } catch (error) {
      console.error("Mtm setup failed:", error);
      return false;
    }
  }

  // Helper method for seed phrase entry
  async fillImportSrpRecoveryWords(page, seedPhrases) {
    try {
      const inputs = await page.$$('input[data-testid="import-srp__srp-word"]');
      
      for (let i = 0; i < inputs.length; i++) {
        await page.evaluate((element) => element.click(), inputs[i]);
        await inputs[i].type(seedPhrases[i]);
      }
    } catch (error) {
      console.error("Error entering recovery words:", error);
    }
  }
}


export default MtmService;