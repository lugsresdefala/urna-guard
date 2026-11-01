/* Preenche textos das páginas da extensão a partir de _locales (pt-BR / en). */
(function () {
  const T = k => chrome.i18n.getMessage(k) || k;
  document.documentElement.lang = /^pt/i.test(chrome.i18n.getUILanguage()) ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = T(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(e => { e.setAttribute('aria-label', T(e.dataset.i18nAria)); });
  globalThis.ugT = T;
})();
