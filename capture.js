/**
 * capture.js
 * Runs inside GitHub Actions every Monday.
 * Opens a real browser, visits each competitor page, takes a full screenshot,
 * and saves it to screenshots/ and data/latest.json.
 *
 * Never submits forms, never logs in, never bypasses bot protection.
 * Respects a 3-second delay between each page to be polite.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── What to capture ────────────────────────────────────────────────────────
// Each entry is one page to screenshot. Add more by copying the pattern.
// category must match one of the 10 categories in index.html.
const PAGES = [
  // SECTIGO
  {
    competitor: 'sectigo',
    category: 'dashboard',
    label: 'Dashboard overview',
    url: 'https://sectigo.com/products/ssl-certificates',
  },
  {
    competitor: 'sectigo',
    category: 'lifecycle',
    label: 'Certificate enrollment',
    url: 'https://docs.sectigo.com/scm/en/certificates/ssl-certificates/index.html',
  },
  {
    competitor: 'sectigo',
    category: 'integrations',
    label: 'ACME & API',
    url: 'https://docs.sectigo.com/scm/en/api/index.html',
  },

  // GLOBALSIGN
  {
    competitor: 'globalsign',
    category: 'dashboard',
    label: 'Atlas portal overview',
    url: 'https://www.globalsign.com/en/ssl/managed-ssl/',
  },
  {
    competitor: 'globalsign',
    category: 'lifecycle',
    label: 'Certificate ordering',
    url: 'https://support.globalsign.com/ssl/ssl-certificates-installation/order-ssl-certificate',
  },
  {
    competitor: 'globalsign',
    category: 'inventory',
    label: 'Certificate inventory',
    url: 'https://support.globalsign.com/atlas/atlas-ssl-tls-management',
  },

  // AWS ACM
  {
    competitor: 'aws',
    category: 'dashboard',
    label: 'ACM overview',
    url: 'https://aws.amazon.com/certificate-manager/',
  },
  {
    competitor: 'aws',
    category: 'lifecycle',
    label: 'Requesting a certificate',
    url: 'https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html',
  },
  {
    competitor: 'aws',
    category: 'pricing',
    label: 'ACM pricing',
    url: 'https://aws.amazon.com/certificate-manager/pricing/',
  },

  // LET'S ENCRYPT
  {
    competitor: 'letsencrypt',
    category: 'dashboard',
    label: 'Getting started',
    url: 'https://letsencrypt.org/getting-started/',
  },
  {
    competitor: 'letsencrypt',
    category: 'lifecycle',
    label: 'How it works',
    url: 'https://letsencrypt.org/how-it-works/',
  },
  {
    competitor: 'letsencrypt',
    category: 'pricing',
    label: 'Pricing — free',
    url: 'https://letsencrypt.org/about/',
  },

  // CLOUDFLARE
  {
    competitor: 'cloudflare',
    category: 'dashboard',
    label: 'SSL/TLS overview',
    url: 'https://www.cloudflare.com/ssl/',
  },
  {
    competitor: 'cloudflare',
    category: 'lifecycle',
    label: 'Edge certificates',
    url: 'https://developers.cloudflare.com/ssl/edge-certificates/',
  },
  {
    competitor: 'cloudflare',
    category: 'integrations',
    label: 'API & Terraform',
    url: 'https://developers.cloudflare.com/ssl/edge-certificates/advanced-certificate-manager/',
  },
  {
    competitor: 'cloudflare',
    category: 'pricing',
    label: 'Pricing',
    url: 'https://www.cloudflare.com/plans/',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  ensureDir('screenshots');
  ensureDir('data');

  // Load existing data so we can update it rather than overwrite everything
  const dataPath = 'data/latest.json';
  let existing = {};
  if (fs.existsSync(dataPath)) {
    try { existing = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  }

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = { ...existing };
  const errors = [];

  for (const page of PAGES) {
    const key = `${page.competitor}__${page.category}__${slugify(page.label)}`;
    const filename = `${key}__${today}.png`;
    const filepath = path.join('screenshots', filename);

    console.log(`\nCapturing: ${page.competitor} / ${page.category} — ${page.label}`);
    console.log(`  URL: ${page.url}`);

    let context;
    try {
      context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
      });

      const p = await context.newPage();

      // Block ads, trackers and unnecessary media to speed things up
      await p.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['media', 'font', 'websocket'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Navigate with a generous timeout — some docs sites are slow
      await p.goto(page.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for the page to settle
      await p.waitForTimeout(2000);

      // Dismiss cookie banners if present
      for (const selector of [
        '[id*="cookie"] button[class*="accept"]',
        '[class*="cookie"] button[class*="accept"]',
        'button[id*="accept"]',
        '#onetrust-accept-btn-handler',
        '.cc-accept',
      ]) {
        try {
          const btn = p.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            await btn.click();
            await p.waitForTimeout(500);
            break;
          }
        } catch {}
      }

      // Take the screenshot
      await p.screenshot({
        path: filepath,
        fullPage: false, // viewport-height only — keeps file size reasonable
        animations: 'disabled',
      });

      console.log(`  ✓ Saved: ${filepath}`);

      // Record in data
      if (!results[page.competitor]) results[page.competitor] = {};
      if (!results[page.competitor][page.category]) results[page.competitor][page.category] = [];

      // Add this capture, keep the last 4 versions per slot
      const slot = results[page.competitor][page.category];
      const entry = {
        label: page.label,
        url: page.url,
        file: filename,
        capturedAt: today,
        key,
      };
      // Remove older entries for the same label, keep last 3
      const kept = slot.filter((e) => e.label !== page.label).slice(-3);
      results[page.competitor][page.category] = [...kept, entry];

    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      errors.push({ page: key, error: err.message, date: today });

      // Record the failure so the board shows "last capture failed" rather than
      // silently showing a stale screenshot as if it were current
      if (!results[page.competitor]) results[page.competitor] = {};
      if (!results[page.competitor][page.category]) results[page.competitor][page.category] = [];
      const slot = results[page.competitor][page.category];
      const last = slot.find((e) => e.label === page.label);
      if (last) last.lastError = { message: err.message, date: today };
    } finally {
      if (context) await context.close();
    }

    // Be polite — wait 3 seconds between pages
    await sleep(3000);
  }

  await browser.close();

  // Save the data file that the board reads
  results.__meta = {
    lastRun: today,
    totalPages: PAGES.length,
    errors,
  };
  fs.writeFileSync(dataPath, JSON.stringify(results, null, 2));
  console.log('\n✓ data/latest.json updated');

  if (errors.length > 0) {
    console.log(`\n⚠ ${errors.length} page(s) failed — see data/latest.json for details`);
    // Don't exit with error code — partial success is still useful
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
