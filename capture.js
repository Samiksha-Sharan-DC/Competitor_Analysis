/**
 * capture.js  —  Weekly competitor UI screenshot collector
 *
 * Three strategies:
 *  1. DOCS / ARTICLES / PRODUCT PAGES  — finds embedded product UI images and downloads them
 *  2. REVIEW SITES (G2, Capterra, Trustpilot) — extracts product screenshots from listings
 *  3. YOUTUBE — seeks to timestamps and captures video frames showing the product UI
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SOURCES = [
  // SECTIGO
  { competitor:'sectigo', category:'lifecycle', type:'docs', label:'SCM — certificate enrollment', url:'https://docs.sectigo.com/scm/en/certificates/ssl-certificates/index.html' },
  { competitor:'sectigo', category:'lifecycle', type:'docs', label:'SCM — ACME automation', url:'https://docs.sectigo.com/scm/en/api/index.html' },
  { competitor:'sectigo', category:'discovery', type:'docs', label:'SCM — certificate discovery', url:'https://docs.sectigo.com/scm/en/discovery/index.html' },
  { competitor:'sectigo', category:'administration', type:'docs', label:'SCM — user roles', url:'https://docs.sectigo.com/scm/en/administration/users/index.html' },
  { competitor:'sectigo', category:'dashboard', type:'product', label:'Sectigo — certificate manager product page', url:'https://sectigo.com/products/certificate-manager' },
  { competitor:'sectigo', category:'lifecycle', type:'youtube', label:'SCM — certificate enrollment demo', youtubeId:'dCpDpCf5Vy8', timestamps:[30,60,90,120,180] },
  { competitor:'sectigo', category:'support', type:'review', label:'G2 — Sectigo product screenshots', url:'https://www.g2.com/products/sectigo-certificate-manager/reviews' },
  { competitor:'sectigo', category:'security', type:'article', label:'SC Magazine — Sectigo coverage', url:'https://www.scmagazine.com/keyword/sectigo' },

  // GLOBALSIGN
  { competitor:'globalsign', category:'lifecycle', type:'docs', label:'Atlas — order a certificate', url:'https://support.globalsign.com/ssl/ssl-certificates-installation/order-ssl-certificate' },
  { competitor:'globalsign', category:'inventory', type:'docs', label:'Atlas — certificate inventory', url:'https://support.globalsign.com/atlas/atlas-ssl-tls-management' },
  { competitor:'globalsign', category:'administration', type:'docs', label:'Atlas — user management', url:'https://support.globalsign.com/atlas/atlas-account-management' },
  { competitor:'globalsign', category:'dashboard', type:'product', label:'GlobalSign — managed SSL overview', url:'https://www.globalsign.com/en/ssl/managed-ssl/' },
  { competitor:'globalsign', category:'dashboard', type:'youtube', label:'GlobalSign Atlas — portal walkthrough', youtubeId:'rTPjkJVJNjk', timestamps:[20,50,90,130] },
  { competitor:'globalsign', category:'support', type:'review', label:'G2 — GlobalSign product screenshots', url:'https://www.g2.com/products/globalsign/reviews' },
  { competitor:'globalsign', category:'support', type:'review', label:'Trustpilot — GlobalSign', url:'https://www.trustpilot.com/review/www.globalsign.com' },

  // AWS ACM
  { competitor:'aws', category:'lifecycle', type:'docs', label:'ACM — request a public certificate', url:'https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html' },
  { competitor:'aws', category:'lifecycle', type:'docs', label:'ACM — managed renewal', url:'https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html' },
  { competitor:'aws', category:'administration', type:'docs', label:'ACM — IAM access control', url:'https://docs.aws.amazon.com/acm/latest/userguide/authen-overview.html' },
  { competitor:'aws', category:'dashboard', type:'product', label:'AWS ACM — product overview', url:'https://aws.amazon.com/certificate-manager/' },
  { competitor:'aws', category:'lifecycle', type:'youtube', label:'AWS ACM — getting started demo', youtubeId:'XtiluGirMys', timestamps:[15,45,75,110,150] },
  { competitor:'aws', category:'support', type:'review', label:'G2 — AWS ACM product screenshots', url:'https://www.g2.com/products/aws-certificate-manager/reviews' },
  { competitor:'aws', category:'security', type:'article', label:'The New Stack — AWS ACM coverage', url:'https://thenewstack.io/?s=aws+certificate+manager' },

  // LETSENCRYPT
  { competitor:'letsencrypt', category:'lifecycle', type:'docs', label:"Let's Encrypt — how it works", url:'https://letsencrypt.org/how-it-works/' },
  { competitor:'letsencrypt', category:'lifecycle', type:'docs', label:'Certbot — getting started', url:'https://certbot.eff.org/instructions' },
  { competitor:'letsencrypt', category:'integrations', type:'docs', label:"Let's Encrypt — ACME client list", url:'https://letsencrypt.org/docs/client-options/' },
  { competitor:'letsencrypt', category:'dashboard', type:'product', label:"Let's Encrypt — about page", url:'https://letsencrypt.org/about/' },
  { competitor:'letsencrypt', category:'lifecycle', type:'youtube', label:"Let's Encrypt — how it works explained", youtubeId:'jrR_WfgmWEw', timestamps:[20,50,90] },
  { competitor:'letsencrypt', category:'support', type:'review', label:"G2 — Let's Encrypt reviews", url:'https://www.g2.com/products/let-s-encrypt/reviews' },

  // CLOUDFLARE
  { competitor:'cloudflare', category:'lifecycle', type:'docs', label:'Cloudflare — edge certificates', url:'https://developers.cloudflare.com/ssl/edge-certificates/' },
  { competitor:'cloudflare', category:'lifecycle', type:'docs', label:'Cloudflare — advanced cert manager', url:'https://developers.cloudflare.com/ssl/edge-certificates/advanced-certificate-manager/' },
  { competitor:'cloudflare', category:'security', type:'docs', label:'Cloudflare — mTLS client certificates', url:'https://developers.cloudflare.com/ssl/client-certificates/' },
  { competitor:'cloudflare', category:'integrations', type:'docs', label:'Cloudflare — Terraform SSL/TLS', url:'https://developers.cloudflare.com/terraform/additional-configurations/ssl-tls/' },
  { competitor:'cloudflare', category:'dashboard', type:'product', label:'Cloudflare — SSL overview', url:'https://www.cloudflare.com/ssl/' },
  { competitor:'cloudflare', category:'pricing', type:'product', label:'Cloudflare — plans and pricing', url:'https://www.cloudflare.com/plans/' },
  { competitor:'cloudflare', category:'lifecycle', type:'youtube', label:'Cloudflare SSL — setup walkthrough', youtubeId:'M7l5e5uBMkw', timestamps:[30,70,110,160,210] },
  { competitor:'cloudflare', category:'security', type:'youtube', label:'Cloudflare mTLS — product demo', youtubeId:'mGC2ysFdBDo', timestamps:[20,60,100] },
  { competitor:'cloudflare', category:'support', type:'review', label:'G2 — Cloudflare product screenshots', url:'https://www.g2.com/products/cloudflare/reviews' },
  { competitor:'cloudflare', category:'security', type:'article', label:'TechCrunch — Cloudflare coverage', url:'https://techcrunch.com/tag/cloudflare/' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const ensureDir = d => { if (!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); };

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, { headers:{'User-Agent':'Mozilla/5.0 (compatible; ResearchBot/1.0)'} }, res => {
      if ([301,302,303,307].includes(res.statusCode) && res.headers.location) {
        file.close(); try { fs.unlinkSync(dest); } catch {}
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

function looksLikeProductUI(src, alt, w, h) {
  if (!src || !src.startsWith('http')) return false;
  const s = (src + ' ' + (alt||'')).toLowerCase();
  const rejects = ['logo','icon','avatar','badge','banner','hero','sprite','arrow',
    'chevron','social','twitter','linkedin','favicon','1x1','pixel','spacer','.svg'];
  if (rejects.some(r => s.includes(r))) return false;
  if (w && w < 300) return false;
  if (h && h < 180) return false;
  const signals = ['dashboard','console','portal','screenshot','screen','ui','interface',
    'panel','window','dialog','wizard','certificate','ssl','tls','acm','scm','atlas',
    'cloudflare','sectigo','globalsign','certbot','step','workflow','form','table','figure'];
  return signals.some(p => s.includes(p)) || (w >= 500 && h >= 300);
}

const COOKIE_SELECTORS = [
  '#onetrust-accept-btn-handler','.cc-accept',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '[aria-label="Accept cookies"]','button[id*="accept"][id*="cookie"]','.cky-btn-accept',
];

async function dismissCookies(page) {
  for (const sel of COOKIE_SELECTORS) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({timeout:1500})) { await btn.click(); await sleep(600); return; }
    } catch {}
  }
}

function storeResult(results, source, filename, today, sourceUrl, subtype, altText) {
  if (!results[source.competitor]) results[source.competitor] = {};
  if (!results[source.competitor][source.category]) results[source.competitor][source.category] = [];
  const slot = results[source.competitor][source.category];
  const baseKey = `${source.competitor}__${source.category}__${slugify(source.label)}`;
  const entry = {
    label: source.label + (altText ? ` — ${altText}` : ''),
    url: sourceUrl, file: filename, capturedAt: today,
    type: source.type, subtype, key: baseKey,
  };
  const kept = slot.filter(e => e.key !== baseKey || e.subtype !== subtype).slice(-6);
  results[source.competitor][source.category] = [...kept, entry];
}

// ── Strategy 1: extract embedded product UI images from a page ───────────────
async function extractUIImages(browser, source, today, results) {
  console.log('  Strategy: extract embedded UI images');
  const context = await browser.newContext({
    viewport:{width:1440,height:900}, locale:'en-US', timezoneId:'UTC',
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  try {
    const page = await context.newPage();
    await page.goto(source.url, {waitUntil:'domcontentloaded',timeout:40000});
    await sleep(2500);
    await dismissCookies(page);

    // Lazy-load everything by scrolling
    await page.evaluate(async () => {
      await new Promise(res => {
        let y=0;
        const step=()=>{ window.scrollBy(0,300); y+=300;
          if(y<document.body.scrollHeight) setTimeout(step,100); else { window.scrollTo(0,0); res(); }};
        step();
      });
    });
    await sleep(1500);

    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src || img.dataset.src || img.dataset.lazySrc || '',
        alt: img.alt || '',
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
        inFigure: !!img.closest('figure,[class*="step"],[class*="screenshot"],[class*="figure"]'),
      }))
    );

    const uiImages = images
      .filter(img => looksLikeProductUI(img.src, img.alt, img.width, img.height))
      .sort((a,b) => (b.inFigure?1:0)-(a.inFigure?1:0))
      .slice(0,4);

    console.log(`  Found ${uiImages.length} UI image(s) (of ${images.length} total)`);

    if (uiImages.length === 0) {
      // Fallback: screenshot the page viewport
      const filename = `${source.competitor}__${source.category}__${slugify(source.label)}__page__${today}.png`;
      await page.screenshot({path:path.join('screenshots',filename),fullPage:false,animations:'disabled'});
      storeResult(results, source, filename, today, source.url, 'page_screenshot');
      console.log('  Saved fallback page screenshot');
      return;
    }

    for (let i=0; i<uiImages.length; i++) {
      const img = uiImages[i];
      const ext = img.src.toLowerCase().includes('.png') ? 'png' : 'jpg';
      const filename = `${source.competitor}__${source.category}__${slugify(source.label)}__img${i+1}__${today}.${ext}`;
      try {
        await downloadFile(img.src, path.join('screenshots',filename));
        storeResult(results, source, filename, today, img.src, 'extracted_image', img.alt || `image ${i+1}`);
        console.log(`  ✓ Image ${i+1}: ${img.alt||img.src.split('/').pop()}`);
      } catch(err) { console.warn(`  ✗ Image ${i+1} download failed: ${err.message}`); }
    }
  } finally { await context.close(); }
}

// ── Strategy 2: extract product screenshots from review sites ────────────────
async function extractReviewScreenshots(browser, source, today, results) {
  console.log('  Strategy: extract product screenshots from review site');
  const context = await browser.newContext({
    viewport:{width:1440,height:900}, locale:'en-US',
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  try {
    const page = await context.newPage();
    await page.goto(source.url, {waitUntil:'domcontentloaded',timeout:40000});
    await sleep(3000);
    await dismissCookies(page);

    // Try to click a Screenshots / Photos tab
    const tabSelectors = [
      'a[href*="screenshot"]','button:has-text("Screenshots")','button:has-text("Photos")',
      '[data-tab="screenshots"]','[role="tab"]:has-text("Screenshots")',
    ];
    for (const sel of tabSelectors) {
      try {
        const tab = page.locator(sel).first();
        if (await tab.isVisible({timeout:2000})) { await tab.click(); await sleep(1500); break; }
      } catch {}
    }

    await page.evaluate(async () => {
      await new Promise(res => {
        let y=0;
        const step=()=>{ window.scrollBy(0,400); y+=400;
          if(y<Math.min(document.body.scrollHeight,6000)) setTimeout(step,150); else res(); };
        step();
      });
    });
    await sleep(1500);

    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src||'', alt: img.alt||'',
        width: img.naturalWidth||img.width||0,
        height: img.naturalHeight||img.height||0,
      }))
    );

    const reviewImages = images.filter(img =>
      img.src && img.src.startsWith('http') &&
      img.width >= 400 && img.height >= 250 &&
      !['logo','avatar','icon','badge'].some(r => img.src.toLowerCase().includes(r))
    ).slice(0,3);

    console.log(`  Found ${reviewImages.length} review screenshot(s)`);

    if (reviewImages.length === 0) {
      const filename = `${source.competitor}__${source.category}__${slugify(source.label)}__page__${today}.png`;
      await page.screenshot({path:path.join('screenshots',filename),fullPage:false,animations:'disabled'});
      storeResult(results, source, filename, today, source.url, 'page_screenshot');
      return;
    }

    for (let i=0; i<reviewImages.length; i++) {
      const img = reviewImages[i];
      const ext = img.src.toLowerCase().includes('.png') ? 'png' : 'jpg';
      const filename = `${source.competitor}__${source.category}__${slugify(source.label)}__review${i+1}__${today}.${ext}`;
      try {
        await downloadFile(img.src, path.join('screenshots',filename));
        storeResult(results, source, filename, today, img.src, 'review_screenshot', `reviewer screenshot ${i+1}`);
        console.log(`  ✓ Review screenshot ${i+1}`);
      } catch(err) { console.warn(`  ✗ Failed: ${err.message}`); }
    }
  } finally { await context.close(); }
}

// ── Strategy 3: capture YouTube video frames ─────────────────────────────────
async function captureYouTubeFrames(browser, source, today, results) {
  console.log('  Strategy: capture YouTube video frames');
  const context = await browser.newContext({
    viewport:{width:1280,height:720}, locale:'en-US',
  });
  try {
    const page = await context.newPage();
    // Muted autoplay embed — no login required, no cookie wall
    await page.goto(`https://www.youtube.com/embed/${source.youtubeId}?autoplay=1&mute=1`, {waitUntil:'domcontentloaded',timeout:40000});
    await sleep(4000);

    try { await page.waitForSelector('video', {timeout:10000}); }
    catch { console.warn('  No video element found — skipping'); return; }

    let saved = 0;
    for (const ts of (source.timestamps||[30,60,90])) {
      if (saved >= 3) break;
      try {
        // Seek to timestamp and pause
        await page.evaluate(t => {
          const v = document.querySelector('video');
          if (v) { v.currentTime=t; v.pause(); }
        }, ts);
        await sleep(1800);

        const filename = `${source.competitor}__${source.category}__${slugify(source.label)}__t${ts}s__${today}.png`;
        await page.screenshot({
          path: path.join('screenshots',filename),
          clip:{x:0,y:0,width:1280,height:720},
          animations:'disabled',
        });
        storeResult(results, source, filename, today,
          `https://www.youtube.com/watch?v=${source.youtubeId}&t=${ts}`,
          'youtube_frame', `at ${ts}s`);
        console.log(`  ✓ Frame at ${ts}s`);
        saved++;
      } catch(err) { console.warn(`  ✗ Frame at ${ts}s: ${err.message}`); }
    }

    if (saved === 0) {
      // Fallback: just screenshot the player
      const filename = `${source.competitor}__${source.category}__${slugify(source.label)}__player__${today}.png`;
      await page.screenshot({path:path.join('screenshots',filename),animations:'disabled'});
      storeResult(results, source, filename, today, `https://www.youtube.com/watch?v=${source.youtubeId}`, 'youtube_player');
      console.log('  Saved player screenshot as fallback');
    }
  } finally { await context.close(); }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().slice(0,10);
  ensureDir('screenshots');
  ensureDir('data');

  const dataPath = 'data/latest.json';
  let existing = {};
  if (fs.existsSync(dataPath)) { try { existing = JSON.parse(fs.readFileSync(dataPath,'utf8')); } catch {} }

  const browser = await chromium.launch({ args:['--no-sandbox','--disable-setuid-sandbox'] });
  const results = { ...existing };
  const errors = [];
  let done = 0;

  for (const source of SOURCES) {
    console.log(`\n━━━ ${source.competitor.toUpperCase()} / ${source.category} [${source.type}] ━━━`);
    console.log(`    ${source.label}`);
    try {
      if (source.type === 'youtube') await captureYouTubeFrames(browser, source, today, results);
      else if (source.type === 'review') await extractReviewScreenshots(browser, source, today, results);
      else await extractUIImages(browser, source, today, results);
      done++;
    } catch(err) {
      console.error(`  ✗ Source failed: ${err.message}`);
      errors.push({ source:source.label, error:err.message, date:today });
    }
    await sleep(3000);
  }

  await browser.close();
  results.__meta = { lastRun:today, totalSources:SOURCES.length, done, errors };
  fs.writeFileSync(dataPath, JSON.stringify(results,null,2));
  console.log(`\n✓ Complete — ${done}/${SOURCES.length} sources, ${errors.length} failed`);
}

main().catch(err => { console.error('Fatal:',err); process.exit(1); });
