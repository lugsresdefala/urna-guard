/* Bench no Chromium: injeta N posts sintéticos no mock do X em lotes (simula rolagem) e mede o tempo de script
 * do renderer (CDP ScriptDuration) e tarefas longas. Uso: EXT=<dir> N=1500 NODE_PATH=... node bench/browser-bench.js */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs'); const os = require('os');
const EXT = path.resolve(process.env.EXT || path.join(__dirname, '..'));
const N = +(process.env.N || 1500);
const MOCK = fs.readFileSync(path.join(__dirname, '../e2e/mock-x.html'), 'utf8');
const posts = require('./synth').make(N, 11);
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ugb-')), {
    channel: 'chromium', headless: true, viewport: { width: 1100, height: 1500 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  await ctx.route('**/*', r => { const u = r.request().url();
    if (/^https:\/\/x\.com\/home/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: MOCK });
    if (/twimg/.test(u)) return r.fulfill({ status: 200, body: '' }); if (u.startsWith('chrome-extension://')) return r.continue(); return r.abort(); });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://x.com/home'); await page.waitForSelector('#t-copy-3'); await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  await page.evaluate(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask' }); });
  const before = await m(); const t0 = Date.now();
  await page.evaluate(async posts => {
    for (let i = 0; i < posts.length; i += 20) { posts.slice(i, i + 20).forEach(p => add(p)); await new Promise(r => setTimeout(r, 16)); }
  }, posts);
  // espera todos os artigos sintéticos receberem data-ug-level
  await page.waitForFunction(n => document.querySelectorAll('article[id^="b"][data-ug-level]').length >= n, N, { timeout: 600000, polling: 200 });
  const wall = Date.now() - t0; const after = await m();
  const lt = await page.evaluate(() => window.__lt);
  const flagged = await page.$$eval('article[id^="b"]', as => as.filter(a => a.dataset.ugLevel && a.dataset.ugLevel !== 'none').length);
  console.log(JSON.stringify({ ext: path.basename(EXT), posts: N, scriptMs: Math.round((after.ScriptDuration - before.ScriptDuration) * 1000),
    taskMs: Math.round((after.TaskDuration - before.TaskDuration) * 1000), wallMs: wall, longTasks: lt.length, maxLongTaskMs: Math.round(Math.max(0, ...lt)), flagged }));
  await ctx.close();
})().catch(e => { console.error(e); process.exit(2); });
