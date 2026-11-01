/* Urna Guard – service worker mínimo: apenas inicializa o armazenamento local. Sem rede. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'flagged', 'counter', 'feedback'], r => {
    const init = {};
    if (!r.settings) init.settings = { enabled: true, disinfoYellow: 3, disinfoRed: 6, accountYellow: 3, accountRed: 5, keywords: null, allowlist: [], blocklist: [] };
    if (!r.flagged) init.flagged = [];
    if (!r.counter) init.counter = { yellow: 0, red: 0, categories: {} };
    if (!r.feedback) init.feedback = { labels: {}, items: [] };
    if (Object.keys(init).length) chrome.storage.local.set(init);
  });
});
