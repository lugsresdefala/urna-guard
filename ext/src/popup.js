const $ = id => document.getElementById(id);
const S = UrnaGuardScoring;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const HINT = { low: 'sensLowHint', medium: 'sensMediumHint', high: 'sensHighHint', custom: 'sensCustom' };
function refresh() {
  chrome.storage.local.get(['settings', 'flagged', 'counter'], r => {
    const s = Object.assign({}, S.DEFAULT_SETTINGS, r.settings || {});
    $('enabled').checked = s.enabled !== false;
    $('stateLabel').textContent = ugT(s.enabled !== false ? 'popOn' : 'popOff');
    $('stateHint').textContent = ugT(s.enabled !== false ? 'popOnHint' : 'popOffHint');
    document.body.classList.toggle('off', s.enabled === false);
    const lvl = S.sensitivityOf(s);
    document.querySelectorAll('input[name=sens]').forEach(i => { i.checked = i.value === lvl; });
    $('sensHint').textContent = ugT(HINT[lvl]);
    const c = r.counter || {}; const t = c.today && c.today.date === today() ? c.today : { yellow: 0, red: 0 };
    $('todayYellow').textContent = t.yellow || 0; $('todayRed').textContent = t.red || 0;
    $('yellow').textContent = c.yellow || 0; $('red').textContent = c.red || 0;
    $('total').textContent = (r.flagged || []).length;
    ugRenderStats($('stats'), c, r.flagged || []);
  });
}
const update = patch => chrome.storage.local.get(['settings'], r =>
  chrome.storage.local.set({ settings: Object.assign({}, S.DEFAULT_SETTINGS, r.settings || {}, patch) }));
$('enabled').addEventListener('change', e => update({ enabled: e.target.checked }));
document.querySelectorAll('input[name=sens]').forEach(i => i.addEventListener('change', () => {
  if (i.checked) update(Object.assign({ sensitivity: i.value }, S.SENSITIVITY[i.value]));
}));
$('exportJson').onclick = () => ugExport('json');
$('exportCsv').onclick = () => ugExport('csv');
$('clear').onclick = () => ugClear(refresh);
chrome.storage.onChanged.addListener(refresh);
refresh();
