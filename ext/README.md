# Urna Guard 2.0

Extensão para Chrome/Edge (Manifest V3) que **sinaliza, sem ocultar nada**, posts no X (x.com / twitter.com) com sinais de desinformação sobre a urna eletrônica brasileira, principalmente quando vêm de contas com sinais de inautenticidade.

> ⚠️ **Aviso:** são heurísticas, não provas. Podem gerar falsos positivos e falsos negativos. **Não use os resultados para assediar, expor ou denunciar ninguém em massa.** A extensão nunca oculta, denuncia ou executa qualquer ação no X.

## Instalação (Load unpacked)
1. Descompacte `urna-guard.zip`.
2. Abra `chrome://extensions` (ou `edge://extensions`) e ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `urna-guard` (a que contém `manifest.json`).
4. Abra x.com. Os selos aparecem ao lado do nome do autor. Clique no selo para ver os detalhes.

## Como funciona
### Leitura da página (`src/content.js`)
- Um `MutationObserver` (com debounce) acompanha a timeline. De cada `article[data-testid="tweet"]` são lidos, **apenas pelo DOM já renderizado**:
  - texto (`tweetText`);
  - autor (`User-Name`: nome, @handle, selo de verificação);
  - avatar (`Tweet-User-Avatar`, identificando o avatar padrão);
  - **tweet citado** (bloco `div[role=link]`);
  - **alt text de imagens** (`tweetPhoto`);
  - **títulos de cards de link** (`card.wrapper`);
  - links visíveis no texto.
- Dados de perfil são lidos **quando já estão na tela**:
  - página de perfil: data de entrada, seguidores/seguindo, bio e nº de posts;
  - **hover card** e **UserCell**: bio e seguidores/seguindo.
  - Quando chegam dados novos de um autor, os posts dele são re-pontuados.
- Os seletores têm alternativas (`article[role=article]`, `div[lang][dir=auto]`, `img[src*=profile_images]` etc.), pois o markup do X muda com frequência.
- Não há chamadas de rede, APIs privadas nem tokens. O CSP das páginas da extensão bloqueia `connect-src`.

### Score de desinformação (`src/scoring.js`)
- **49 narrativas** com pesos, em 11 categorias: fraude, código-fonte, voto impresso/auditoria, intervenção/golpe, ataques ao TSE/STF, urnas pré-votadas, apuração, hackers, Venezuela/Smartmatic, eleitores fantasmas e hashtags.
- **Normalização resistente a ofuscação:**
  - remove caracteres invisíveis (zero-width);
  - desfaz leetspeak (`4→a 3→e 1→i 0→o 5→s 7→t @→a $→s`, só dentro de palavras);
  - junta separadores (`f.r.a.u.d.e`, `u-r-n-a`, `u r n a`);
  - comprime letras repetidas (`fraaaude`);
  - corrige por **Levenshtein ≤ 1** palavras-chave como urna, fraude, smartmatic, apuração etc.
- **Contexto que reduz o score:**
  - checagem (Lupa, Aos Fatos, Comprova…), desmentido ("é falso", "boato"), "TSE esclarece"/Fato ou Boato e "sem provas";
  - **citação/ironia** ("dizem que", "mentira que", "alegam que");
  - **negação explícita** ("não houve fraude", "urnas são seguras").
- **Peso por origem:** texto ×1, imagem/card ×0,75, tweet citado ×0,5. Se o autor **comenta ou desmente** o tweet citado, a narrativa citada não é herdada.
- CAIXA ALTA e "!!!" somam +1 cada, mas só quando já existe uma narrativa no texto.

### Score de conta suspeita
- Handle com longa sequência de dígitos.
- Avatar padrão.
- Nome genérico ou vazio, nome com muitos emojis, nome que não corresponde ao handle (quando o handle tem dígitos).
- Bio com sinais de perfil reserva, "sigo de volta" ou termos da narrativa.
- Conta nova, taxa de postagem alta e desproporção seguindo/seguidores (quando visíveis).
- Muitas hashtags.
- **Rajada:** 5 ou mais posts da mesma conta em 10 min na sessão.
- **Comportamento coordenado:**
  - texto **quase idêntico** entre autores diferentes (shingles de 2 palavras + Jaccard ≥ 0,6, ou SimHash de 64 bits com distância ≤ 6);
  - **mesmo link** compartilhado por 3 ou mais contas.
- Conta na lista de observação: +3. Selo de verificação: −1.

### Classificação
- 🟡 **Atenção:** desinformação ≥ limiar amarelo.
- 🔴 **Alto risco:** desinformação alta + conta suspeita.
- Sem narrativa de desinformação, nada é sinalizado. Autores na lista de confiança nunca são sinalizados.

