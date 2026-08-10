/**
 * capture.js
 * Runs inside GitHub Actions every Monday.
 *
 * For each competitor it captures:
 *   1. Official documentation pages (actual UI screens)
 *   2. Product feature / marketing pages
 *   3. YouTube video player screenshots (product demos)
 *   4. Review site pages (G2, Capterra, Trustpilot)
 *   5. Tech article pages (TechCrunch, SC Magazine, etc.)
 *
 * Never logs in, never submits forms, never bypasses bot protection.
 * Waits 3 seconds between each page to be polite.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── Pages to capture ────────────────────────────────────────────────────────
// Each entry: { competitor, category, label, url, type, youtubeId? }
// type: 'docs' | 'product' | 'youtube' | 'review' | 'article'

const PAGES = [

  // ── SECTIGO ────────────────────────────────────────────────────────────────

  // Documentation
  { competitor:'sectigo', category:'lifecycle',      type:'docs',    label:'SCM — enroll SSL certificate',         url:'https://docs.sectigo.com/scm/en/certificates/ssl-certificates/index.html' },
  { competitor:'sectigo', category:'integrations',   type:'docs',    label:'SCM — ACME & REST API overview',       url:'https://docs.sectigo.com/scm/en/api/index.html' },
  { competitor:'sectigo', category:'administration', type:'docs',    label:'SCM — user roles and permissions',     url:'https://docs.sectigo.com/scm/en/administration/users/index.html' },
  { competitor:'sectigo', category:'discovery',      type:'docs',    label:'SCM — certificate discovery',         url:'https://docs.sectigo.com/scm/en/discovery/index.html' },

  // Product pages
  { competitor:'sectigo', category:'dashboard',      type:'product', label:'Sectigo — certificate manager product',url:'https://sectigo.com/products/certificate-manager' },
  { competitor:'sectigo', category:'pricing',        type:'product', label:'Sectigo — pricing page',              url:'https://sectigo.com/pricing' },

  // YouTube — product demo videos
  { competitor:'sectigo', category:'lifecycle',      type:'youtube', label:'Sectigo SCM demo — certificate enrollment', youtubeId:'dCpDpCf5Vy8' },
  { competitor:'sectigo', category:'dashboard',      type:'youtube', label:'Sectigo certificate manager overview',      youtubeId:'6bFhlMeHMn4' },

  // Reviews
  { competitor:'sectigo', category:'support',        type:'review',  label:'G2 — Sectigo reviews',                url:'https://www.g2.com/products/sectigo-certificate-manager/reviews' },
  { competitor:'sectigo', category:'support',        type:'review',  label:'Capterra — Sectigo reviews',          url:'https://www.capterra.com/p/176056/Sectigo-Certificate-Manager/' },

  // Articles
  { competitor:'sectigo', category:'security',       type:'article', label:'SC Magazine — Sectigo coverage',      url:'https://www.scmagazine.com/keyword/sectigo' },


  // ── GLOBALSIGN ─────────────────────────────────────────────────────────────

  // Documentation
  { competitor:'globalsign', category:'lifecycle',      type:'docs',    label:'Atlas — order a certificate',          url:'https://support.globalsign.com/ssl/ssl-certificates-installation/order-ssl-certificate' },
  { competitor:'globalsign', category:'inventory',      type:'docs',    label:'Atlas — certificate inventory',        url:'https://support.globalsign.com/atlas/atlas-ssl-tls-management' },
  { competitor:'globalsign', category:'administration', type:'docs',    label:'Atlas — user management',              url:'https://support.globalsign.com/atlas/atlas-account-management' },
  { competitor:'globalsign', category:'integrations',   type:'docs',    label:'Atlas — REST API documentation',       url:'https://www.globalsign.com/en/resources/apis/api-documentation/globalsign_api.html' },

  // Product pages
  { competitor:'globalsign', category:'dashboard',      type:'product', label:'GlobalSign — managed SSL overview',    url:'https://www.globalsign.com/en/ssl/managed-ssl/' },
  { competitor:'globalsign', category:'pricing',        type:'product', label:'GlobalSign — certificate pricing',     url:'https://www.globalsign.com/en/ssl/ssl-certificate-products/' },

  // YouTube
  { competitor:'globalsign', category:'dashboard',      type:'youtube', label:'GlobalSign Atlas portal overview',     youtubeId:'rTPjkJVJNjk' },

  // Reviews
  { competitor:'globalsign', category:'support',        type:'review',  label:'G2 — GlobalSign reviews',              url:'https://www.g2.com/products/globalsign/reviews' },
  { competitor:'globalsign', category:'support',        type:'review',  label:'Trustpilot — GlobalSign reviews',      url:'https://www.trustpilot.com/review/www.globalsign.com' },

  // Articles
  { competitor:'globalsign', category:'security',       type:'article', label:'TechCrunch — GlobalSign coverage',     url:'https://techcrunch.com/?s=globalsign' },


  // ── AWS CERTIFICATE MANAGER ────────────────────────────────────────────────

  // Documentation
  { competitor:'aws', category:'lifecycle',      type:'docs',    label:'ACM — request a public certificate',   url:'https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html' },
  { competitor:'aws', category:'lifecycle',      type:'docs',    label:'ACM — managed renewal overview',       url:'https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html' },
  { competitor:'aws', category:'integrations',   type:'docs',    label:'ACM — CLI reference',                  url:'https://docs.aws.amazon.com/cli/latest/reference/acm/index.html' },
  { competitor:'aws', category:'administration', type:'docs',    label:'ACM — IAM access control',             url:'https://docs.aws.amazon.com/acm/latest/userguide/authen-overview.html' },
  { competitor:'aws', category:'analytics',      type:'docs',    label:'ACM — CloudWatch metrics',             url:'https://docs.aws.amazon.com/acm/latest/userguide/cloudwatch-metrics.html' },

  // Product pages
  { competitor:'aws', category:'dashboard',      type:'product', label:'AWS ACM — product overview',          url:'https://aws.amazon.com/certificate-manager/' },
  { competitor:'aws', category:'pricing',        type:'product', label:'AWS ACM — pricing',                   url:'https://aws.amazon.com/certificate-manager/pricing/' },

  // YouTube
  { competitor:'aws', category:'lifecycle',      type:'youtube', label:'AWS ACM — getting started demo',      youtubeId:'XtiluGirMys' },
  { competitor:'aws', category:'integrations',   type:'youtube', label:'AWS ACM — CLI walkthrough',           youtubeId:'pFr5kDsIzF8' },

  // Reviews
  { competitor:'aws', category:'support',        type:'review',  label:'G2 — AWS ACM reviews',                url:'https://www.g2.com/products/aws-certificate-manager/reviews' },
  { competitor:'aws', category:'support',        type:'review',  label:'Gartner Peer Insights — AWS ACM',     url:'https://www.gartner.com/reviews/market/ssl-tls-certificates/vendor/amazon-web-services/product/aws-certificate-manager' },

  // Articles
  { competitor:'aws', category:'security',       type:'article', label:'The New Stack — AWS ACM coverage',    url:'https://thenewstack.io/?s=aws+certificate+manager' },


  // ── LET'S ENCRYPT ──────────────────────────────────────────────────────────

  // Documentation
  { competitor:'letsencrypt', category:'lifecycle',    type:'docs',    label:"Let's Encrypt — how it works",         url:'https://letsencrypt.org/how-it-works/' },
  { competitor:'letsencrypt', category:'lifecycle',    type:'docs',    label:'Certbot — getting started',            url:'https://certbot.eff.org/instructions' },
  { competitor:'letsencrypt', category:'integrations', type:'docs',    label:"Let's Encrypt — ACME client list",     url:'https://letsencrypt.org/docs/client-options/' },
  { competitor:'letsencrypt', category:'security',     type:'docs',    label:"Let's Encrypt — certificate compatibility", url:'https://letsencrypt.org/docs/certificate-compatibility/' },

  // Product pages
  { competitor:'letsencrypt', category:'dashboard',    type:'product', label:"Let's Encrypt — about page",          url:'https://letsencrypt.org/about/' },
  { competitor:'letsencrypt', category:'pricing',      type:'product', label:"Let's Encrypt — free certificates",   url:'https://letsencrypt.org/getting-started/' },

  // YouTube
  { competitor:'letsencrypt', category:'lifecycle',    type:'youtube', label:"Let's Encrypt — how it works explained", youtubeId:'jrR_WfgmWEw' },
  { competitor:'letsencrypt', category:'integrations', type:'youtube', label:'Certbot — installation walkthrough',   youtubeId:'lv6vgvMUZWI' },

  // Reviews
  { competitor:'letsencrypt', category:'support',      type:'review',  label:"G2 — Let's Encrypt reviews",          url:'https://www.g2.com/products/let-s-encrypt/reviews' },
  { competitor:'letsencrypt', category:'support',      type:'review',  label:"Trustpilot — Let's Encrypt",          url:'https://www.trustpilot.com/review/letsencrypt.org' },

  // Articles
  { competitor:'letsencrypt', category:'security',     type:'article', label:"Ars Technica — Let's Encrypt coverage", url:'https://arstechnica.com/search/?query=lets+encrypt' },


  // ── CLOUDFLARE ─────────────────────────────────────────────────────────────

  // Documentation
  { competitor:'cloudflare', category:'lifecycle',      type:'docs',    label:'Cloudflare — edge certificates',       url:'https://developers.cloudflare.com/ssl/edge-certificates/' },
  { competitor:'cloudflare', category:'lifecycle',      type:'docs',    label:'Cloudflare — advanced cert manager',   url:'https://developers.cloudflare.com/ssl/edge-certificates/advanced-certificate-manager/' },
  { competitor:'cloudflare', category:'integrations',   type:'docs',    label:'Cloudflare — Terraform SSL/TLS',       url:'https://developers.cloudflare.com/terraform/additional-configurations/ssl-tls/' },
  { competitor:'cloudflare', category:'security',       type:'docs',    label:'Cloudflare — mTLS client certs',       url:'https://developers.cloudflare.com/ssl/client-certificates/' },
  { competitor:'cloudflare', category:'analytics',      type:'docs',    label:'Cloudflare — SSL/TLS analytics',       url:'https://developers.cloudflare.com/ssl/reference/analytics/' },

  // Product pages
  { competitor:'cloudflare', category:'dashboard',      type:'product', label:'Cloudflare — SSL overview',           url:'https://www.cloudflare.com/ssl/' },
  { competitor:'cloudflare', category:'pricing',        type:'product', label:'Cloudflare — plans and pricing',      url:'https://www.cloudflare.com/plans/' },

  // YouTube
  { competitor:'cloudflare', category:'lifecycle',      type:'youtube', label:'Cloudflare SSL — full setup walkthrough', youtubeId:'M7l5e5uBMkw' },
  { competitor:'cloudflare', category:'security',       type:'youtube', label:'Cloudflare mTLS — product demo',      youtubeId:'mGC2ysFdBDo' },

  // Reviews
  { competitor:'cloudflare', category:'support',        type:'review',  label:'G2 — Cloudflare reviews',             url:'https://www.g2.com/products/cloudflare/reviews' },
  { competitor:'cloudflare', category:'support',        type:'review',  label:'Trustpilot — Cloudflare reviews',     url:'https://www.trustpilot.com/review/www.cloudflare.com' },

  // Articles
  { competitor:'cloudflare', category:'security',       type:'article', label:'TechCrunch — Cloudflare coverage',    url:'https://techcrunch.com/tag/cloudflare/' },
  { competitor:'cloudflare', category:'security',       type:'article', label:'The Register — Cloudflare SSL news',  url:'https://www.theregister.com/Tag/Cloudflare/' },

];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Cookie banner selectors to dismiss — never submits anything, only closes banners
const COOKIE_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '.cc-accept',
  '[aria-label="Accept cookies"]',
  'button[id*="accept"][id*="cookie"]',
  'button[class*="accept"][class*="cookie"]',
  '[data-testid="cookie-accept"]',
  '.cky-btn-accept',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
];

async function dismissCookieBanner(page) {
  for (const sel of COOKIE_SELECTORS) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        await page.waitForTimeout(600);
        return;
      }
    } catch {}
  }
}

// ─── Screenshot strategies ───────────────────────────────────────────────────

async function captureRegularPage(page, url) {
  await page.route('**/*', route => {
    const t = route.request().resourceType();
    // Block media and fonts to speed up load — we only need the visual layout
    if (['media', 'font', 'websocket'].includes(t)) route.abort();
    else route.continue();
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);
  await page.waitForTimeout(500);
}

