/* Smoke test em inglês: rótulos do selo, popup e onboarding vêm de _locales/en; axe nas páginas. */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs'); const os = require('os');
const EXT = path.resolve(__dirname, '..'); const SHOTS = process.env.SHOTS || '/workspace/urna-guard-shots';
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-x.html'), 'utf8');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const res = []; let failed = 0; const check = (n, c, i) => { res.push(`${c ? 'PASS' : 'FAIL'} ${n}${i ? ' — ' + i : ''}`); if (!c) failed++; };
const axe = async (pg, inc) => { await pg.evaluate(AXE); return (await pg.evaluate(i => axe.run(i ? { include: i } : document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }), inc || null)).violations.map(v => v.id); };
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ugen-')), { channel: 'chromium', headless: true, locale: 'en-US',
    env: Object.assign({}, process.env, { LANGUAGE: 'en_US', LANG: 'en_US.UTF-8' }), viewport: { width: 1100, height: 1300 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=en-US'] });
  await ctx.route('**/*', r => { const u = r.request().url(); if (/x\.com\/home/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: MOCK });
    if (u.startsWith('chrome-extension://')) return r.continue(); return r.fulfill({ status: 200, body: '' }); });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const ob = ctx.pages().find(p => p.url().includes('welcome')) || await ctx.waitForEvent('page', { predicate: p => p.url().includes('welcome'), timeout: 5000 });
  await ob.waitForLoadState(); await ob.setViewportSize({ width: 900, height: 820 }); await ob.waitForTimeout(300);
  check('EN onboarding', /Step 1 of 3/.test(await ob.textContent('#progress')) && /Traffic-light/.test(await ob.textContent('#h1')));
  check('EN onboarding axe', (await axe(ob)).length === 0, (await axe(ob)).join(','));
  await ob.screenshot({ path: path.join(SHOTS, 'onboarding-1-en.png') }); await ob.close();
  const page = await ctx.newPage(); await page.goto('https://x.com/home'); await page.waitForSelector('#t-copy-3'); await page.waitForTimeout(1500);
  check('EN badge', /High risk.*why\?/.test(await page.$eval('#t-red .ug-badge', b => b.textContent)));
  await page.click('#t-red .ug-badge');
  check('EN panel', /Main reasons/.test(await page.$eval('#t-red .ug-panel', p => p.textContent)));
  await page.locator('#t-red').screenshot({ path: path.join(SHOTS, 'painel-alto-risco-en.png') });
  const pop = await ctx.newPage(); await pop.setViewportSize({ width: 380, height: 600 }); await pop.goto(`chrome-extension://${id}/src/popup.html`); await pop.waitForTimeout(400);
  check('EN popup', (await pop.textContent('#stateLabel')) === 'On' && /Sensitivity/.test(await pop.textContent('legend')) && (await pop.getAttribute('html', 'lang')) === 'en');
  check('EN popup axe', (await axe(pop)).length === 0, (await axe(pop)).join(','));
  await pop.screenshot({ path: path.join(SHOTS, 'popup-en.png') });
  await ctx.close(); console.log(res.join('\n') + `\n\n${res.length - failed}/${res.length} EN checks OK`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
