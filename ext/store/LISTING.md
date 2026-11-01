# Listagem nas lojas: Urna Guard 2.1.0

## Nome (até 45 caracteres)
Urna Guard – alerta sobre urnas no X

## Resumo curto (até 132 caracteres)
Sinaliza, sem ocultar, posts no X com sinais de desinformação sobre a urna eletrônica e contas suspeitas. Funciona 100% local.

## Categoria sugerida
Chrome: "Ferramentas sociais e de comunicação" (ou "Notícias e clima"). Edge: "Social". Firefox: "Social e comunicação".

## E-mail de contato
tiagoog@lugaresdefala.com

## Idioma
Português (Brasil)

## Descrição completa
O Urna Guard ajuda você a reconhecer, enquanto navega no X (antigo Twitter), posts que repetem narrativas já desmentidas sobre a urna eletrônica brasileira, principalmente quando vêm de contas com sinais de inautenticidade ou de ação coordenada.

COMO FUNCIONA
• Um selo discreto aparece ao lado do nome do autor: ⚠️ Atenção (amarelo) ou ⛔ Alto risco (vermelho).
• Ao clicar no selo, um painel mostra exatamente quais sinais foram detectados, com seus pesos, e traz links para a checagem oficial do TSE (Fato ou Boato e Segurança da urna).
• 49 narrativas em 11 categorias: fraude, código-fonte, voto impresso, intervenção, ataques ao TSE/STF, urnas pré-votadas, apuração, hackers, Venezuela/Smartmatic, eleitores fantasmas e hashtags.
• Resistente a truques de escrita: fr4ud3, f.r.a.u.d.e, fraaaude, caracteres invisíveis e erros de digitação.
• Entende contexto: checagens, desmentidos, ironia ("dizem que…") e negações reduzem o alerta. Também analisa tweets citados, cards de link e o texto alternativo de imagens.
• Sinais de conta: handle com muitos dígitos, avatar padrão, nome genérico, bio de "perfil reserva", texto quase idêntico em várias contas, o mesmo link repetido e rajadas de posts.
• Botão "Não é desinformação": ajusta os pesos e põe o autor na sua lista de confiança.
• Popup com estatísticas por categoria e exportação em JSON/CSV.

O QUE ELE NUNCA FAZ
• Nunca oculta posts.
• Nunca denuncia, curte, responde, bloqueia ou segue: não automatiza nenhuma ação no X.
• Nunca envia dados para servidores. Não tem telemetria nem rastreadores.

PRIVACIDADE (LGPD)
Tudo fica no armazenamento local do seu navegador (chrome.storage.local). Você pode apagar os dados a qualquer momento.

AVISO
São heurísticas, não provas. Podem ocorrer falsos positivos. Não use os selos para assediar ninguém. Na dúvida, consulte https://www.justicaeleitoral.jus.br/fato-ou-boato/

Projeto independente, sem vínculo com o TSE, a Justiça Eleitoral ou o X.

## Justificativa de propósito único (Chrome)
Exibir, no X/Twitter, alertas informativos locais sobre posts com sinais de desinformação sobre a urna eletrônica.

## Justificativa de permissões
• storage: guardar localmente as configurações, o feedback do usuário e os itens sinalizados.
• Acesso a x.com / twitter.com (content script): ler o texto dos posts já exibidos na tela para calcular o alerta e mostrar o selo.
• Código remoto: NÃO utiliza.

## Uso de dados (formulário "Privacy practices" da Chrome Web Store)
• Não coleta nem transmite dados do usuário. Todo processamento é local.
• Marcar: "Não vendo nem transfiro dados a terceiros", "Não uso dados para fins não relacionados ao propósito único" e "Não uso dados para crédito/empréstimos".
• URL da política de privacidade: https://lugsresdefala.github.io/urna-guard/privacidade.html

## Ativos
• Ícone 128×128: icons/icon128.png
• Capturas 1280×800: store/screenshot-1..4-*.png
• Bloco promocional pequeno 440×280: store/promo-tile-440x280.png
• Pacote Chrome/Edge: dist/urna-guard-chrome-2.0.0.zip
• Pacote Firefox: dist/urna-guard-firefox-2.0.0.zip
