/* Gera capturas 1280x800 e o bloco promocional 440x280 para as lojas. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const EXT = path.resolve(__dirname, '..'); const OUT = path.join(EXT, 'store');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-x.html'), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
const b64 = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const frame = (title, sub, img, w) => `<!doctype html><html><body style="margin:0;width:1280px;height:800px;overflow:hidden;font-family:system-ui,sans-serif;background:linear-gradient(135deg,#00552b,#007a3d 60%,#0a8f4a);color:#fff;display:flex;align-items:center;gap:48px;padding:0 64px;box-sizing:border-box">
<div style="flex:1"><img src="${b64(path.join(EXT, 'icons/icon128.png'))}" width="72"><h1 style="font-size:46px;line-height:1.1;margin:18px 0 14px">${title}</h1><p style="font-size:22px;line-height:1.45;opacity:.95;margin:0">${sub}</p></div>
<div style="width:${w}px;background:#fff;border-radius:18px;padding:8px;box-shadow:0 24px 60px rgba(0,0,0,.4)"><img src="${img}" style="width:100%;display:block;border-radius:12px"></div></body></html>`;
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ugs-')), { channel: 'chromium', headless: true,
    viewport: { width: 1280, height: 800 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  await ctx.route('**/*', r => { const u = r.request().url();
    if (/x\.com\/home/.test(u)) return r.fulfill({ body: MOCK, contentType: 'text/html; charset=utf-8' });
    if (/twimg/.test(u)) return r.fulfill({ body: PNG, contentType: 'image/png' });
    if (u.startsWith('chrome-extension://') || u.startsWith('data:')) return r.continue(); return r.abort(); });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const p = await ctx.newPage(); await p.goto('https://x.com/home'); await p.waitForTimeout(2800);
  await p.addStyleTag({ content: 'body{zoom:1.25}' });
  await p.click('#t-red .ug-badge'); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, 'screenshot-1-timeline-1280x800.png') });
  await p.evaluate(() => document.querySelector('#t-copy-1').scrollIntoView({ block: 'start' }));
  await p.click('#t-copy-1 .ug-badge'); await p.waitForTimeout(200);
  const tmp = path.join(os.tmpdir(), 'copy.png'); await p.locator('#t-copy-1').screenshot({ path: tmp });
  const pop = await ctx.newPage(); await pop.setViewportSize({ width: 360, height: 560 });
  await pop.goto(`chrome-extension://${id}/src/popup.html`); await pop.waitForTimeout(400);
  const tmp2 = path.join(os.tmpdir(), 'pop.png'); await pop.screenshot({ path: tmp2 });
  const opt = await ctx.newPage(); await opt.goto(`chrome-extension://${id}/src/options.html`); await opt.waitForTimeout(400);
  await opt.addStyleTag({ content: 'body{zoom:1.15}' });
  await opt.screenshot({ path: path.join(OUT, 'screenshot-4-opcoes-1280x800.png') });
  const f = await ctx.newPage();
  await f.setContent(frame('Detecta ação coordenada', 'Texto quase idêntico em várias contas, o mesmo link repetido, rajadas de posts e perfis com cara de falsos.', b64(tmp), 640));
  await f.screenshot({ path: path.join(OUT, 'screenshot-2-coordenacao-1280x800.png') });
  await f.setContent(frame('Simples e 100% local', 'Liga/desliga, sensibilidade em 3 níveis e contadores do dia. Nada sai do seu navegador: sem servidores, sem rastreadores.', b64(tmp2), 360));
  await f.screenshot({ path: path.join(OUT, 'screenshot-3-popup-1280x800.png') });
  await f.setViewportSize({ width: 440, height: 280 });
  await f.setContent(`<!doctype html><html><body style="margin:0;width:440px;height:280px;overflow:hidden;font-family:system-ui,sans-serif;background:linear-gradient(135deg,#00552b,#007a3d 60%,#0a8f4a);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 32px;box-sizing:border-box">
   <div style="display:flex;align-items:center;gap:12px"><img src="${b64(path.join(EXT, 'icons/icon128.png'))}" width="56"><b style="font-size:34px">Urna Guard</b></div>
   <p style="font-size:19px;line-height:1.35;margin:14px 0 16px">Alerta de desinformação sobre as urnas no X</p>
   <div><span style="background:#ffd54f;color:#3e2a00;border-radius:999px;padding:4px 12px;font-weight:700;font-size:14px">⚠️ atenção</span> <span style="background:#d32f2f;border-radius:999px;padding:4px 12px;font-weight:700;font-size:14px">⛔ alto risco</span></div></body></html>`);
  await f.screenshot({ path: path.join(OUT, 'promo-tile-440x280.png') });
  await ctx.close();
})().catch(e => { console.error(e); process.exit(1); });
