/* Bench puro de pontuação: node bench/node-bench.js [caminho/scoring.js] [N] */
const path = require('path');
const S = require(path.resolve(process.argv[2] || path.join(__dirname, '../src/scoring.js')));
const N = +(process.argv[3] || 5000);
let seed = 7;
function run() {
  const posts = require('./synth').make(N, seed++); // posts novos a cada rodada: cache frio

  const tr = S.createSessionTracker(); const t0 = process.hrtime.bigint();
  for (const p of posts) {
    const e = tr.add({ text: p.text, handle: p.handle, links: p.link ? [p.link] : [], time: Date.now() });
    const live = tr.state(e);
    const dis = S.scoreDisinformation({ text: p.text, quoted: '', extra: [] }, { keywords: S.DEFAULT_KEYWORDS, labelAdjust: {} });
    const acc = S.scoreAccount({ handle: p.handle, displayName: p.name, defaultAvatar: p.defaultAvatar }, { text: p.text, dupAuthors: live.dupAuthors, linkAuthors: live.linkAuthors, burst: live.burst });
    S.classify(dis, acc, {});
  }
  return Number(process.hrtime.bigint() - t0) / 1e6;
}
run(); const ts = [run(), run(), run()].sort((a, b) => a - b);
console.log(JSON.stringify({ posts: N, medianMs: +ts[1].toFixed(1), perPostUs: +(ts[1] * 1000 / N).toFixed(1) }));
