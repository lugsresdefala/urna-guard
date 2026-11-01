/* Exportação e limpeza (compartilhado entre popup e opções). Gera arquivos localmente, sem rede. */
function ugDownload(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function ugToCsv(items) {
  const cols = ['id', 'level', 'seenAt', 'postedAt', 'handle', 'displayName', 'url', 'disinfoScore', 'accountScore', 'categories', 'disinfoSignals', 'accountSignals', 'userFeedback', 'text', 'quoted'];
  const esc = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = items.map(i => [i.id, i.level, i.seenAt, i.postedAt, i.handle, i.displayName, i.url,
    i.disinfo && i.disinfo.score, i.account && i.account.score, (i.categories || []).join('|'),
    ((i.disinfo && i.disinfo.signals) || []).map(s => s.label + ':' + s.weight).join('|'),
    ((i.account && i.account.signals) || []).map(s => s.label + ':' + s.weight).join('|'),
    i.userFeedback || '', i.text, i.quoted].map(esc).join(','));
  return '\ufeff' + [cols.join(','), ...rows].join('\n');
}
function ugExport(fmt) {
  chrome.storage.local.get(['flagged'], r => {
    const items = r.flagged || []; const ts = new Date().toISOString().replace(/[:.]/g, '-');
    if (fmt === 'csv') ugDownload(`urna-guard-${ts}.csv`, ugToCsv(items), 'text/csv;charset=utf-8');
    else ugDownload(`urna-guard-${ts}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), tool: 'Urna Guard 2.0',
      aviso: 'Heurísticas, não são prova. Contém dados pessoais (LGPD): trate com responsabilidade.', items }, null, 2), 'application/json');
  });
}
function ugClear(cb) {
  if (confirm('Apagar todos os itens sinalizados e o contador? (feedback e listas são mantidos)'))
    chrome.storage.local.set({ flagged: [], counter: { yellow: 0, red: 0, categories: {} } }, cb);
}
function ugRenderStats(container, counter, flagged) {
  const S = globalThis.UrnaGuardScoring; const cats = (counter && counter.categories) || {};
  container.textContent = '';
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { container.textContent = 'Nenhum item sinalizado ainda.'; return; }
  const max = entries[0][1];
  entries.forEach(([c, n]) => {
    const row = document.createElement('div'); row.className = 'stat';
    const lab = document.createElement('span'); lab.className = 'stat-l'; lab.textContent = (S.CATEGORIES[c] || c);
    const bar = document.createElement('span'); bar.className = 'stat-b'; bar.style.width = Math.max(4, Math.round(n / max * 100)) + '%';
    const num = document.createElement('span'); num.className = 'stat-n'; num.textContent = n;
    const track = document.createElement('span'); track.className = 'stat-t'; track.appendChild(bar);
    row.append(lab, track, num); container.appendChild(row);
  });
}
