const $ = id => document.getElementById(id);
const S = globalThis.UrnaGuardScoring;
const NUMS = ['disinfoYellow', 'disinfoRed', 'accountYellow', 'accountRed'];
const parseList = t => [...new Set(t.split(/[\s,;]+/).map(h => h.trim().replace(/^@/, '')).filter(h => /^[A-Za-z0-9_]{1,15}$/.test(h)))];
$('cats').textContent = Object.keys(S.CATEGORIES).join(', ');
function load() {
  chrome.storage.local.get(['settings', 'flagged', 'counter', 'feedback'], r => {
    const s = Object.assign({}, S.DEFAULT_SETTINGS, r.settings || {});
    $('enabled').checked = s.enabled; NUMS.forEach(k => $(k).value = s[k]);
    $('allowlist').value = (s.allowlist || []).map(h => '@' + h).join('\n');
    $('blocklist').value = (s.blocklist || []).map(h => '@' + h).join('\n');
    $('keywords').value = JSON.stringify(s.keywords || S.DEFAULT_KEYWORDS, null, 2);
    const c = r.counter || {}; $('yellow').textContent = c.yellow || 0; $('red').textContent = c.red || 0;
    $('total').textContent = (r.flagged || []).length;
    ugRenderStats($('stats'), c, r.flagged || []);
    const fb = r.feedback || { labels: {}, items: [] };
    const mult = S.feedbackMultipliers(fb.labels);
    const ent = Object.entries(fb.labels || {});
    $('feedback').textContent = ent.length
      ? ent.map(([l, n]) => `${l}: ${n}× (peso ×${mult[l].toFixed(2)})`).join(' · ') + ` — ${(fb.items || []).length} itens marcados`
      : 'Nenhum feedback registrado.';
  });
}
function status(m, err) { $('status').textContent = m; $('status').className = err ? 'err' : 'ok'; }
$('save').onclick = () => {
  let kw;
  try {
    kw = JSON.parse($('keywords').value);
    if (!Array.isArray(kw)) throw new Error('precisa ser uma lista');
    kw.forEach((k, i) => { if (typeof k.pattern !== 'string') throw new Error(`item ${i + 1} sem "pattern"`); new RegExp(k.pattern); });
  } catch (e) { return status('Erro nas palavras-chave: ' + e.message, true); }
  const isDefault = JSON.stringify(kw) === JSON.stringify(S.DEFAULT_KEYWORDS);
  const s = { enabled: $('enabled').checked, keywords: isDefault ? null : kw, allowlist: parseList($('allowlist').value), blocklist: parseList($('blocklist').value) };
  NUMS.forEach(k => { const v = parseFloat($(k).value); s[k] = v >= 1 ? v : S.DEFAULT_SETTINGS[k]; });
  chrome.storage.local.set({ settings: s }, () => { status('Salvo.'); load(); });
};
$('reset').onclick = () => chrome.storage.local.get(['settings'], r => {
  const old = r.settings || {};
  chrome.storage.local.set({ settings: Object.assign({}, S.DEFAULT_SETTINGS, { allowlist: old.allowlist || [], blocklist: old.blocklist || [] }) }, () => { load(); status('Padrão restaurado (listas mantidas).'); });
});
$('resetFeedback').onclick = () => { if (confirm('Zerar todo o feedback?')) chrome.storage.local.set({ feedback: { labels: {}, items: [] } }, load); };
$('exportJson').onclick = () => ugExport('json');
$('exportCsv').onclick = () => ugExport('csv');
$('clear').onclick = () => ugClear(load);
load();