### Interface
- **Selo** ao lado do nome. Clicar abre um **painel** com os sinais e seus pesos, as categorias e os links para o [TSE – Fato ou Boato](https://www.justicaeleitoral.jus.br/fato-ou-boato/) e para a [Segurança da urna](https://www.tse.jus.br/eleicoes/urna-eletronica/seguranca-da-urna). O clique não abre o tweet.
- **"Não é desinformação"**: grava o feedback localmente, reduz em 20% o peso dos sinais envolvidos (mínimo de 30%) e põe o autor na **lista de confiança**.
- **Popup:** liga/desliga, contadores, estatísticas por categoria, exportação **JSON** e **CSV**, limpeza dos dados.
- **Opções:**
  - limiares;
  - listas de confiança e de observação;
  - palavras-chave editáveis em JSON, com validação de regex;
  - resumo e zeragem do feedback;
  - dados e exportação.

## Testes
```bash
npm test                      # 51 testes unitários (node:test, sem dependências)
# teste funcional no navegador (opcional; requer Playwright instalado à parte):
npm i -D playwright && npx playwright install chromium
node e2e/run.js               # 45 verificações; screenshots em /workspace/urna-guard-shots (ou $SHOTS)
```
O teste funcional carrega a extensão desempacotada no Chromium (headless). Ele serve `e2e/mock-x.html`, um mock do DOM do X com inserção dinâmica de posts, em `https://x.com/home` por interceptação local. Em seguida verifica selos, painel, feedback, popup, opções, exportação, storage e a ausência de requisições externas.

## Limitações
- Palavras-chave não entendem contexto como um humano. Ironia sem marcadores, sarcasmo e narrativas novas passam despercebidos. O fuzzy (Levenshtein ≤ 1) pode, raramente, confundir palavras parecidas.
- Na timeline, os sinais de conta dependem basicamente de handle, nome e avatar. Idade da conta, taxa de postagem e bio só existem se o perfil, o hover card ou a UserCell aparecerem na tela.
- Coordenação, rajada e links repetidos só consideram o que **você viu nesta sessão**. Não é uma visão da rede.
- O texto de imagens sem alt text não é lido (não há OCR). Vídeos também não.
- Os seletores (`data-testid`) seguem o markup público conhecido do X e têm alternativas, mas podem quebrar quando o X mudar. O teste funcional usa um mock, não o x.com real.
- Contas reais podem ter handle numérico e avatar padrão. Contas falsas sofisticadas não têm esses sinais.

## Conformidade
- **Termos do X:** a extensão só lê o que já está na sua tela e adiciona um selo visual. Não faz scraping em massa, não usa API privada nem tokens, não faz requisições ao X e **não automatiza nenhuma ação** (curtir, responder, denunciar, bloquear, seguir).
- **Sem ocultação nem denúncia automática:** se quiser denunciar algo, faça isso manualmente, depois da sua própria avaliação.
- **LGPD:** tudo fica em `chrome.storage.local`, neste navegador, com limite de 1000 itens sinalizados e 500 feedbacks. Não há servidores, telemetria nem `connect-src`. Você pode apagar os dados a qualquer momento. As exportações JSON/CSV contêm dados pessoais (handles e textos), então guarde e compartilhe esses arquivos com responsabilidade e finalidade legítima.

## Changelog
### 2.1.0
- **Mais rápido:** varredura incremental (só nós novos), lotes em `requestIdleCallback` com fatias de no máx. ~12 ms, `WeakSet` de posts já pontuados, cache LRU de normalização, regexes pré-compiladas, comparações SimHash/Jaccard limitadas aos 300 grupos mais recentes (+ índice exato por chave), re-pontuação de copypastas só quando o nº de contas cruza um limiar, e o DOM do selo só é refeito quando o resultado muda. Bench: `npm run bench`.
- **Selo mais claro:** cor de semáforo (amarelo/vermelho) com rótulo simples ("Atenção" / "Alto risco") e "por quê?". Um clique mostra os motivos principais em linguagem simples, o que fazer e links do TSE; detalhes técnicos ficam recolhidos.
- **Popup simplificado:** interruptor liga/desliga, sensibilidade em 3 níveis (Baixa/Média/Alta) e contadores de hoje. Exportação e estatísticas em "Dados salvos".
- **Boas-vindas em 3 passos** na primeira instalação (também em "Como funciona" no popup).
- **Acessibilidade:** teclado (Enter abre, Esc fecha e devolve o foco), `aria-expanded`/`aria-controls`, contraste AA, axe sem violações; interface em pt-BR e inglês.

### 2.0.0
- Normalização resistente a ofuscação: leetspeak, separadores, letras repetidas, zero-width e fuzzy Levenshtein ≤ 1.
- De 17 para 49 narrativas, em 11 categorias.
- Detecção de citação, ironia, negação e checagem. Tratamento de tweet citado.
- Leitura de alt text de imagens e de cards de link.
- Novos sinais de conta: hover card/UserCell, bio, nome × handle, emojis, rajada, quase-duplicatas (shingles/Jaccard/SimHash), mesmo link entre contas.
- Painel de detalhes, feedback "não é desinformação" com ajuste de pesos, listas de confiança e de observação.
- Popup com estatísticas por categoria. Exportação CSV.
- Ícones PNG (16/48/128). Service worker mínimo para inicializar o storage. CSP sem `connect-src`.
- Fila de gravação no storage, que corrige perda de itens por condição de corrida.
- Re-pontuação de posts antigos quando surgem duplicatas ou dados de perfil.
- 51 testes unitários e teste funcional com Playwright (45 verificações).
- Correções de bugs encontradas no teste de navegador: bandeira 🇧🇷 contava como 2 emojis; o leet alterava números em URLs; "a apuração é secreta" não era detectada; o selo ficava no fim do post em vez de ao lado do nome.

### 1.0.0
- Versão inicial: palavras-chave, heurísticas de conta, copypasta exata, popup e opções.

## Publicação nas lojas
- `python3 build.py` gera `dist/urna-guard-chrome-<v>.zip` (Chrome Web Store e Edge Add-ons) e `dist/urna-guard-firefox-<v>.zip` (AMO, com `browser_specific_settings` e `background.scripts`).
- Textos da listagem, justificativas de permissão e respostas sobre privacidade: `store/LISTING.md`.
- Capturas 1280×800 e bloco promocional 440×280: `store/`. Para regerar: `node e2e/store-assets.js`.
- Política de privacidade: `privacidade.html` no site (`/workspace/urna-guard-site`).
