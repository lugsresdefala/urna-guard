const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/scoring.js');
const NOW = '2026-11-01T00:00:00Z';
const dis = t => S.scoreDisinformation(t);
const labels = r => r.signals.map(s => s.label);

test('lista padrão tem 40+ narrativas válidas em categorias conhecidas', () => {
  assert.ok(S.DEFAULT_KEYWORDS.length >= 40);
  const ls = new Set();
  for (const k of S.DEFAULT_KEYWORDS) {
    assert.ok(S.CATEGORIES[k.category], k.label); assert.doesNotThrow(() => new RegExp(k.pattern)); assert.ok(!ls.has(k.label)); ls.add(k.label);
  }
  assert.ok(Object.keys(S.CATEGORIES).every(c => S.DEFAULT_KEYWORDS.some(k => k.category === c)), 'toda categoria tem padrão');
});

test('normalize remove acentos, URLs e caixa', () => assert.equal(S.normalize('Apuração SECRETA https://x.co/a !!'), 'apuracao secreta'));

test('canonical: leetspeak', () => {
  assert.equal(S.canonical('fr4ud3 n4s urn4s'), 'fraude nas urnas');
  assert.equal(S.canonical('urn@ fr@ud@d@ $ecret0'), 'urna fraudada secreto');
});
test('canonical: separadores dentro da palavra', () => {
  assert.equal(S.canonical('F.R.A.U.D.E nas u-r-n-a-s'), 'fraude nas urnas');
  assert.equal(S.canonical('u r n a s hackeadas'), 'urnas hackeadas');
  assert.equal(S.canonical('f*r*a*u*d*e'), 'fraude');
});
test('canonical: letras repetidas e zero-width', () => {
  assert.equal(S.canonical('URNAAAAS fraaaudadas'), 'urnas fraudadas');
  assert.equal(S.canonical('fr\u200Bau\u200Dde na\uFEFFs urnas'), 'fraude nas urnas');
});
test('canonical: fuzzy Levenshtein <= 1 em tokens-chave', () => {
  assert.equal(S.canonical('fraide nas urmas'), 'fraude nas urnas');
  assert.equal(S.canonical('smartmatik'), 'smartmatic');
  assert.equal(S.canonical('carta casa'), 'carta casa');
});
test('canonical preserva números puros e @menções', () => {
  assert.equal(S.canonical('eleição de 2022 @joao10'), 'eleicao de 2022 @joao10');
});
test('levenshtein', () => { assert.equal(S.levenshtein('urna', 'urma', 2), 1); assert.equal(S.levenshtein('abc', 'xyz', 1), 2); });

test('detecta narrativas desmentidas com categorias', () => {
  const r = dis('Fraude nas urnas! O código-fonte secreto prova que o TSE manipula tudo');
  assert.ok(r.score >= 12);
  ['fraude nas urnas', 'código-fonte secreto', 'TSE manipula'].forEach(l => assert.ok(labels(r).includes(l), l));
  assert.deepEqual(r.categories.sort(), ['ataques', 'codigo', 'fraude']);
});
const CASES = [
  ['As urnas pré-programadas! VOTO IMPRESSO JÁ', 'prevotadas'],
  ['Urnas vieram com votos para o candidato X', 'prevotadas'],
  ['Apertei 22 e apareceu 13 na tela', 'prevotadas'],
  ['Hackers invadiram o TSE e mudaram tudo', 'hackers'],
  ['As urnas têm bluetooth, qualquer um entra', 'hackers'],
  ['Smartmatic, o mesmo sistema da Venezuela', 'venezuela'],
  ['Intervenção militar já! Artigo 142', 'golpe'],
  ['SOS Forças Armadas, anular a eleição', 'golpe'],
  ['Ditadura da toga: STF comprado', 'ataques'],
  ['Apuração secreta numa sala secreta', 'apuracao'],
  ['Boletins de urna adulterados no Nordeste', 'apuracao'],
  ['Mortos votaram! Mais votos que eleitores', 'eleitores'],
  ['#BrazilWasStolen #FraudeNasUrnas', 'hashtags'],
  ['Urnas não são auditáveis, impossível auditar', 'voto_impresso'],
  ['Software da urna foi adulterado', 'codigo']
];
for (const [t, cat] of CASES) test(`narrativa: ${t}`, () => { const r = dis(t); assert.ok(r.score >= 2, String(r.score)); assert.ok(r.categories.includes(cat), r.categories.join()); });

