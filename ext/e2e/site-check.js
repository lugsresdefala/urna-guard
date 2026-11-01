/* Verifica o site: botão por navegador, guia de 3 passos, FAQ, sem rolagem horizontal no celular e axe limpo. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const BASE = process.env.SITE || 'http://127.0.0.1:8765/'; const SHOTS = process.env.SHOTS || '/workspace/urna-guard-shots';
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const UA = { chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
  mobile: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' };
const res = []; let failed = 0; const check = (n, c, i) => { res.push(`${c ? 'PASS' : 'FAIL'} ${n}${i ? ' — ' + i : ''}`); if (!c) failed++; };
(async () => {
  const br = await chromium.launch({ channel: 'chromium', headless: true });
  for (const [lang, url] of [['pt', BASE], ['en', BASE + 'en/']]) {
    for (const [b, ua] of Object.entries(UA)) {
      const mobile = b === 'mobile';
      const ctx = await br.newContext({ userAgent: ua, locale: lang === 'pt' ? 'pt-BR' : 'en-US', viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
      await ctx.addInitScript(l => localStorage.setItem('ug-lang', l), lang);
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(url); await p.waitForLoadState('load');
      const txt = await p.textContent('#primary'); const href = await p.getAttribute('#primary', 'href');
      if (mobile) check(`${lang} mobile: botão leva aos passos`, /#instalar/.test(href), txt);
      else check(`${lang} ${b}: botão grande certo`, href.includes(b === 'firefox' ? 'firefox-2.1.1.zip' : 'chrome-2.1.1.zip') && new RegExp({ chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox' }[b]).test(txt), `${txt} → ${href}`);
      check(`${lang} ${b}: guia em 3 passos com ilustrações`, (await p.$$('#panel .steps > li')).length === 3 && (await p.textContent('#s2t')).length > 5 && (await p.textContent('#m4')).trim().length > 3);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${lang} ${b}: sem rolagem horizontal`, ov <= 0, `excesso ${ov}px`);
      await p.evaluate(AXE);
      const v = (await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }))).violations;
      check(`${lang} ${b}: axe sem violações`, v.length === 0, v.map(x => `${x.id}(${x.nodes.length}): ${x.nodes[0].target}`).join('; '));
      check(`${lang} ${b}: sem erros JS`, errs.length === 0, errs.join('|'));
      if (b === 'chrome' || mobile) {
        await p.screenshot({ path: path.join(SHOTS, `site-${lang}-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: !mobile });
        await p.addStyleTag({ content: 'nav{position:static!important}' });
        await p.locator('#instalar').screenshot({ path: path.join(SHOTS, `site-${lang}-${mobile ? 'mobile' : 'desktop'}-passos.png`) });
      }
      if (b === 'chrome') {
        check(`${lang}: FAQ tem item sobre cores e sensibilidade`, (await p.$$('#faq details')).length >= 10);
        await p.focus('#tab-chrome'); await p.keyboard.press('ArrowRight');
        check(`${lang}: abas navegáveis por teclado`, (await p.getAttribute('#tab-edge', 'aria-selected')) === 'true' && /edge:/.test(await p.textContent('#url')));
      }
      await ctx.close();
    }
  }
  await br.close(); console.log(res.join('\n') + `\n\n${res.length - failed}/${res.length} site checks OK`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
