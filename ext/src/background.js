/* Urna Guard – service worker mínimo: inicializa o armazenamento local e abre o onboarding na 1ª instalação. Sem rede. */
chrome.runtime.onInstalled.addListener(details => {
  chrome.storage.local.get(['settings', 'flagged', 'counter', 'feedback', 'onboarded'], r => {
    const init = {};
    if (!r.settings) init.settings = { enabled: true, disinfoYellow: 3, disinfoRed: 6, accountYellow: 3, accountRed: 5, keywords: null, allowlist: [], blocklist: [], sensitivity: 'medium' };
    if (!r.flagged) init.flagged = [];
    if (!r.counter) init.counter = { yellow: 0, red: 0, categories: {} };
    if (!r.feedback) init.feedback = { labels: {}, items: [] };
    if (Object.keys(init).length) chrome.storage.local.set(init);
    if (details && details.reason === 'install' && !r.onboarded) chrome.tabs.create({ url: chrome.runtime.getURL('src/welcome.html') });
  });
});