test('detecção robusta a ofuscação', () => {
  for (const t of ['fr4ud3 n4s urn4s', 'F.R.A.U.D.E nas urnas', 'fraaaaude nas urnaaas', 'fra\u200Bude nas urnas', 'fraide nas urnas', 'urn4s pr3-pr0gr4m4d4s'])
    assert.ok(dis(t).score >= 4, t);
});
test('texto neutro tem score zero', () => {
  for (const t of ['Hoje votei na escola perto de casa, fila tranquila.', 'A urna estava na seção 12, voto rápido', 'Imprimi o boleto da fatura', 'Frade franciscano visita a cidade'])
    assert.equal(dis(t).score, 0, t);
});
test('contexto de checagem e TSE esclarece neutralizam', () => {
  const plain = dis('urna hackeada em 2022');
  const check = dis('TSE esclarece: é falso que houve urna hackeada em 2022. Checagem completa.');
  assert.ok(check.score < plain.score);
  assert.equal(S.classify(check, { score: 0 }), 'none');
});
test('negação explícita e "dizem que" (ironia/citação)', () => {
  assert.equal(S.classify(dis('Não houve fraude nas urnas, as urnas são seguras'), { score: 0 }), 'none');
  assert.equal(S.classify(dis('Dizem que a urna já vem com votos. Mentira que circula todo ano'), { score: 0 }), 'none');
});
test('termos de contexto sozinhos não pontuam', () => assert.equal(dis('Checagem do TSE esclarece boato').score, 0));

test('tweet citado: peso reduzido e anulado quando o autor desmente', () => {
  const q = S.scoreDisinformation({ text: 'Olha isso', quoted: 'Fraude nas urnas!' });
  assert.equal(q.score, 2); assert.equal(q.signals[0].source, 'tweet citado');
  const d = S.scoreDisinformation({ text: 'Isso é falso, o TSE esclarece', quoted: 'Fraude nas urnas! urnas hackeadas' });
  assert.equal(d.score, 0);
});
test('alt text e card contam com fator 0,75', () => {
  const r = S.scoreDisinformation({ text: 'Vejam', extra: ['Print: urnas pré-programadas'] });
  assert.equal(r.score, 3); assert.equal(r.signals[0].source, 'imagem/card');
});
test('mesmo sinal não é contado duas vezes', () => {
  assert.equal(S.scoreDisinformation({ text: 'apuração secreta', quoted: 'apuração secreta', extra: ['apuração secreta'] }).score, 3);
});
test('feedback reduz peso de sinais', () => {
  const m = S.feedbackMultipliers({ 'fraude nas urnas': 2, x: 10 });
  assert.equal(m['fraude nas urnas'], 0.6); assert.equal(m.x, 0.3);
  assert.equal(S.scoreDisinformation('fraude nas urnas', { labelAdjust: m }).score, 2.4);
});
test('lista customizada e regex inválida ignorada', () => {
  assert.equal(S.scoreDisinformation('um teste xyz', [{ pattern: 'teste xyz', weight: 5, label: 'x' }, { pattern: '([', weight: 9 }]).score, 5);
});
test('ênfase só soma com narrativa', () => {
  assert.equal(dis('QUE DIA LINDO HOJE NA PRAIA!!!!').score, 0);
  assert.ok(labels(dis('FRAUDE NAS URNAS É REAL GENTE!!!')).includes('texto em CAIXA ALTA'));
});

test('conta: dígitos, avatar padrão, nome genérico, hashtags', () => {
  const r = S.scoreAccount({ handle: 'patriota84736251', displayName: 'Patriota', defaultAvatar: true }, { text: '#a #b #c #d #e', now: NOW });
  assert.equal(r.score, 2 + 2 + 1 + 2);
});
test('conta: nome x handle não correspondem', () => {
  assert.ok(S.scoreAccount({ handle: 'kxw8812345', displayName: 'Maria Souza' }).signals.some(s => /não correspondem/.test(s.label)));
  assert.ok(!S.scoreAccount({ handle: 'mariasouza123', displayName: 'Maria Souza' }).signals.some(s => /não correspondem/.test(s.label)));
});
test('conta: nome com muitos emojis', () => {
  assert.ok(S.scoreAccount({ handle: 'abc', displayName: 'Zé 🇧🇷🇧🇷🙏🔥' }).signals.some(s => /emojis/.test(s.label)));
  assert.equal(S.emojiCount('João Silva'), 0);
});
test('conta: bio com perfil reserva', () => {
  const r = S.scoreAccount({ handle: 'abc', bio: 'Conta reserva, fui suspenso. Sigo de volta! Voto impresso já' });
  assert.equal(r.score, 2 + 1 + 1);
});
test('conta nova e alta taxa de postagem', () => {
  const r = S.scoreAccount({ handle: 'maria', displayName: 'Maria Silva', joinDate: '2026-10-22T00:00:00Z', postsCount: 2000 }, { now: NOW });
  assert.ok(labels(r).some(l => /menos de 30 dias/.test(l)) && labels(r).some(l => /muito alta/.test(l)));
});
test('conta comum tem score zero', () => {
  assert.equal(S.scoreAccount({ handle: 'joaosilva', displayName: 'João Silva', joinDate: '2015-01-01', postsCount: 3000, hasAvatar: true }, { now: NOW }).score, 0);
});
test('conta: coordenação, link, rajada, observação, verificado', () => {
  const r = S.scoreAccount({ handle: 'a' }, { dupAuthors: 3, linkAuthors: 4, burst: 6, blocklisted: true });
  assert.equal(r.score, 3 + 2 + 2 + 3);
  assert.equal(S.scoreAccount({ handle: 'x12345678', verified: true }).score, 1);
});