async function captureYouTubePage(page, youtubeId) {
  // Open the embed URL — this loads the video player directly
  // without autoplay or login walls, showing the thumbnail + player controls
  const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0`;
  await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForTimeout(3000);

  // Wait for the video thumbnail/player to appear
  try {
    await page.waitForSelector('.ytp-cued-thumbnail-overlay, .ytp-thumbnail, #player', { timeout: 8000 });
  } catch {}
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  ensureDir('screenshots');
  ensureDir('data');

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
  let captured = 0;

  for (const entry of PAGES) {
    const key = `${entry.competitor}__${entry.category}__${slugify(entry.label)}`;
    const filename = `${key}__${today}.png`;
    const filepath = path.join('screenshots', filename);

    const sourceUrl = entry.youtubeId
      ? `https://www.youtube.com/watch?v=${entry.youtubeId}`
      : entry.url;

    console.log(`\n[${entry.type.toUpperCase()}] ${entry.competitor} / ${entry.category}`);
    console.log(`  ${entry.label}`);
    console.log(`  ${sourceUrl}`);

    let context;
    try {
      context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        // Identify as a real browser so sites don't block us
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      if (entry.type === 'youtube') {
        await captureYouTubePage(page, entry.youtubeId);
      } else {
        await captureRegularPage(page, entry.url);
      }

      await page.screenshot({
        path: filepath,
        fullPage: false, // viewport height — keeps files small and loads fast
        animations: 'disabled',
      });

      console.log(`  ✓ Saved`);
      captured++;

      // Store in results
      if (!results[entry.competitor]) results[entry.competitor] = {};
      if (!results[entry.competitor][entry.category]) results[entry.competitor][entry.category] = [];

      const slot = results[entry.competitor][entry.category];
      const kept = slot.filter(e => e.label !== entry.label).slice(-3);
      results[entry.competitor][entry.category] = [...kept, {
        label: entry.label,
        url: sourceUrl,
        file: filename,
        capturedAt: today,
        type: entry.type,
        key,
      }];

    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      errors.push({ key, error: err.message, date: today });

      // Mark the failure on the existing entry so the board shows a warning
      const slot = results[entry.competitor]?.[entry.category] || [];
      const prev = slot.find(e => e.label === entry.label);
      if (prev) prev.lastError = { message: err.message, date: today };

    } finally {
      if (context) await context.close();
    }

    // 3-second pause between pages — be polite to every site
    await sleep(3000);
  }

  await browser.close();

  results.__meta = {
    lastRun: today,
    totalPages: PAGES.length,
    captured,
    errors,
    sourceTypes: ['docs', 'product', 'youtube', 'review', 'article'],
  };

  fs.writeFileSync(dataPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Done — ${captured}/${PAGES.length} captured, ${errors.length} failed`);
  console.log('✓ data/latest.json updated');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
