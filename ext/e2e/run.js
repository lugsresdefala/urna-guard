/* Teste funcional: carrega a extensão desempacotada no Chromium (headless=new) via Playwright,
 * serve um mock fiel ao DOM do X em https://x.com/home (interceptado localmente, sem rede) e verifica selos,
 * painel, feedback, popup, opções e storage. Uso: NODE_PATH=<dir com playwright>/node_modules node e2e/run.js */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs'); const os = require('os');
const EXT = path.resolve(__dirname, '..');
const SHOTS = process.env.SHOTS || '/workspace/urna-guard-shots';
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-x.html'), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
fs.mkdirSync(SHOTS, { recursive: true });
const results = []; let failed = 0;
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
async function axe(pg, include) {
  await pg.evaluate(AXE);
  const r = await pg.evaluate(inc => axe.run(inc ? { include: inc } : document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }), include || null);
  return r.violations.map(v => `${v.id}(${v.nodes.length})`);
}
function check(name, cond, info) { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); if (!cond) failed++; }

(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ug-')), {
    channel: 'chromium', headless: true, viewport: { width: 1100, height: 1500 }, locale: process.env.UG_LANG === 'en' ? 'en-US' : 'pt-BR', env: Object.assign({}, process.env, { LANGUAGE: process.env.UG_LANG === 'en' ? 'en_US' : 'pt_BR', LANG: process.env.UG_LANG === 'en' ? 'en_US.UTF-8' : 'pt_BR.UTF-8' }),
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=pt-BR']
  });
  const external = [];
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (/^https:\/\/x\.com\/home/.test(u)) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: MOCK });
    if (/twimg\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (u.startsWith('chrome-extension://')) return route.continue();
    external.push(u); return route.abort();
  });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  check('service worker da extensão carregado', !!extId, extId);

  // onboarding na primeira instalação (3 passos)
  let ob = ctx.pages().find(p => p.url().includes('/src/welcome.html'));
  if (!ob) ob = await ctx.waitForEvent('page', { predicate: p => p.url().includes('/src/welcome.html'), timeout: 5000 }).catch(() => null);
  check('onboarding abre na primeira instalação', !!ob);
  if (ob) {
    await ob.setViewportSize({ width: 900, height: 820 }); await ob.waitForLoadState(); await ob.waitForTimeout(300);
    check('onboarding: passo 1 de 3', /1 de 3/.test(await ob.textContent('#progress')), await ob.textContent('#progress'));
    check('onboarding: axe sem violações (passo 1)', (await axe(ob)).length === 0, (await axe(ob)).join(', '));
    await ob.screenshot({ path: path.join(SHOTS, 'onboarding-1.png') });
    await ob.focus('#next'); await ob.keyboard.press('Enter');
    check('onboarding: teclado avança e move o foco para o título', await ob.evaluate(() => document.activeElement.id === 'h2' && !document.getElementById('step2').hidden));
    await ob.screenshot({ path: path.join(SHOTS, 'onboarding-2.png') });
    await ob.click('#next');
    await ob.click('label[for=o-high]');
    check('onboarding: axe sem violações (passo 3)', (await axe(ob)).length === 0, (await axe(ob)).join(', '));
    await ob.screenshot({ path: path.join(SHOTS, 'onboarding-3.png') });
    await ob.click('label[for=o-medium]');
    await ob.click('#next'); await ob.waitForTimeout(500);
    const st = await sw.evaluate(() => new Promise(r => chrome.storage.local.get(['onboarded', 'settings'], r)));
    check('onboarding: conclui, grava sensibilidade e abre o X', st.onboarded === true && st.settings.sensitivity === 'medium' && /x\.com/.test(ob.url()), ob.url());
    await ob.close();
  }

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('https://x.com/home');
  await page.waitForSelector('#t-copy-3', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const level = id => page.$eval('#' + id, a => a.dataset.ugLevel || 'none').catch(() => 'missing');
  const badge = id => page.$eval('#' + id, a => { const b = a.querySelector('.ug-badge'); return b ? b.textContent : ''; });
  const expect = { 't-red': 'red', 't-check': 'none', 't-neutral': 'none', 't-obf': 'yellow', 't-quote-debunk': 'none',
    't-quote-share': 'yellow', 't-alt': 'yellow', 't-card': 'yellow', 't-copy-1': 'red', 't-copy-2': 'red', 't-copy-3': 'red', 't-neutral-2': 'none' };
  for (const [id, lv] of Object.entries(expect)) {
    const got = await level(id); const b = await badge(id);
    check(`nível ${id}`, got === lv && (lv === 'none' ? b === '' : b.length > 0), `esperado ${lv}, obtido ${got}${b ? ' [' + b + ']' : ''}`);
  }
  const visible = await page.$$eval('article', as => as.every(a => a.offsetHeight > 0));
  check('nenhum post foi ocultado', visible);
  check('selo ao lado do nome (dentro de User-Name)', await page.$eval('#t-red', a => !!a.querySelector('[data-testid="User-Name"] .ug-badge')));
  check('sinal de handle numérico lido do DOM', /handle com longa/.test(await page.$eval('#t-red .ug-panel', p => p.textContent)));
  const copySignals = await page.$eval('#t-copy-1 .ug-panel', p => p.textContent);
  check('copypasta coordenada detectada (3 contas, re-pontua o 1º post)', /3 contas/.test(copySignals));
  check('mesmo link compartilhado detectado', /mesmo link/.test(copySignals));
  const qs = await page.$eval('#t-quote-share .ug-panel', p => p.textContent);
  check('tweet citado identificado como fonte', /tweet citado/.test(qs));
  check('alt text de imagem lido', /imagem\/card/.test(await page.$eval('#t-alt .ug-panel', p => p.textContent)));

  // painel de detalhes, sem propagar clique para o tweet
  await page.click('#t-red .ug-badge');
  const panelVisible = await page.$eval('#t-red .ug-panel', p => !p.hidden);
  check('clique no selo abre o painel de detalhes', panelVisible);
  check('clique no selo não propaga para o tweet', (await page.evaluate(() => window.navigations)) === 0);
  const links = await page.$$eval('#t-red .ug-panel a', as => as.map(a => a.href));
  check('selo: rótulo simples + "por quê?" + aria-expanded', /Alto risco/.test(await badge('t-red')) && /por quê\?/.test(await badge('t-red')) &&
    (await page.$eval('#t-red .ug-badge', b => b.getAttribute('aria-expanded'))) === 'true');
  check('painel explica em linguagem simples (motivos principais)', await page.$eval('#t-red .ug-panel', p => p.querySelectorAll('.ug-reasons li').length >= 1 && /Principais motivos/.test(p.textContent)));
  check('selo e painel: axe sem violações', (await axe(page, ['#t-red .ug-badge-wrap', '#t-red .ug-panel'])).length === 0, (await axe(page, ['#t-red .ug-badge-wrap', '#t-red .ug-panel'])).join(', '));
  await page.focus('#t-red .ug-close'); await page.keyboard.press('Escape');
  check('Esc fecha o painel e devolve o foco ao selo', await page.evaluate(() => document.querySelector('#t-red .ug-panel').hidden && document.activeElement === document.querySelector('#t-red .ug-badge')));
  await page.focus('#t-red .ug-badge'); await page.keyboard.press('Enter');
  check('teclado (Enter) abre o painel', await page.$eval('#t-red .ug-panel', p => !p.hidden));
  check('links oficiais do TSE no painel', links.includes('https://www.justicaeleitoral.jus.br/fato-ou-boato/') && links.some(l => l.includes('tse.jus.br')));
  await page.click('#t-copy-1 .ug-badge');
  await page.locator('#t-red').screenshot({ path: path.join(SHOTS, 'painel-alto-risco.png') });

  // hover card com bio → re-pontuação do autor
  await page.evaluate(() => window.showHoverCard());
  await page.waitForTimeout(800);
  check('hover card (bio/seguidores) eleva @carlosmendes para vermelho', (await level('t-obf')) === 'red',
    await page.$eval('#t-obf', a => (a.querySelector('.ug-panel') || {}).textContent || '').then(t => t.slice(0, 0)) || await level('t-obf'));
  check('sinal de bio presente', /perfil reserva/.test(await page.$eval('#t-obf .ug-panel', p => p.textContent)));
  await page.evaluate(() => document.querySelector('[data-testid=HoverCard]').remove());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(SHOTS, 'timeline.png'), fullPage: true });

  // feedback "não é desinformação"
  await page.click('#t-alt .ug-badge');
  await page.click('#t-alt .ug-fb');
  await page.waitForTimeout(800);
  check('feedback remove o selo do autor (lista de confiança)', (await level('t-alt')) === 'none');

  // storage
  const store = await sw.evaluate(() => new Promise(r => chrome.storage.local.get(null, r)));
  check('itens sinalizados gravados em chrome.storage.local', (store.flagged || []).length >= 8, `${(store.flagged || []).length} itens`);
  check('contador por nível', store.counter && store.counter.red >= 4 && store.counter.yellow >= 1, JSON.stringify({ y: store.counter.yellow, r: store.counter.red }));
  check('contador por categoria', store.counter && Object.keys(store.counter.categories || {}).length >= 5, Object.keys(store.counter.categories || {}).join(','));
  check('feedback gravado e autor na lista de confiança', (store.settings.allowlist || []).includes('luciaprado') && Object.keys(store.feedback.labels).length > 0);
  check('item marcado com userFeedback', (store.flagged || []).some(f => f.handle === 'luciaprado' && f.userFeedback));

  // desativar → selos somem; reativar → voltam
  await sw.evaluate(() => new Promise(r => chrome.storage.local.get('settings', s => chrome.storage.local.set({ settings: Object.assign(s.settings, { enabled: false }) }, r))));
  await page.waitForTimeout(500);
  check('desligar remove todos os selos', (await page.$$('.ug-badge')).length === 0);
  await sw.evaluate(() => new Promise(r => chrome.storage.local.get('settings', s => chrome.storage.local.set({ settings: Object.assign(s.settings, { enabled: true }) }, r))));
  await page.waitForTimeout(500);
  check('religar restaura selos', (await page.$$('.ug-badge')).length >= 7);
  check('content script sem erros no console', errors.length === 0, errors.join(' | '));

  // popup
  const pop = await ctx.newPage(); const popErr = [];
  pop.on('pageerror', e => popErr.push(e.message)); pop.on('console', m => { if (m.type() === 'error') popErr.push(m.text()); });
  await pop.setViewportSize({ width: 380, height: 600 });
  await pop.goto(`chrome-extension://${extId}/src/popup.html`);
  await pop.waitForTimeout(500);
  check('popup: contadores de hoje', (await pop.textContent('#todayRed')) !== '0', `hoje: vermelho=${await pop.textContent('#todayRed')} amarelo=${await pop.textContent('#todayYellow')}`);
  check('popup: sensibilidade média marcada', await pop.isChecked('#sens-medium'));
  check('popup: axe sem violações', (await axe(pop)).length === 0, (await axe(pop)).join(', '));
  await pop.screenshot({ path: path.join(SHOTS, 'popup.png') });
  await pop.click('label[for=sens-high]'); await pop.waitForTimeout(300);
  const sh = await sw.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(x.settings))));
  check('popup: sensibilidade alta aplica limiares', sh.sensitivity === 'high' && sh.disinfoYellow === 2, JSON.stringify({ s: sh.sensitivity, y: sh.disinfoYellow }));
  await pop.click('label[for=sens-medium]'); await pop.waitForTimeout(300);
  await pop.click('.toggle'); await pop.waitForTimeout(500);
  check('popup: interruptor desliga (e remove selos)', !(await pop.isChecked('#enabled')) && /Desligado/.test(await pop.textContent('#stateLabel')) && (await page.$$('.ug-badge')).length === 0);
  await pop.click('.toggle'); await pop.waitForTimeout(500);
  check('popup: interruptor religa', (await pop.isChecked('#enabled')) && (await page.$$('.ug-badge')).length >= 7);
  await pop.click('#data summary');
  check('popup: contadores', (await pop.textContent('#red')) !== '0', `vermelho=${await pop.textContent('#red')} amarelo=${await pop.textContent('#yellow')}`);
  check('popup: estatísticas por categoria', (await pop.$$('#stats .stat')).length >= 5);
  const [dl] = await Promise.all([pop.waitForEvent('download', { timeout: 5000 }).catch(() => null), pop.click('#exportCsv')]);
  if (dl) { const p = path.join(SHOTS, 'export.csv'); await dl.saveAs(p); const csv = fs.readFileSync(p, 'utf8'); check('exportação CSV', csv.includes('disinfoScore') && csv.split('\n').length >= 9, `${csv.split('\n').length - 1} linhas`); }
  else check('exportação CSV', false, 'download não ocorreu');
  const [dj] = await Promise.all([pop.waitForEvent('download', { timeout: 5000 }).catch(() => null), pop.click('#exportJson')]);
  if (dj) { const p = path.join(SHOTS, 'export.json'); await dj.saveAs(p); const j = JSON.parse(fs.readFileSync(p, 'utf8')); check('exportação JSON', Array.isArray(j.items) && j.items.length >= 8, `${j.items.length} itens`); }
  else check('exportação JSON', false, 'download não ocorreu');
  await pop.screenshot({ path: path.join(SHOTS, 'popup-dados.png'), fullPage: true });
  check('popup sem erros no console', popErr.length === 0, popErr.join(' | '));

  // opções
  const opt = await ctx.newPage(); const optErr = [];
  opt.on('pageerror', e => optErr.push(e.message)); opt.on('console', m => { if (m.type() === 'error') optErr.push(m.text()); });
  await opt.goto(`chrome-extension://${extId}/src/options.html`);
  await opt.waitForTimeout(500);
  check('opções: palavras-chave carregadas', JSON.parse(await opt.inputValue('#keywords')).length >= 40);
  check('opções: lista de confiança mostra feedback', (await opt.inputValue('#allowlist')).includes('@luciaprado'));
  await opt.fill('#blocklist', '@anacosta\n@invalido!!');
  await opt.fill('#disinfoYellow', '2.5');
  await opt.click('#save'); await opt.waitForTimeout(400);
  const s2 = await sw.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(x.settings))));
  check('opções: salvar persiste listas e limiares', JSON.stringify(s2.blocklist) === '["anacosta"]' && s2.disinfoYellow === 2.5 && s2.keywords === null, JSON.stringify({ b: s2.blocklist, y: s2.disinfoYellow }));
  await opt.fill('#keywords', '[{"pattern":"(" }]'); await opt.click('#save'); await opt.waitForTimeout(200);
  check('opções: rejeita regex inválida', /Erro/.test(await opt.textContent('#status')));
  await opt.screenshot({ path: path.join(SHOTS, 'opcoes.png'), fullPage: true });
  check('opções sem erros no console', optErr.length === 0, optErr.join(' | '));
  check('nenhuma requisição de rede externa feita pela extensão', external.length === 0, external.join(', '));

  await ctx.close();
  console.log(results.join('\n'));
  console.log(`\n${results.length - failed}/${results.length} verificações OK`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