test('shingles, jaccard, simhash e hamming', () => {
  const a = S.shingles('a b c d'); assert.equal(a.size, 3);
  assert.equal(S.jaccard(a, S.shingles('a b c d')), 1);
  const k1 = S.copypastaKey('as urnas vieram com votos acordem brasileiros compartilhem antes que apaguem');
  const k2 = S.copypastaKey('as urnas vieram com votos acordem brasileiros compartilhem antes que apaguem ja');
  assert.equal(S.simhash(k1).length, 16);
  assert.ok(S.hamming(S.simhash(k1), S.simhash(k2)) < S.hamming(S.simhash(k1), S.simhash(S.copypastaKey('receita de bolo de cenoura com cobertura de chocolate amargo'))));
  assert.equal(S.hamming(S.simhash(k1), S.simhash(k1)), 0);
});
test('tracker: quase-duplicatas entre autores diferentes', () => {
  const t = S.createSessionTracker();
  const base = 'Compartilhem!!! As urnas vieram com votos, acordem brasileiros, antes que apaguem';
  t.add({ text: base, handle: 'a1' });
  t.add({ text: base.toUpperCase() + ' #fraude', handle: 'b2' });
  const e = t.add({ text: 'compartilhem: as urnas vieram com votos, acordem brasileiros antes que apaguem tudo @x', handle: 'c3' });
  assert.equal(t.state(e).dupAuthors, 3);
  const other = t.add({ text: 'Receita de bolo de cenoura com cobertura de chocolate, rende 12 fatias', handle: 'd4' });
  assert.equal(t.state(other).dupAuthors, 1);
  assert.equal(t.state(t.add({ text: 'curto', handle: 'z' })).dupAuthors, 1);
});
test('tracker: mesmo link por várias contas e rajada', () => {
  const t = S.createSessionTracker(); let e;
  ['a', 'b', 'c'].forEach(h => { e = t.add({ text: 'veja ' + h, handle: h, links: ['https://www.Site-Falso.com/video?utm_source=x'] }); });
  assert.equal(t.state(e).linkAuthors, 3);
  const now = Date.now();
  for (let i = 0; i < 6; i++) e = t.add({ text: 'post numero ' + i + ' sobre qualquer assunto diferente', handle: 'spam', time: now + i * 1000 });
  assert.equal(t.state(e).burst, 6);
});
test('normalizeLink ignora t.co e remove rastreadores', () => {
  assert.equal(S.normalizeLink('https://t.co/abc'), '');
  assert.equal(S.normalizeLink('https://www.exemplo.com/a/?utm_source=x'), 'exemplo.com/a');
});
test('classify respeita limiares e lista de confiança', () => {
  assert.equal(S.classify({ score: 4 }, { score: 0 }), 'yellow');
  assert.equal(S.classify({ score: 6 }, { score: 3 }), 'red');
  assert.equal(S.classify({ score: 3 }, { score: 5 }), 'red');
  assert.equal(S.classify({ score: 1 }, { score: 9 }), 'none');
  assert.equal(S.classify({ score: 4 }, { score: 0 }, { disinfoYellow: 5 }), 'none');
  assert.equal(S.classify({ score: 9 }, { score: 9 }, {}, { allowlisted: true }), 'none');
});

// Regressões encontradas no teste de navegador
test('regressão: bandeira 🇧🇷 conta como 1 emoji', () => assert.equal(S.emojiCount('Maria 🇧🇷🙏🔥'), 3));
test('regressão: leet não altera URLs/números colados por "/"', () => assert.equal(S.canonical('site.example/v/123'), 'site example v 123'));
test('regressão: "a apuração é secreta"', () => assert.ok(labels(dis('a apuração é s.e.c.r.e.t.a')).includes('apuração secreta')));
test('regressão: autores sem handle não se agrupam com handle vazio de outros', () => {
  const t = S.createSessionTracker(); const txt = 'texto repetido sobre as urnas vieram com votos acordem brasileiros';
  t.add({ text: txt, handle: 'a' }); assert.equal(t.state(t.add({ text: txt, handle: 'a' })).dupAuthors, 1);
});
