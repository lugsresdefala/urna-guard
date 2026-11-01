const $ = id => document.getElementById(id);
function refresh() {
  chrome.storage.local.get(['settings', 'flagged', 'counter'], r => {
    $('enabled').checked = !r.settings || r.settings.enabled !== false;
    const c = r.counter || {}; $('yellow').textContent = c.yellow || 0; $('red').textContent = c.red || 0;
    $('total').textContent = (r.flagged || []).length;
    ugRenderStats($('stats'), c, r.flagged || []);
  });
}
$('enabled').addEventListener('change', e => chrome.storage.local.get(['settings'], r =>
  chrome.storage.local.set({ settings: Object.assign({}, UrnaGuardScoring.DEFAULT_SETTINGS, r.settings || {}, { enabled: e.target.checked }) })));
$('exportJson').onclick = () => ugExport('json');
$('exportCsv').onclick = () => ugExport('csv');
$('clear').onclick = () => ugClear(refresh);
chrome.storage.onChanged.addListener(refresh);
refresh();
