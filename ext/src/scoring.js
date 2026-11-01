/* Urna Guard – funções de pontuação puras (navegador e Node). Sem rede, sem dependências. */
(function (root) {
  'use strict';

  const DEFAULT_SETTINGS = {
    enabled: true,
    disinfoYellow: 3, disinfoRed: 6,
    accountYellow: 3, accountRed: 5,
    keywords: null,          // null = DEFAULT_KEYWORDS
    allowlist: [],           // handles nunca sinalizados
    blocklist: []            // handles em observação (somam no score de conta)
  };

  const CATEGORIES = {
    fraude: 'Fraude eleitoral', codigo: 'Código-fonte / software', voto_impresso: 'Voto impresso / auditoria',
    golpe: 'Intervenção / golpe', ataques: 'Ataques ao TSE/STF', prevotadas: 'Urnas pré-votadas',
    apuracao: 'Apuração / totalização', hackers: 'Hackers / invasão', venezuela: 'Venezuela / Smartmatic',
    eleitores: 'Eleitores fantasmas', hashtags: 'Hashtags de campanha'
  };

  const K = (category, weight, label, pattern) => ({ category, weight, label, pattern });
  // Padrões aplicados sobre o texto canônico (minúsculo, sem acento, leet desfeito, letras repetidas comprimidas).
  const DEFAULT_KEYWORDS = [
    K('fraude', 4, 'fraude nas urnas', 'fraude (nas|na|das|da|em|nessa|nesta) (urnas?|eleic(ao|oes))'),
    K('fraude', 4, 'urna fraudada', 'urnas? (fraudad[ao]s?|fraudulentas?|viciadas?|adulteradas?)'),
    K('fraude', 4, 'eleição roubada/fraudada', 'eleic(ao|oes) (roubadas?|fraudadas?|manipuladas?)'),
    K('fraude', 4, 'roubaram a eleição', 'roubaram a eleicao|roubo (da|na) eleicao'),
    K('fraude', 3, 'votos desviados', 'votos? (desviados?|roubados?|trocados?|transferidos?)'),
    K('fraude', 3, 'fraude comprovada', 'fraude (comprovada|escancarada|confirmada)'),
    K('fraude', 3, 'votos sumiram', '(milhoes|milhares) de votos (sumiram|desapareceram|anulados)'),
    K('codigo', 4, 'código-fonte secreto', 'codigo[- ]?fonte (secreto|escondido|oculto|fechado|adulterado)'),
    K('codigo', 3, 'algoritmo secreto', 'algoritmo (do tse|das urnas|secreto)'),
    K('codigo', 4, 'software adulterado', 'software (da urna|das urnas|do tse) (e |foi )?(adulterado|manipulado|secreto)'),
    K('codigo', 4, 'programado para transferir votos', 'programad[ao]s? para (dar|transferir|desviar) votos'),
    K('codigo', 4, 'TSE esconde o código', 'tse (esconde|escondeu) o codigo'),
    K('voto_impresso', 2, 'voto impresso já', 'voto impresso ja'),
    K('voto_impresso', 2, 'sem voto impresso não há eleição', 'sem voto impresso (nao ha|nao existe) (eleicao|democracia)'),
    K('voto_impresso', 2, 'voto impresso única saída', 'voto (auditavel|impresso) (e|eh) a unica (forma|saida)'),
    K('voto_impresso', 3, 'urna não auditável', 'urnas? (nao sao|nunca foram|nao e|nao eh) auditave(l|is)'),
    K('voto_impresso', 3, 'impossível auditar', 'impossivel auditar (a |as )?urnas?'),
    K('golpe', 3, 'intervenção já', 'intervencao (militar|federal)( ja)?'),
    K('golpe', 3, 'apelo às Forças Armadas', 'forcas armadas (salvem|intervenham|assumam|ja)|sos forcas armadas'),
    K('golpe', 2, 'artigo 142', 'artigo 142|art 142'),
    K('golpe', 2, 'anular a eleição', 'anular (a |as )?eleic(ao|oes)'),
    K('golpe', 2, 'não reconhecer resultado', '(nao|jamais) (reconhecemos|aceitaremos|aceitamos) (o |a )?(resultado|eleicao)'),
    K('ataques', 4, 'TSE manipula', 'tse (manipula|manipulou|fraudou|frauda|roubou|rouba)'),
    K('ataques', 2, 'STF/TSE comprado', '(stf|tse) (comprado|vendido|aparelhado)'),
    K('ataques', 2, 'ditadura da toga', 'ditadura (do|da) (toga|judiciario|tse)'),
    K('ataques', 4, 'ministros fraudaram', 'ministros? do tse (fraudaram|manipularam)'),
    K('ataques', 4, 'ministro fraudou a eleição', '(moraes|xandao|barroso|fachin) (fraudou|roubou|manipulou) (a eleicao|as urnas|os votos)'),
    K('prevotadas', 4, 'urnas pré-programadas', 'urnas? pre[- ]?(programad|votad|carregad)[ao]s?'),
    K('prevotadas', 4, 'urna já vem com votos', 'urnas? (vem|vieram|chegaram|ja estavam|ja vem) com votos?'),
    K('prevotadas', 3, 'urna completa o voto', 'urna (auto)?complet[aou] ?(o |sozinha )?(o )?voto'),
    K('prevotadas', 3, 'apertei X e saiu Y', 'apert(ei|ou) (o )?\\d+ e (apareceu|saiu|deu) (o )?\\d+'),
    K('prevotadas', 3, 'voto computado para outro', 'votos? (computados?|contados?) para (o )?outro candidato'),
    K('apuracao', 3, 'apuração secreta', 'apuracao (e |eh |foi |e feita em |feita em )?secreta|apuracao (em )?segredo'),
    K('apuracao', 3, 'sala secreta', 'sala secreta|sala escura'),
    K('apuracao', 3, 'contagem secreta', 'contagem (secreta|feita em segredo|em sala fechada)'),
    K('apuracao', 3, 'boletins de urna falsos', 'boletins? de urna (falsos?|adulterados?|forjados?)'),
    K('apuracao', 3, 'totalização manipulada', 'totalizacao (secreta|manipulada)'),
    K('apuracao', 3, 'TSE terceiriza apuração', 'tse terceiriza (a )?apuracao'),
    K('hackers', 4, 'urna hackeada', 'urnas? (hackead|invadid)[ao]s?'),
    K('hackers', 4, 'hackers invadiram o TSE', 'hackers? (invadiram|hackearam|entraram no) (o )?(sistema do )?(tse|urnas?|sistema)'),
    K('hackers', 3, 'hackear urna em minutos', 'hackear (a |uma )?urna (em|com)'),
    K('hackers', 3, 'urna com internet/bluetooth', 'urnas? (tem|possuem|com) (bluetooth|wi-?fi|internet|conexao)'),
    K('venezuela', 2, 'Smartmatic', 'smartmatic'),
    K('venezuela', 3, 'urnas venezuelanas', 'urnas? (venezuelanas?|da venezuela)'),
    K('venezuela', 2, 'mesmo sistema da Venezuela', 'mesmo sistema da venezuela|como na venezuela'),
    K('venezuela', 3, 'urnas fabricadas no exterior', 'urnas? (feitas|fabricadas) (na|pela) (china|venezuela)'),
    K('eleitores', 3, 'mortos votaram', 'mortos (votaram|votando)|eleitores mortos'),
    K('eleitores', 3, 'mais votos que eleitores', 'mais votos (do )?que eleitores'),
    K('hashtags', 3, 'hashtag de narrativa', '#?(fraudenasurnas|urnafraudada|votoimpressoja|tsefraude|brazilwasstolen|brasilfoiroubado|eleicaofraudada|sosffaa|intervencaofederal)')
  ];

  // Contexto de checagem, citação, ironia ou negação: reduz o score.
  const CONTEXT_TERMS = [
    { kind: 'checagem', weight: -3, label: 'contexto de checagem', pattern: 'checagem|checad[ao]|fact[- ]?check|agencia lupa|aos fatos|estadao verifica|projeto comprova|boatos org|e-?farsas' },
    { kind: 'desmentido', weight: -3, label: 'desmentido', pattern: '(e|eh|isso e|isso eh) (falso|mentira)|desmentid[ao]|fake news|boato|teoria da conspiracao|desinformacao|\\bmito\\b' },
    { kind: 'oficial', weight: -4, label: 'TSE esclarece', pattern: 'tse esclarece|fato ou boato|justica eleitoral (esclarece|informa)|segundo o tse' },
    { kind: 'semprova', weight: -3, label: 'sem provas', pattern: 'nao ha (provas?|evidencias?|indicios)|sem (nenhuma )?provas?|(nunca|jamais) (houve|foi comprovad)' },
    { kind: 'citacao', weight: -2, label: 'citação/ironia ("dizem que")', pattern: 'dizem que|alegam que|alegacao (de|que)|tem gente (dizendo|achando)|mentira que|ainda tem quem (acredite|ache)|acreditam que' },
    { kind: 'negacao', weight: -4, label: 'negação explícita', pattern: 'nao (existe|houve|ha|teve) fraude|fraude (nunca|jamais) (existiu|houve)|urnas? (sao|e|eh) (seguras?|confiave(l|is)|auditave(l|is))' }
  ];

  const BIO_TERMS = [
    { weight: 2, label: 'bio indica perfil reserva/backup', pattern: 'conta (reserva|backup|nova)|perfil (reserva|backup)|fui suspens[ao]|voltei|nova conta' },
    { weight: 1, label: 'bio pede seguir de volta', pattern: 'sigo de volta|follow ?back|#sdv|sdv' },
    { weight: 1, label: 'bio com termos da narrativa', pattern: 'fraude|intervencao|voto impresso|urna' }
  ];

  const GENERIC_NAMES = ['patriota', 'brasileiro', 'brasileira', 'brasil', 'conservador', 'conservadora', 'cidadao', 'verdade', 'acorda brasil', 'user', 'usuario', 'deus patria familia', 'mito', 'direita', 'patriota br'];

  const KEY_TOKENS = ['urna', 'urnas', 'fraude', 'fraudes', 'fraudada', 'fraudadas', 'fraudado', 'hackeada', 'hackeadas', 'hackers', 'codigo',
    'impresso', 'apuracao', 'eleicao', 'eleicoes', 'smartmatic', 'venezuela', 'programadas', 'auditavel', 'intervencao', 'manipula',
    'manipulou', 'secreto', 'secreta', 'roubada', 'roubaram', 'invadida', 'totalizacao'];

  const ZW = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD\u034F\u180E]/g;
  const LEET = { '4': 'a', '3': 'e', '1': 'i', '0': 'o', '5': 's', '7': 't', '@': 'a', '$': 's' };

  function stripAccents(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  const squeeze = s => s.replace(/([a-z])\1+/g, '$1');

  // Normalização leve (exibição/chaves).
  function normalize(text) {
    return stripAccents(String(text || '').normalize('NFKC').replace(ZW, '').toLowerCase())
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[^\p{L}\p{N}#@\s-]/gu, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function levenshtein(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  const KEY_SQ = KEY_TOKENS.map(squeeze);
  const KEY_SET = new Set(KEY_SQ);
  function fuzzyToken(tok) {
    if (tok.length < 4 || KEY_SET.has(tok) || /[^a-z]/.test(tok)) return tok;
    for (const k of KEY_SQ) {
      if (k.length < 5 && (tok.length !== k.length || tok[0] !== k[0])) continue;  // tokens curtos: mais estrito
      if (k.length >= 5 && tok.length < 5) continue;
      if (levenshtein(tok, k, 1) <= 1) return k;
    }
    return tok;
  }

  // Normalização robusta a ofuscação: zero-width, leetspeak, separadores, letras repetidas, erros de 1 letra.
  function canonical(text, opts) {
    opts = opts || {};
    let s = stripAccents(String(text || '').normalize('NFKC').replace(ZW, '').toLowerCase());
    s = s.replace(/https?:\/\/\S+/g, ' ');
    // leetspeak somente em tokens que contêm letras (preserva "2022", "@perfil")
    s = s.replace(/(^|[^a-z0-9@$])([a-z0-9@$]+)/g, (m, pre, tok) => {
      if (!/[a-z]/.test(tok) || !/[0-9@$]/.test(tok) || tok[0] === '@' || /^\d+[a-z]{1,2}$/.test(tok)) return m;
      return pre + tok.replace(/[4310 57@$]/g, c => LEET[c] || c);
    });
    // separadores dentro de palavras: f.r.a.u.d.e, u-r-n-a, f*r*a*u*d*e
    s = s.replace(/(^|[\s#])((?:[a-z][.\-_*·•|\/]){2,}[a-z])(?=[\s.,!?;:]|$)/g, (m, p, w) => p + w.replace(/[^a-z]/g, ''));
    // letras isoladas separadas por espaço: "u r n a"
    s = s.replace(/(^|\s)([a-z](?: [a-z]){3,})(?=\s|$)/g, (m, p, w) => p + w.replace(/ /g, ''));
    s = s.replace(/[^a-z0-9#@\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    s = squeeze(s);
    if (opts.fuzzy !== false) s = s.split(' ').map(fuzzyToken).join(' ');
    return s;
  }

  function copypastaKey(text) {
    return canonical(text, { fuzzy: false }).replace(/[@#]\S+/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }

  function hashString(s, seed) {
    let h = (seed >>> 0) || 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  const hex = n => n.toString(16).padStart(8, '0');

  function shingles(key, n) {
    n = n || 2;
    const w = key.split(' ').filter(Boolean);
    const out = new Set();
    if (w.length < n) { if (w.length) out.add(w.join(' ')); return out; }
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
    return out;
  }
  function jaccard(a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0; for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
  }
  // SimHash de 64 bits (duas metades de 32) sobre shingles de 3 palavras.
  function simhash(key) {
    const v = new Array(64).fill(0);
    for (const sh of shingles(key, 3)) {
      const hi = hashString(sh, 0x811c9dc5), lo = hashString(sh, 0x01234567);
      for (let i = 0; i < 32; i++) { v[i] += (hi >>> i) & 1 ? 1 : -1; v[32 + i] += (lo >>> i) & 1 ? 1 : -1; }
    }
    let hi = 0, lo = 0;
    for (let i = 0; i < 32; i++) { if (v[i] > 0) hi |= (1 << i); if (v[32 + i] > 0) lo |= (1 << i); }
    return hex(hi >>> 0) + hex(lo >>> 0);
  }
  function popcount(n) { n = n - ((n >>> 1) & 0x55555555); n = (n & 0x33333333) + ((n >>> 2) & 0x33333333); return (((n + (n >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; }
  function hamming(a, b) {
    return popcount((parseInt(a.slice(0, 8), 16) ^ parseInt(b.slice(0, 8), 16)) >>> 0) + popcount((parseInt(a.slice(8), 16) ^ parseInt(b.slice(8), 16)) >>> 0);
  }

  const compileCache = new Map();
  function compile(list) {
    const ck = JSON.stringify(list);
    if (compileCache.has(ck)) return compileCache.get(ck);
    const out = (list || []).map(k => {
      try {
        // comprime letras repetidas do padrão como o texto (ignora escapes \x)
        const pat = String(k.pattern).replace(/(\\.)|([a-z])\2+/g, (m, esc, ch) => esc || ch);
        return Object.assign({}, k, { re: new RegExp(pat, 'i'), weight: Number(k.weight) || 0, label: k.label || k.pattern, category: k.category || 'outros' });
      } catch (e) { return null; }
    }).filter(Boolean);
    if (compileCache.size > 50) compileCache.clear();
    compileCache.set(ck, out);
    return out;
  }

  // Multiplicadores por sinal a partir do feedback "não é desinformação".
  function feedbackMultipliers(counts) {
    const out = {};
    for (const [label, n] of Object.entries(counts || {})) out[label] = Math.max(0.3, 1 - 0.2 * (Number(n) || 0));
    return out;
  }

  /**
   * input: string ou { text, quoted, extra: [alt-texts, títulos de cards] }
   * opts: { keywords, labelAdjust }
   */
  function scoreDisinformation(input, opts) {
    if (Array.isArray(opts)) opts = { keywords: opts };
    opts = opts || {};
    const inp = typeof input === 'string' ? { text: input } : (input || {});
    const kws = compile(opts.keywords || DEFAULT_KEYWORDS);
    const adj = opts.labelAdjust || {};
    const segments = [
      { source: 'texto', factor: 1, raw: inp.text || '' },
      { source: 'imagem/card', factor: 0.75, raw: (inp.extra || []).join(' \n ') },
      { source: 'tweet citado', factor: 0.5, raw: inp.quoted || '' }
    ];
    const signals = []; const seen = new Set(); let score = 0;
    for (const seg of segments) {
      if (!seg.raw) continue;
      const canon = canonical(seg.raw);
      for (const k of kws) {
        if (seen.has(k.label) || !k.re.test(canon)) continue;
        seen.add(k.label);
        const w = Math.round(k.weight * seg.factor * (adj[k.label] != null ? adj[k.label] : 1) * 10) / 10;
        score += w;
        signals.push({ label: k.label, weight: w, category: k.category, source: seg.source });
      }
    }
    if (score > 0) {
      const mainCanon = canonical(inp.text || '');
      const ctx = compile(CONTEXT_TERMS).filter(c => c.re.test(mainCanon));
      const mainHits = signals.filter(s => s.source !== 'tweet citado').length;
      if (ctx.length && !mainHits) {
        // o tweet comenta/desmente o tweet citado: não herdar a narrativa
        signals.forEach(s => { score -= s.weight; s.weight = 0; s.label += ' (citado para comentar)'; });
      }
      for (const c of ctx) { score += c.weight; signals.push({ label: c.label, weight: c.weight, category: 'contexto' }); }
      const text = String(inp.text || '');
      const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
      if (score > 0 && letters.length >= 20 && letters.replace(/[^A-ZÀ-Þ]/g, '').length / letters.length > 0.7) { score += 1; signals.push({ label: 'texto em CAIXA ALTA', weight: 1, category: 'enfase' }); }
      if (score > 0 && /[!?]{3,}/.test(text)) { score += 1; signals.push({ label: 'excesso de exclamações', weight: 1, category: 'enfase' }); }
    }
    const categories = [...new Set(signals.filter(s => s.weight > 0 && CATEGORIES[s.category]).map(s => s.category))];
    return { score: Math.max(0, Math.round(score * 10) / 10), signals, categories };
  }

  const EMOJI_RE = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/gu;
  function emojiCount(s) { return (String(s || '').replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '\u2B50').match(EMOJI_RE) || []).length; }

  /**
   * author: { handle, displayName, verified, defaultAvatar, hasAvatar, joinDate, postsCount, followers, following, bio }
   * ctx: { text, dupAuthors (n contas com texto quase idêntico), linkAuthors (n contas com o mesmo link),
   *        burst (n posts distintos do autor em 10 min), blocklisted, now }
   */
  function scoreAccount(author, ctx) {
    author = author || {}; ctx = ctx || {};
    const signals = []; let score = 0;
    const add = (w, label) => { score += w; signals.push({ label, weight: w }); };
    const handle = String(author.handle || '').replace(/^@/, '');

    if (/\d{6,}$/.test(handle) || /\d{8,}/.test(handle)) add(2, 'handle com longa sequência de dígitos');
    else if (/^[a-z_]+\d{4,5}$/i.test(handle)) add(1, 'handle com sufixo numérico');
    if (author.defaultAvatar || author.hasAvatar === false) add(2, 'avatar padrão/ausente');

    const dn = author.displayName;
    const name = normalize(dn).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
    if (dn !== undefined && !name) add(1, 'nome vazio ou só emojis');
    else if (name && (GENERIC_NAMES.includes(name) || GENERIC_NAMES.some(g => name.startsWith(g + ' ') && name.split(' ').length <= 3))) add(1, 'nome genérico');
    if (dn && (emojiCount(dn) >= 3 || (emojiCount(dn) >= 2 && name.length < 8))) add(1, `nome com muitos emojis (${emojiCount(dn)})`);
    // nome e handle não correspondem (só conta se o handle também tiver dígitos)
    const hLetters = handle.toLowerCase().replace(/[^a-z]/g, '');
    if (name && hLetters.length >= 3 && /\d{3,}/.test(handle)) {
      const parts = name.split(' ').filter(p => p.length >= 3);
      const match = parts.some(p => hLetters.includes(p.slice(0, 4)) || p.includes(hLetters.slice(0, 4)));
      if (!match) add(1, 'nome e handle não correspondem');
    }

    if (author.bio) {
      const b = canonical(author.bio);
      for (const t of compile(BIO_TERMS)) if (t.re.test(b)) add(t.weight, t.label);
    }

    const now = ctx.now ? new Date(ctx.now) : new Date();
    let ageDays = null;
    if (author.joinDate) {
      const d = new Date(author.joinDate);
      if (!isNaN(d)) {
        ageDays = Math.max(1, (now - d) / 86400000);
        if (ageDays < 30) add(3, 'conta criada há menos de 30 dias');
        else if (ageDays < 90) add(2, 'conta criada há menos de 90 dias');
      }
    }
    if (ageDays && Number.isFinite(author.postsCount)) {
      const rate = author.postsCount / ageDays;
      if (rate > 144) add(3, `taxa de postagem muito alta (~${Math.round(rate)}/dia)`);
      else if (rate > 72) add(2, `taxa de postagem alta (~${Math.round(rate)}/dia)`);
    }
    if (Number.isFinite(author.followers) && Number.isFinite(author.following) &&
        author.following > 500 && author.followers < author.following / 20) add(1, 'segue muitos, poucos seguidores');

    const tags = (String(ctx.text || '').match(/#[\p{L}\p{N}_]+/gu) || []).length;
    if (tags >= 5) add(2, `muitas hashtags (${tags})`);
    else if (tags >= 3) add(1, `várias hashtags (${tags})`);

    const dup = ctx.dupAuthors instanceof Set ? ctx.dupAuthors.size : (ctx.dupAuthors || 0);
    if (dup >= 2) add(dup >= 3 ? 3 : 2, `texto (quase) idêntico postado por ${dup} contas nesta sessão`);
    if ((ctx.linkAuthors || 0) >= 3) add(2, `mesmo link compartilhado por ${ctx.linkAuthors} contas nesta sessão`);
    if ((ctx.burst || 0) >= 5) add(2, `rajada: ${ctx.burst} posts desta conta em 10 min`);
    if (ctx.blocklisted) add(3, 'conta na sua lista de observação');
    if (author.verified && score > 0) add(-1, 'selo de verificação (peso reduzido)');
    return { score: Math.max(0, score), signals };
  }

  // Rastreador de comportamento coordenado na sessão.
  function createSessionTracker(options) {
    const o = Object.assign({ minLength: 30, threshold: 0.6, maxEntries: 2000, burstWindowMs: 10 * 60 * 1000 }, options || {});
    const groups = []; const links = new Map(); const authorPosts = new Map();
    function findGroup(key, sh, sim) {
      for (const g of groups) {
        if (g.key === key) return g;
        if (hamming(g.sim, sim) <= 6 || jaccard(g.sh, sh) >= o.threshold) return g;
      }
      return null;
    }
    return {
      /** post: { text, handle, links: [], time(ms) } → estado vivo { group, linkKeys, handle } */
      add(post) {
        const handle = String(post.handle || '').toLowerCase();
        const key = copypastaKey(post.text);
        const time = post.time || Date.now();
        let group = null;
        if (key.length >= o.minLength) {
          const sh = shingles(key, 2), sim = simhash(key);
          group = findGroup(key, sh, sim);
          if (!group) { group = { key, sh, sim, authors: new Set() }; groups.push(group); if (groups.length > o.maxEntries) groups.shift(); }
          group.authors.add(handle);
        }
        const linkKeys = [...new Set((post.links || []).map(normalizeLink).filter(Boolean))];
        for (const l of linkKeys) { if (!links.has(l)) links.set(l, new Set()); links.get(l).add(handle); }
        const arr = authorPosts.get(handle) || [];
        if (!arr.some(p => p.key === key)) arr.push({ key, time });
        authorPosts.set(handle, arr.filter(p => time - p.time <= o.burstWindowMs || p.time > time));
        return { group, linkKeys, handle };
      },
      state(entry) {
        const linkAuthors = Math.max(0, ...entry.linkKeys.map(l => links.get(l).size));
        const now = Math.max(...(authorPosts.get(entry.handle) || [{ time: 0 }]).map(p => p.time));
        const burst = (authorPosts.get(entry.handle) || []).filter(p => now - p.time <= o.burstWindowMs).length;
        return { dupAuthors: entry.group ? entry.group.authors.size : 1, linkAuthors, burst, fingerprint: entry.group ? entry.group.sim : null };
      },
      size() { return groups.length; }
    };
  }

  function normalizeLink(u) {
    let s = String(u || '').trim().toLowerCase().replace(/…$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!s || /^(t\.co|x\.com|twitter\.com)\/?$/.test(s) || /^t\.co\//.test(s)) return '';
    s = s.split('#')[0].replace(/[?&](utm_[^&]*|fbclid=[^&]*|s=\d+)/g, '').replace(/\/+$/, '');
    return s.includes('.') ? s : '';
  }

  function classify(dis, acc, s, flags) {
    s = Object.assign({}, DEFAULT_SETTINGS, s || {});
    if (flags && flags.allowlisted) return 'none';
    if (dis.score >= s.disinfoRed && acc.score >= s.accountYellow) return 'red';
    if (dis.score >= s.disinfoYellow && acc.score >= s.accountRed) return 'red';
    if (dis.score >= s.disinfoYellow) return 'yellow';
    return 'none';
  }

  const api = { DEFAULT_SETTINGS, DEFAULT_KEYWORDS, CONTEXT_TERMS, CATEGORIES, BIO_TERMS, normalize, canonical, levenshtein,
    copypastaKey, hashString: s => hex(hashString(s)), shingles, jaccard, simhash, hamming, normalizeLink, emojiCount,
    feedbackMultipliers, scoreDisinformation, scoreAccount, createSessionTracker, classify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UrnaGuardScoring = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
