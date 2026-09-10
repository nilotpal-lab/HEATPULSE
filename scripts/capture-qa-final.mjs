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

const VIEWPORTS = [
  { width: 1600, height: 960, suffix: '1600x960' },
  { width: 1920, height: 1080, suffix: '1920x1080' },
];

async function runQACaptures() {
  console.log('='.repeat(70));
  console.log('Starting HeatPulse Final QA Playwright High-Fidelity Capture Suite');
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================================`);
    console.log(`>>> EXECUTING CAPTURES FOR VIEWPORT: ${vp.width}x${vp.height} (${vp.suffix}) <<<`);
    console.log(`======================================================================\n`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Helper to suppress dev overlay badge
    const hideDevOverlay = async (page) => {
      await page.addStyleTag({
        content: `
          nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog-overlay] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `,
      });
    };

    // ------------------------------------------------------------------------
    // 1. /india (Pan-India Overview)
    // ------------------------------------------------------------------------
    console.log(`[1/3] Navigating to /india for ${vp.suffix}...`);
    const indiaPage = await context.newPage();
    try {
      await indiaPage.goto(`${BASE_URL}/india`, { waitUntil: 'networkidle', timeout: 30000 });
      await hideDevOverlay(indiaPage);
      await indiaPage.waitForTimeout(4000); // Allow OpenLayers tiles, India states, and city markers to render

      // Screenshot 1A: India Overview - Semantics Banner & KPI Header View
      const indiaBannerPath = path.join(SCREENSHOTS_DIR, `qa-01-india-overview-semantics-banner-${vp.suffix}.png`);
      await indiaPage.screenshot({ path: indiaBannerPath, fullPage: false });
      console.log(`Saved: ${indiaBannerPath}`);

      // Switch to Thermal Stress layer
      console.log('Switching /india to Thermal Stress layer...');
      const thermalStressBtn = await indiaPage.$('button:has-text("Thermal Stress")');
      if (thermalStressBtn) {
        await thermalStressBtn.click();
        await indiaPage.waitForTimeout(2000);
      }

      // Screenshot 1B: India Map 70%+ Viewport Dominance (Scrolled into view)
      // Confirm neutral slate Bihar (no green cropland bleed-through), deep burgundy West Bengal,
      // and single attribution bar "Basemap: ISRO NRSC Bhuvan WMS".
      console.log('Scrolling to Pan-India Map for 70%+ viewport dominance...');
      await indiaPage.evaluate(() => {
        const mapContainer = document.getElementById('heatpulse-map-container');
        if (mapContainer) {
          const card = mapContainer.closest('.bg-white.rounded-2xl');
          if (card) {
            const topPos = card.getBoundingClientRect().top + window.scrollY - 72;
            window.scrollTo({ top: topPos, behavior: 'instant' });
          }
        }
      });
      await indiaPage.waitForTimeout(2000);

      const indiaMapDominantPath = path.join(SCREENSHOTS_DIR, `qa-01-india-map-70pct-thermal-stress-${vp.suffix}.png`);
      await indiaPage.screenshot({ path: indiaMapDominantPath, fullPage: false });
      console.log(`Saved: ${indiaMapDominantPath}`);

      // Screenshot 1C: India Marker Hover Tooltip
      console.log('Hovering over national city marker (Kolkata)...');
      const markerPixel = await indiaPage.evaluate(() => {
        if (!window.__olMap) return null;
        // Kolkata center: [88.3639, 22.5726] in EPSG:4326
        const lon = 88.3639;
        const lat = 22.5726;
        const x = (lon * 20037508.34) / 180;
        const y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
        const yM = (y * 20037508.34) / 180;
        const pixel = window.__olMap.getPixelFromCoordinate([x, yM]);
        const rect = document.getElementById('heatpulse-map-container')?.getBoundingClientRect();
        if (pixel && rect) {
          return { x: rect.left + pixel[0], y: rect.top + pixel[1] };
        }
        return null;
      });

      if (markerPixel) {
        await indiaPage.mouse.move(markerPixel.x, markerPixel.y);
        await indiaPage.waitForTimeout(1200);
      }
      const indiaMarkerHoverPath = path.join(SCREENSHOTS_DIR, `qa-01-india-marker-hover-${vp.suffix}.png`);
      await indiaPage.screenshot({ path: indiaMarkerHoverPath, fullPage: false });
      console.log(`Saved: ${indiaMarkerHoverPath}`);

      // Helper to hover state polygon by name using OpenLayers geometry interior point
      const hoverStatePolygon = async (page, stateName) => {
        const pixel = await page.evaluate((name) => {
          if (!window.__olMap) return null;
          const map = window.__olMap;
          let targetFeature = null;

          map.getLayers().forEach((layer) => {
            const source = layer.getSource();
            if (source && typeof source.getFeatures === 'function') {
              const features = source.getFeatures();
              for (const f of features) {
                const props = f.getProperties();
                const sName = String(props.NAME_1 || props.name || props.state_name || props.STATE || '').toUpperCase();
                if (sName === name.toUpperCase()) {
                  targetFeature = f;
                  break;
                }
              }
            }
          });

          if (!targetFeature) return null;
          const geom = targetFeature.getGeometry();
          let coord;
          if (geom.getType() === 'MultiPolygon') {
            const polys = geom.getPolygons();
            let maxArea = 0, largest = polys[0];
            polys.forEach((p) => {
              if (p.getArea() > maxArea) { maxArea = p.getArea(); largest = p; }
            });
            coord = largest.getInteriorPoint().getCoordinates();
          } else {
            coord = geom.getInteriorPoint().getCoordinates();
          }

          const pix = map.getPixelFromCoordinate(coord);
          const rect = document.getElementById('heatpulse-map-container')?.getBoundingClientRect();
          if (pix && rect) {
            return { x: rect.left + pix[0], y: rect.top + pix[1] };
          }
          return null;
        }, stateName);

        if (pixel) {
          await page.mouse.move(pixel.x, pixel.y);
          await page.waitForTimeout(1200);
          return true;
        }
        return false;
      };

      // Screenshot 1D: India State Hover Tooltip - Maharashtra (Monitored - Severe/High)
      console.log('Hovering over state polygon (Maharashtra)...');
      const mhHovered = await hoverStatePolygon(indiaPage, 'MAHARASHTRA');
      if (mhHovered) {
        const mhHoverPath = path.join(SCREENSHOTS_DIR, `qa-01-india-hover-maharashtra-${vp.suffix}.png`);
        await indiaPage.screenshot({ path: mhHoverPath, fullPage: false });
        console.log(`Saved: ${mhHoverPath}`);
      }

      // Screenshot 1E: India State Hover Tooltip - West Bengal (Monitored - Severe)
      console.log('Hovering over state polygon (West Bengal)...');
      const wbHovered = await hoverStatePolygon(indiaPage, 'WEST BENGAL');
      if (wbHovered) {
        const wbHoverPath = path.join(SCREENSHOTS_DIR, `qa-01-india-hover-west-bengal-${vp.suffix}.png`);
        await indiaPage.screenshot({ path: wbHoverPath, fullPage: false });
        console.log(`Saved: ${wbHoverPath}`);
      }

      // Screenshot 1F: India State Hover Tooltip - Bihar (Unmonitored Regional Baseline)
      console.log('Hovering over state polygon (Bihar)...');
      const biharHovered = await hoverStatePolygon(indiaPage, 'BIHAR');
      if (biharHovered) {
        const biharHoverPath = path.join(SCREENSHOTS_DIR, `qa-01-india-hover-bihar-${vp.suffix}.png`);
        await indiaPage.screenshot({ path: biharHoverPath, fullPage: false });
        console.log(`Saved: ${biharHoverPath}`);
      }
    } catch (err) {
      console.error(`Error on /india (${vp.suffix}):`, err);
    } finally {
      await indiaPage.close();
    }

    // ------------------------------------------------------------------------
    // 2. / (City Overview)
    // ------------------------------------------------------------------------
    console.log(`\n[2/3] Navigating to / (City Overview) for ${vp.suffix}...`);
    const cityPage = await context.newPage();
    try {
      await cityPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
      await hideDevOverlay(cityPage);
      await cityPage.waitForTimeout(4000); // Allow city data and vector wards to render

      // Screenshot 2A: City Overview - LOD 1 (Clean Boundaries, Zoom 8-12, 20px padding auto-fit, 3-block summary)
      const cityLod1Path = path.join(SCREENSHOTS_DIR, `qa-02-city-overview-lod1-${vp.suffix}.png`);
      await cityPage.screenshot({ path: cityLod1Path, fullPage: false });
      console.log(`Saved: ${cityLod1Path}`);

      // Screenshot 2B: City Overview - Instant Hover Popover on Ward Polygon
      console.log('Hovering on ward polygon for instant tooltip popover...');
      const cityMapContainer = await cityPage.$('#heatpulse-map-container');
      if (cityMapContainer) {
        const box = await cityMapContainer.boundingBox();
        if (box) {
          // Move near center-right where ward polygons are situated
          await cityPage.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.50);
          await cityPage.waitForTimeout(1200);
        }
      }
      const cityHoverPath = path.join(SCREENSHOTS_DIR, `qa-02-city-hover-popover-${vp.suffix}.png`);
      await cityPage.screenshot({ path: cityHoverPath, fullPage: false });
      console.log(`Saved: ${cityHoverPath}`);

      // Screenshot 2C: City Overview - Deep Zoom LOD 2 (Zoom 13.8 with compact labels)
      console.log('Zooming in for LOD 2 deep city zoom with compact labels (Zoom ~13.8)...');
      await cityPage.evaluate(() => {
        if (window.__olMap) {
          window.__olMap.getView().setZoom(13.8);
        }
      });
      await cityPage.waitForTimeout(2500); // Allow OpenLayers style function to render compact labels
      const cityLod2Path = path.join(SCREENSHOTS_DIR, `qa-02-city-lod2-compact-labels-${vp.suffix}.png`);
      await cityPage.screenshot({ path: cityLod2Path, fullPage: false });
      console.log(`Saved: ${cityLod2Path}`);

      // Screenshot 2D: City Overview - Pune Ward 08 Kasba selected with #00f2fe highlight & Drawer open
      console.log('Switching to Pune and selecting Ward 08 Kasba for #00f2fe highlight & 8-Section Drawer...');
      await cityPage.evaluate(async () => {
        if (window.__heatPulseActions) {
          window.__heatPulseActions.setSelectedCity('pune');
          await window.__heatPulseActions.loadCityData('pune');
          window.__heatPulseActions.setSelectedWard('Admin Ward 08 KasbaVishrambaugwada', 'pun-008');
        }
      });
      await cityPage.waitForTimeout(2500);
      const puneDrawerPath = path.join(SCREENSHOTS_DIR, `qa-02-city-pune-ward-08-drawer-selected-${vp.suffix}.png`);
      await cityPage.screenshot({ path: puneDrawerPath, fullPage: false });
      console.log(`Saved: ${puneDrawerPath}`);

      // Screenshot 2E: City Overview - Bengaluru Ward blr-001 selected with #00f2fe highlight & Drawer open
      console.log('Switching back to Bengaluru and selecting Ward blr-001 Vinayaka Layout...');
      await cityPage.evaluate(async () => {
        if (window.__heatPulseActions) {
          window.__heatPulseActions.setSelectedCity('bengaluru');
          await window.__heatPulseActions.loadCityData('bengaluru');
          window.__heatPulseActions.setSelectedWard('Vinayaka Layout', 'blr-001');
        }
      });
      await cityPage.waitForTimeout(2500);
      const blrDrawerPath = path.join(SCREENSHOTS_DIR, `qa-02-city-bengaluru-ward-drawer-selected-${vp.suffix}.png`);
      await cityPage.screenshot({ path: blrDrawerPath, fullPage: false });
      console.log(`Saved: ${blrDrawerPath}`);
    } catch (err) {
      console.error(`Error on / (${vp.suffix}):`, err);
    } finally {
      await cityPage.close();
    }

    // ------------------------------------------------------------------------
    // 3. /how-it-works
    // ------------------------------------------------------------------------
    console.log(`\n[3/3] Navigating to /how-it-works for ${vp.suffix}...`);
    const howPage = await context.newPage();
    try {
      await howPage.goto(`${BASE_URL}/how-it-works`, { waitUntil: 'networkidle', timeout: 30000 });
      await hideDevOverlay(howPage);
      await howPage.waitForTimeout(2500);

      // Scroll to Section 5: Multi-Scale Spatial Architecture & Cartographic Truth
      console.log('Scrolling to Section 5 Multi-Scale Spatial Architecture & Bihar case study...');
      const section5 = await howPage.$('h2:has-text("5. Multi-Scale Spatial Architecture")');
      if (section5) {
        await section5.scrollIntoViewIfNeeded();
        await howPage.waitForTimeout(1500);
      }
      const howSection5Path = path.join(SCREENSHOTS_DIR, `qa-03-how-it-works-section5-case-study-${vp.suffix}.png`);
      await howPage.screenshot({ path: howSection5Path, fullPage: false });
      console.log(`Saved: ${howSection5Path}`);

      // Top view of /how-it-works
      await howPage.evaluate(() => window.scrollTo(0, 0));
      await howPage.waitForTimeout(1000);
      const howTopPath = path.join(SCREENSHOTS_DIR, `qa-03-how-it-works-top-${vp.suffix}.png`);
      await howPage.screenshot({ path: howTopPath, fullPage: false });
      console.log(`Saved: ${howTopPath}`);
    } catch (err) {
      console.error(`Error on /how-it-works (${vp.suffix}):`, err);
    } finally {
      await howPage.close();
    }

    await context.close();
  }

  await browser.close();
  console.log('\n' + '='.repeat(70));
  console.log('All QA verification screenshots captured successfully at 1600x960 and 1920x1080!');
  console.log('='.repeat(70));
}

runQACaptures().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
