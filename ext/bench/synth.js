/* Gerador determinístico de timeline sintética (sem rede). */
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0) / 4294967296); }
const W = 'hoje votei cedo fila tranquila seção bom domingo todos livro filme futebol jogo time chuva calor café trabalho escola cidade bairro praia show música amigo família almoço jantar viagem ônibus metrô notícia governo economia preço'.split(' ');
const BAD = ['fraude nas urnas', 'urnas pré-programadas', 'o TSE manipula tudo', 'código-fonte secreto', 'apuração secreta', 'urnas hackeadas', 'Smartmatic', 'intervenção militar já', 'fr4ud3 n4s urn4s', 'voto impresso já'];
const COPIES = ['Compartilhem antes que apaguem: as urnas vieram com votos, acordem brasileiros!', 'URGENTE vejam o vídeo que prova que a apuração é secreta e o TSE esconde o código', 'Eles não querem que você saiba que milhões de votos sumiram na madrugada do segundo turno'];
function make(n, seed) {
  const r = rng(seed || 42), out = [];
  for (let i = 0; i < n; i++) {
    const words = Array.from({ length: 12 + Math.floor(r() * 25) }, () => W[Math.floor(r() * W.length)]);
    const k = r(); let text;
    if (k < 0.15) text = COPIES[Math.floor(r() * COPIES.length)] + (r() < .5 ? ' #urnas' : '');
    else if (k < 0.4) { words.splice(Math.floor(r() * words.length), 0, BAD[Math.floor(r() * BAD.length)]); text = words.join(' '); }
    else text = words.join(' ') + ' ' + i;
    const handle = (r() < .3 ? 'patriota' + Math.floor(r() * 1e7) : 'user' + Math.floor(r() * 400));
    out.push({ id: 'b' + i, name: r() < .2 ? 'Patriota 🇧🇷🔥' : 'Pessoa ' + i, handle, defaultAvatar: r() < .2, text, link: r() < .1 ? 'video-urnas.example/v/' + Math.floor(r() * 5) : '' });
  }
  return out;
}
module.exports = { make };
