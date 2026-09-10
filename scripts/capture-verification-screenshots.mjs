import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = 'http://localhost:3000';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function capture() {
  console.log('Starting Playwright browser capture...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 960 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const pages = [
    { name: '01-india-overview', url: `${BASE_URL}/india`, wait: 5000 },
    { name: '02-city-overview-pune', url: `${BASE_URL}/`, wait: 4000 },
    { name: '03-forecast-timeline', url: `${BASE_URL}/forecast`, wait: 3500 },
    { name: '04-risk-areas-table', url: `${BASE_URL}/risk-areas`, wait: 3500 },
    { name: '05-insights-page', url: `${BASE_URL}/insights`, wait: 3500 },
    { name: '06-how-it-works', url: `${BASE_URL}/how-it-works`, wait: 2500 },
  ];

  for (const p of pages) {
    console.log(`Capturing ${p.name} from ${p.url}...`);
    const page = await context.newPage();
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(p.wait);
      const outPath = path.join(SCREENSHOTS_DIR, `${p.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Saved screenshot: ${outPath}`);
    } catch (err) {
      console.error(`Failed capturing ${p.name}:`, err);
    } finally {
      await page.close();
    }
  }

  // Also capture Bengaluru and Pune on City Overview
  console.log('Capturing City Overview with Pune...');
  const cityPage = await context.newPage();
  try {
    await cityPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await cityPage.waitForTimeout(2000);
    const cityBtn = await cityPage.$('button[aria-label="Select Monitored City"]');
    if (cityBtn) {
      await cityBtn.click();
      await cityPage.waitForTimeout(500);
      const puneOption = await cityPage.$('button:has-text("Pune")');
      if (puneOption) {
        await puneOption.click();
        await cityPage.waitForTimeout(3500);
        await cityPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-city-overview-pune.png'), fullPage: false });
        console.log('Saved Pune screenshot');

        // Switch to Thermal Stress layer
        const thermalBtn = await cityPage.$('button:has-text("Thermal Stress")');
        if (thermalBtn) {
          await thermalBtn.click();
          await cityPage.waitForTimeout(1500);
          await cityPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-city-pune-thermal-stress.png'), fullPage: false });
          console.log('Saved Pune Thermal Stress screenshot');
        }
      }
    }
  } catch (err) {
    console.error('Failed capturing Pune:', err);
  } finally {
    await cityPage.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch(console.error);
