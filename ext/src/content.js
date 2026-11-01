/* Urna Guard – content script.
 * Apenas LÊ o DOM já renderizado e adiciona um selo visual. Nunca oculta, denuncia, curte, responde
 * ou faz qualquer requisição de rede. Nenhum token ou API privada é usado. */
(function () {
  'use strict';
  if (window.__urnaGuardLoaded) return; window.__urnaGuardLoaded = true;
  const S = globalThis.UrnaGuardScoring;
  const FACT_LINKS = [
    ['TSE – Fato ou Boato', 'https://www.justicaeleitoral.jus.br/fato-ou-boato/'],
    ['TSE – Segurança da urna', 'https://www.tse.jus.br/eleicoes/urna-eletronica/seguranca-da-urna']
  ];
  // Seletores com alternativas (o markup do X muda com frequência).
  const SEL = {
    tweet: 'article[data-testid="tweet"], article[role="article"], div[data-testid="tweet"]',
    text: '[data-testid="tweetText"], div[lang][dir="auto"]',
    userName: '[data-testid="User-Name"]',
    avatar: '[data-testid="Tweet-User-Avatar"] img, [data-testid^="UserAvatar-Container"] img, img[src*="profile_images"], img[src*="default_profile"]',
    avatarBox: '[data-testid="Tweet-User-Avatar"], [data-testid^="UserAvatar-Container"]',
    verified: '[data-testid="icon-verified"], svg[aria-label*="erificad"], svg[aria-label*="erified"]',
    photo: '[data-testid="tweetPhoto"] img[alt], img[alt][src*="/media/"]',
    card: '[data-testid="card.wrapper"], [data-testid^="card.layout"]',
    userInfoBox: '[data-testid="HoverCard"], [data-testid="UserCell"]',
    bio: '[data-testid="UserDescription"]'
  };
  const GENERIC_ALT = /^(imagem|image|foto|photo|gif|video|vídeo)$/i;

  let settings = Object.assign({}, S.DEFAULT_SETTINGS);
  let labelAdjust = {};
  const tracker = S.createSessionTracker();
  const profileCache = new Map();
  const ingested = new WeakMap();    // article -> { post, entry }
  const byHandle = new Map();        // handle -> Set<article>
  const sessionLevels = new Map();   // id -> level já registrado

  const lc = s => String(s || '').replace(/^@/, '').toLowerCase();
  const listHas = (list, h) => (list || []).map(lc).includes(lc(h));

  function loadState(cb) {
    chrome.storage.local.get(['settings', 'feedback'], r => {
      settings = Object.assign({}, S.DEFAULT_SETTINGS, r.settings || {});
      labelAdjust = S.feedbackMultipliers((r.feedback || {}).labels);
      cb && cb();
    });
  }
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && (c.settings || c.feedback)) loadState(rescanAll);
  });

  // ---------- leitura de perfil (página de perfil, hover card, UserCell) ----------
  const MONTHS = { janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
  function parseJoinDate(t) {
    const n = S.normalize(t).replace(/ de /g, ' ').split(' ');
    const mi = n.findIndex(w => w in MONTHS); const y = n.find(w => /^\d{4}$/.test(w));
    return mi >= 0 && y ? new Date(Date.UTC(+y, MONTHS[n[mi]], 1)).toISOString() : null;
  }
  function parseCount(t) {
    const m = String(t).replace(/\u00a0/g, ' ').match(/([\d.,]+)\s*(mil|mi|k|m|b)?\b/i);
    if (!m) return null;
    let raw = m[1];
    const u = (m[2] || '').toLowerCase();
    if (u) raw = raw.replace(',', '.'); else raw = raw.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.');
    let num = parseFloat(raw);
    if (u === 'mil' || u === 'k') num *= 1e3; else if (u === 'mi' || u === 'm') num *= 1e6; else if (u === 'b') num *= 1e9;
    return isNaN(num) ? null : Math.round(num);
  }
  function handleFrom(root) {
    for (const a of root.querySelectorAll('a[href^="/"]')) {
      const h = a.getAttribute('href');
      if (/^\/[A-Za-z0-9_]{1,15}$/.test(h) && !/^\/(home|explore|search|notifications|messages|i|settings)$/.test(h)) return h.slice(1);
    }
    for (const sp of root.querySelectorAll('span')) { const m = sp.textContent.trim().match(/^@([A-Za-z0-9_]{1,15})$/); if (m) return m[1]; }
    return '';
  }
  function readCounts(root, p) {
    root.querySelectorAll('a[href$="/followers"], a[href$="/verified_followers"], a[href$="/following"]').forEach(a => {
      const n = parseCount(a.textContent); if (n == null) return;
      if (/\/following$/.test(a.getAttribute('href'))) p.following = n; else p.followers = n;
    });
  }
  function mergeProfile(handle, data) {
    if (!handle) return;
    const k = lc(handle); const old = profileCache.get(k) || {};
    const merged = Object.assign({}, old, data);
    if (JSON.stringify(old) === JSON.stringify(merged)) return;
    profileCache.set(k, merged);
    (byHandle.get(k) || new Set()).forEach(a => { if (a.isConnected) evaluate(a); });
  }
  function readProfileSources() {
    const nameEl = document.querySelector('[data-testid="UserName"]');
    const m = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})(\/|$)/);
    if (nameEl && m) {
      const p = {};
      const join = document.querySelector('[data-testid="UserJoinDate"]');
      if (join) { const d = parseJoinDate(join.textContent); if (d) p.joinDate = d; }
      readCounts(document, p);
      const bio = document.querySelector('[data-testid="primaryColumn"] ' + SEL.bio) || document.querySelector(SEL.bio);
      if (bio) p.bio = bio.innerText;
      const h2 = document.querySelector('[data-testid="primaryColumn"] h2[role="heading"]');
      const sub = h2 && h2.parentElement && h2.parentElement.querySelector('div[dir]:not(h2 *)');
      if (sub) { const n = parseCount(sub.textContent); if (n != null && /post|tweet/i.test(sub.textContent)) p.postsCount = n; }
      mergeProfile(m[1], p);
    }
    document.querySelectorAll(SEL.userInfoBox).forEach(box => {
      const h = handleFrom(box); if (!h) return;
      const p = {}; const bio = box.querySelector(SEL.bio) || box.querySelector('div[dir="auto"]:not([data-testid])');
      if (bio && bio.innerText.trim().length > 3) p.bio = bio.innerText;
      readCounts(box, p);
      mergeProfile(h, p);
    });
  }

  // ---------- leitura do tweet ----------
  function quoteWrapOf(el, article) {
    const w = el.closest('div[role="link"]');
    return w && article.contains(w) && w !== article ? w : null;
  }
  function readTweet(article) {
    const texts = [...article.querySelectorAll('[data-testid="tweetText"]')];
    const allTexts = texts.length ? texts : [...article.querySelectorAll('div[lang][dir="auto"]')];
    const mainTextEl = allTexts.find(e => !quoteWrapOf(e, article)) || null;
    const quotedTextEl = allTexts.find(e => quoteWrapOf(e, article)) || null;
    const names = [...article.querySelectorAll(SEL.userName)];
    const userEl = names.find(e => !quoteWrapOf(e, article)) || names[0] || null;
    let handle = userEl ? handleFrom(userEl) : '';
    let displayName = '';
    if (userEl) {
      const first = userEl.querySelector('a') || userEl;
      displayName = (first.innerText || first.textContent || '').split('\n')[0].trim();
      if (/^@/.test(displayName)) displayName = '';
    }
    const verified = !!(userEl && userEl.querySelector(SEL.verified));
    const avatarImgs = [...article.querySelectorAll(SEL.avatar)].filter(i => !quoteWrapOf(i, article));
    const boxes = [...article.querySelectorAll(SEL.avatarBox)].filter(i => !quoteWrapOf(i, article));
    const img = avatarImgs[0];
    const src = img ? img.getAttribute('src') || '' : '';
    let defaultAvatar = false, hasAvatar;
    if (img) { hasAvatar = true; defaultAvatar = /default_profile/.test(src); } else if (boxes.length) hasAvatar = false;
    const author = Object.assign({ handle, displayName, verified, defaultAvatar, hasAvatar }, profileCache.get(lc(handle)) || {});
    const extra = [];
    article.querySelectorAll(SEL.photo).forEach(i => { const a = (i.getAttribute('alt') || '').trim(); if (a && !GENERIC_ALT.test(a)) extra.push(a); });
    const links = [];
    article.querySelectorAll(SEL.card).forEach(c => {
      const t = (c.innerText || '').trim(); if (t) extra.push(t);
      c.querySelectorAll('a[aria-label], a[href]').forEach(a => {
        const lab = a.getAttribute('aria-label'); if (lab) { extra.push(lab); const d = lab.match(/[a-z0-9-]+\.[a-z.]{2,}(\/\S*)?/i); if (d) links.push(d[0]); }
      });
    });
    if (mainTextEl) mainTextEl.querySelectorAll('a').forEach(a => {
      const t = (a.innerText || a.textContent || '').trim();
      if (t && !/^[@#]/.test(t)) links.push(t.replace(/…$/, ''));
    });
    const timeEl = [...article.querySelectorAll('time')].find(t => !quoteWrapOf(t, article));
    const link = timeEl && timeEl.closest('a') ? timeEl.closest('a').href : '';
    return {
      text: mainTextEl ? mainTextEl.innerText : '',
      quoted: quotedTextEl ? quotedTextEl.innerText : '',
      extra: [...new Set(extra)], links, author, url: link,
      time: timeEl ? timeEl.getAttribute('datetime') : null
    };
  }

  // ---------- avaliação ----------
  function ingest(article) {
    let st = ingested.get(article);
    if (st) return st;
    const post = readTweet(article);
    if (!post.text && !post.quoted && !post.extra.length) return null;
    const entry = tracker.add({ text: [post.text, post.extra.join(' ')].join(' '), handle: post.author.handle, links: post.links, time: Date.now() });
    st = { post, entry };
    ingested.set(article, st);
    const h = lc(post.author.handle);
    if (!byHandle.has(h)) byHandle.set(h, new Set());
    byHandle.get(h).add(article);
    if (entry.group) {
      entry.group.articles = entry.group.articles || new Set();
      entry.group.articles.add(article);
      if (entry.group.authors.size >= 2) entry.group.articles.forEach(a => { if (a !== article && a.isConnected) evaluate(a); });
    }
    return st;
  }

  function evaluate(article) {
    const st = ingest(article);
    clearUi(article);
    if (!st || !settings.enabled) return;
    const post = st.post;
    post.author = Object.assign({}, post.author, profileCache.get(lc(post.author.handle)) || {});
    if (listHas(settings.allowlist, post.author.handle)) return;
    const live = tracker.state(st.entry);
    const dis = S.scoreDisinformation({ text: post.text, quoted: post.quoted, extra: post.extra },
      { keywords: settings.keywords || S.DEFAULT_KEYWORDS, labelAdjust });
    const acc = S.scoreAccount(post.author, { text: post.text, dupAuthors: live.dupAuthors, linkAuthors: live.linkAuthors, burst: live.burst,
      blocklisted: listHas(settings.blocklist, post.author.handle) });
    const level = S.classify(dis, acc, settings);
    article.dataset.ugLevel = level;
    if (level === 'none') return;
    const id = S.hashString((post.url || post.author.handle) + '|' + post.text + '|' + post.quoted);
    injectBadge(article, { id, level, dis, acc, post });
    record({ id, level, dis, acc, post, fingerprint: live.fingerprint });
  }

  // ---------- UI ----------
  function clearUi(article) { article.querySelectorAll('.ug-badge-wrap, .ug-panel').forEach(e => e.remove()); delete article.dataset.ugLevel; }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const stop = e => { e.stopPropagation(); };

  function injectBadge(article, item) {
    const { level, dis, acc } = item;
    const wrap = el('span', 'ug-badge-wrap');
    const btn = el('button', 'ug-badge ug-' + level, level === 'red' ? '⛔ Urna Guard: alto risco' : '⚠️ Urna Guard: atenção');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.title = 'Ver por que este post foi sinalizado';
    wrap.appendChild(btn);
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'keydown'].forEach(ev => wrap.addEventListener(ev, stop));

    const panel = el('div', 'ug-panel ug-panel-' + level);
    panel.hidden = true;
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'keydown'].forEach(ev => panel.addEventListener(ev, stop));
    const head = el('div', 'ug-head');
    head.append(el('strong', null, level === 'red' ? 'Alto risco' : 'Atenção'),
      el('span', 'ug-scores', ` · desinformação ${dis.score} · conta ${acc.score}`));
    panel.appendChild(head);
    if (dis.categories.length) {
      const chips = el('div', 'ug-chips');
      dis.categories.forEach(c => chips.appendChild(el('span', 'ug-chip', S.CATEGORIES[c] || c)));
      panel.appendChild(chips);
    }
    const section = (title, sigs) => {
      panel.appendChild(el('div', 'ug-sec', title));
      const ul = el('ul');
      (sigs.length ? sigs : [{ label: 'nenhum sinal' }]).forEach(s => {
        const extra = s.weight != null ? ` (${s.weight > 0 ? '+' : ''}${s.weight}${s.source && s.source !== 'texto' ? ', ' + s.source : ''})` : '';
        ul.appendChild(el('li', null, s.label + extra));
      });
      panel.appendChild(ul);
    };
    section('Sinais de desinformação', dis.signals);
    section('Sinais de conta suspeita', acc.signals);
    const links = el('div', 'ug-links');
    FACT_LINKS.forEach(([label, href]) => { const a = el('a', null, label); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; links.appendChild(a); });
    panel.appendChild(links);
    const actions = el('div', 'ug-actions');
    const fb = el('button', 'ug-fb', 'Não é desinformação'); fb.type = 'button';
    fb.title = 'Registra seu feedback localmente, reduz o peso destes sinais e adiciona o autor à sua lista de confiança';
    const close = el('button', 'ug-close', 'Fechar'); close.type = 'button';
    actions.append(fb, close);
    panel.appendChild(actions);
    panel.appendChild(el('p', 'ug-disc', 'Heurística automática, não é prova. Pode haver falsos positivos. Não use para assediar ninguém. Nada foi ocultado ou denunciado.'));

    const toggle = () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); };
    btn.addEventListener('click', e => { e.preventDefault(); toggle(); });
    close.addEventListener('click', e => { e.preventDefault(); toggle(); });
    fb.addEventListener('click', e => { e.preventDefault(); giveFeedback(item); });

    const userEl = [...article.querySelectorAll(SEL.userName)].find(e => !quoteWrapOf(e, article));
    if (userEl) userEl.appendChild(wrap); else article.prepend(wrap);
    const textEl = [...article.querySelectorAll(SEL.text)].find(e => !quoteWrapOf(e, article));
    if (textEl && textEl.parentElement) textEl.parentElement.insertBefore(panel, textEl.nextSibling); else wrap.after(panel);
  }

  function giveFeedback(item) {
    chrome.storage.local.get(['settings', 'feedback', 'flagged'], r => {
      const fbk = r.feedback || { labels: {}, items: [] };
      fbk.labels = fbk.labels || {}; fbk.items = fbk.items || [];
      item.dis.signals.filter(s => s.weight > 0 && s.category !== 'enfase').forEach(s => { fbk.labels[s.label] = (fbk.labels[s.label] || 0) + 1; });
      fbk.items.push({ id: item.id, handle: item.post.author.handle, text: item.post.text.slice(0, 280), at: new Date().toISOString() });
      while (fbk.items.length > 500) fbk.items.shift();
      const st = Object.assign({}, S.DEFAULT_SETTINGS, r.settings || {});
      if (item.post.author.handle && !listHas(st.allowlist, item.post.author.handle)) st.allowlist = [...(st.allowlist || []), item.post.author.handle];
      const flagged = (r.flagged || []).map(f => f.id === item.id ? Object.assign({}, f, { userFeedback: 'nao_e_desinformacao' }) : f);
      chrome.storage.local.set({ feedback: fbk, settings: st, flagged });
    });
  }

  // ---------- gravação local com fila (evita condição de corrida) ----------
  const queue = []; let flushTimer = null;
  function record(r) {
    const prev = sessionLevels.get(r.id);
    if (prev === r.level || prev === 'red') return;
    sessionLevels.set(r.id, r.level);
    queue.push({ prev, item: {
      id: r.id, level: r.level, url: r.post.url, handle: r.post.author.handle, displayName: r.post.author.displayName,
      text: r.post.text.slice(0, 500), quoted: r.post.quoted.slice(0, 280), postedAt: r.post.time, seenAt: new Date().toISOString(),
      categories: r.dis.categories, disinfo: { score: r.dis.score, signals: r.dis.signals }, account: { score: r.acc.score, signals: r.acc.signals },
      fingerprint: r.fingerprint
    } });
    clearTimeout(flushTimer); flushTimer = setTimeout(flush, 300);
  }
  function flush() {
    const batch = queue.splice(0);
    if (!batch.length) return;
    chrome.storage.local.get(['flagged', 'counter'], r => {
      const flagged = r.flagged || [];
      const counter = Object.assign({ yellow: 0, red: 0, categories: {} }, r.counter || {});
      counter.categories = counter.categories || {};
      for (const { prev, item } of batch) {
        const i = flagged.findIndex(f => f.id === item.id);
        if (i >= 0) {
          const old = flagged[i];
          if (old.level !== item.level) { counter[old.level] = Math.max(0, (counter[old.level] || 0) - 1); counter[item.level] = (counter[item.level] || 0) + 1; }
          flagged[i] = Object.assign({}, old, item);
        } else {
          flagged.push(item);
          counter[item.level] = (counter[item.level] || 0) + 1;
          item.categories.forEach(c => { counter.categories[c] = (counter.categories[c] || 0) + 1; });
        }
      }
      while (flagged.length > 1000) flagged.shift();
      chrome.storage.local.set({ flagged, counter });
    });
  }

  // ---------- varredura ----------
  function scan() {
    document.querySelectorAll(SEL.tweet).forEach(a => {
      if (a.parentElement && a.parentElement.closest(SEL.tweet)) return; // ignora artigos aninhados
      if (!ingested.has(a)) evaluate(a);
    });
  }
  function rescanAll() { document.querySelectorAll(SEL.tweet).forEach(a => { if (!(a.parentElement && a.parentElement.closest(SEL.tweet))) evaluate(a); }); }

  let pending = false;
  const obs = new MutationObserver(muts => {
    if (muts.every(m => [...m.addedNodes].every(n => n.nodeType === 1 && n.classList && (n.classList.contains('ug-badge-wrap') || n.classList.contains('ug-panel'))))) return;
    if (pending) return; pending = true;
    setTimeout(() => { pending = false; readProfileSources(); scan(); }, 150);
  });
  loadState(() => {
    obs.observe(document.body, { childList: true, subtree: true });
    readProfileSources(); scan();
  });
})();
