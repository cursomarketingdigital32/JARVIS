
# J.A.R.V.I.S. 2.0 — conserto completo

## O que estava quebrado

| Problema | Causa | Conserto |
|---|---|---|
| **Não respondia** | O cérebro era uma fila que só andava com o Muse aberto e lendo os pedidos. Na nuvem ninguém lia, então ele ficava "pensando..." pra sempre. | Agora o Jarvis pensa sozinho com o Groq (grátis). Se o Muse estiver conectado, quem responde é ele. |
| **Não ouvia** | A transcrição dependia da chave `GROQ_API_KEY`, que não estava configurada. O erro era escondido e a tela continuava mostrando "ouvindo...". | Agora ele ouve pelo próprio Chrome/Edge, sem precisar de chave. O Whisper do Groq fica como reserva, e os erros aparecem na tela. |
| **Voz Faber muda** | O Piper foi enviado sem as bibliotecas que ele precisa pra rodar. | Incluí as bibliotecas pra Linux (Render) e a versão completa pra Windows. |
| Gravava só 5 s | Cortava a sua frase no meio. | Agora ele espera você terminar de falar. |

## 1. Pegue a chave grátis do Groq (2 minutos)
1. Entre em **https://console.groq.com/keys** e faça login com o Google.
2. Clique em **Create API Key** e copie a chave (começa com `gsk_`).

## 2. Na nuvem (Render)
1. No GitHub do Jarvis, troque os arquivos pelos desta pasta: `server.js`, `package.json`, a pasta `public` e a pasta `system`.
   - O arquivo `pt_BR-faber-medium.onnx` (61 MB) já está lá, então não precisa reenviar. O site do GitHub não aceita arquivos acima de 25 MB.
   - Os outros arquivos novos da pasta `system/piper` (`lib*.so*`, `espeak-ng-data`) **precisam** subir.
2. No Render, entre no seu serviço e vá em **Environment → Add Environment Variable**:
   - `GROQ_API_KEY` = sua chave
   - `NOME_DONO` = como ele deve te chamar (ex.: `senhor`, `Alberto`)
   - `CIDADE_PADRAO` = sua cidade (ex.: `Maceió`)
3. Clique em **Manual Deploy → Deploy latest commit**.
4. Abra `https://jarvis-1-0mxx.onrender.com` no **Chrome** ou no **Edge** e toque na tela.

> O plano grátis do Render "dorme" depois de 15 min sem uso. O primeiro acesso pode levar uns 50 s pra acordar.

## 3. No computador (Windows)
1. Instale o **Node.js LTS**: https://nodejs.org
2. Dê dois cliques em **`INICIAR-JARVIS.bat`**.
   - Na primeira vez, ele instala tudo e abre o arquivo `.env`. Cole a chave depois de `GROQ_API_KEY=`, salve e feche.
3. O navegador abre em `http://localhost:3000`.

No PC, o Jarvis também **abre programas e sites** e mostra o uso de CPU e memória reais.

## 4. Usar no celular (app PWA)
1. Abra o endereço da nuvem no **Chrome do Android**.
2. Toque em **⬇ INSTALAR NO CELULAR** (ou no menu ⋮ → "Instalar app"/"Adicionar à tela inicial").
   - No iPhone: botão **Compartilhar** → **Adicionar à Tela de Início**.
3. Pronto: fica com ícone igual a um app e abre rápido mesmo na rua.

Assim ele funciona em qualquer lugar: voz, respostas, dados em tempo real e o modo visão. Os comandos que mexem no computador (abrir programa, volume) só funcionam no PC.

## 5. As interfaces
Troque pelo botão de camadas, pela tecla `I` ou falando *"muda pra holograma"*, *"modo tempestade"* ou *"volta pra esfera"*. A escolha fica salva.
- **Núcleo** (padrão): o reator de arco (estilo Homem de Ferro) com anéis de HUD girando, anel de onda sonora que dança com a voz e leituras de dados. É a interface-assinatura.
- **Holograma**: busto de linhas ciano com rosto laranja que ondula quando ele fala, veias de energia no pescoço, anéis de HUD girando, montanhas de partículas no fundo e montagem a partir de uma esfera de luz.
- **Tempestade**: busto masculino em neon roxo e dourado, com olhos que acendem ao falar, núcleo de energia no peito, fumaça e raios.
- **Esfera**: rede neural 3D azul que gira e cria espinhos com a voz.
- **Visão** (botão da câmera ou tecla `C`, ou diga *"ativa o modo visão"*): abre a câmera do aparelho com um HUD de scanner por cima — retículo, linhas de varredura e anéis. É só efeito visual: **não reconhece pessoas nem mostra dados de ninguém**.

As legendas aparecem palavra por palavra. O painel do canto direito mostra o clima da sua cidade, o dólar, o bitcoin e os timers ativos.

## Voz premium (parecida com a dos vídeos)
A voz grátis é a **Faber** (Piper) — funciona, mas é mais robótica. Para a voz grave e natural estilo dos vídeos, use o **ElevenLabs** (tem plano grátis):
1. Crie conta em https://elevenlabs.io e copie sua **API Key** (Profile → API Key).
2. No PC: coloque no `.env` em `ELEVENLABS_API_KEY=`. Na nuvem: adicione a variável `ELEVENLABS_API_KEY` no Render.
3. (Opcional) Troque a voz em `ELEVENLABS_VOICE_ID` pelo ID de outra voz do ElevenLabs. A padrão é uma voz masculina grave.

Quando estiver ativa, o painel mostra **VOZ: PREMIUM**. Se faltar, ele volta sozinho para a Faber e, se nem ela, para a voz do navegador.

> Não dá para clonar exatamente a voz de um vídeo (isso precisaria do consentimento do dono da voz). Essas reels usam vozes de IA prontas; o ElevenLabs chega bem perto do mesmo tom.

## 6. O que ele faz
| Peça assim | O que acontece |
|---|---|
| "Como está o tempo?" / "Vai chover amanhã em Recife?" | Clima real (Open-Meteo) |
| "Quanto está o dólar?" / "E o bitcoin?" | Cotação real (AwesomeAPI) |
| "Quais as notícias de hoje?" / "Notícias sobre o CSA" | Manchetes reais (Google Notícias) |
| "Quem foi Zumbi dos Palmares?" | Resumo da Wikipédia |
| "Quem ganha Brasil x Noruega?" | Dá um palpite (deixando claro que é palpite) |
| "Lembra que meu aniversário é 12 de março" | Guarda na memória de longo prazo* |
| "Me lembra em 10 minutos de tirar o bolo" | Timer com alarme e aviso falado |
| "Ativa o modo visão" | Abre a câmera com o HUD de scanner |
| "O que tem na minha tela?" / "Fica de olho na minha tela" | Vê e descreve/narra sua tela *(no PC)* |
| "Liga a luz da sala" / "Desliga a TV" / "Liga tudo" | Liga/desliga seus aparelhos (depois de cadastrá-los) |
| "Abre o YouTube" / "Toca Back in Black" / "Pesquisa X" | Abre o site |
| "Abre a calculadora" / "Abre o Spotify" | Abre o programa *(só no PC)* |
| "Aumenta o volume" / "Pausa a música" / "Próxima" / "Bloqueia o PC" | Controla o computador *(só no PC)* |
| "Muda pra tempestade" | Troca a interface |

\* No PC a memória fica salva na pasta `dados`. Na nuvem (Render grátis), ela some quando o serviço reinicia.

**Modo sentinela** (botão do olho ou tecla `S`): o microfone fica sempre ligado, mas ele só responde quando você diz **"Jarvis"**. Depois de cada resposta, você tem 12 segundos para continuar a conversa sem repetir o nome.

**Atalhos:** `Espaço` microfone · `S` sentinela · `C` câmera · `T` digitar · `M` mudo · `I` interface.

### Casa inteligente (ligar luz, TV, tomada…)
O Jarvis não fala direto com a lâmpada — ele dispara um **link (webhook)** que o seu app de casa inteligente oferece. Passo a passo:
1. Toque no botão da **casinha** (abre a tela "Casa") ou vá em `/casa.html`.
2. No seu app (Smart Life/Tuya, SmartThings, Alexa, IFTTT, Home Assistant…) crie uma cena/automação **"ligar"** e outra **"desligar"** para cada aparelho e copie o link de cada uma.
3. Na tela "Casa", adicione o aparelho com um **nome** (como você vai falar, ex.: "luz da sala"), cole os links de **ligar** e **desligar**, e toque em **Testar** e **Salvar**.
4. Pronto: fale *"liga a luz da sala"*, *"desliga a TV"*, *"liga tudo"*.

Se usa **Home Assistant**: na tela "Casa" preencha o endereço e o token, e no aparelho escolha o tipo "Home Assistant" com a entidade (ex.: `light.sala`).

> **Nuvem (Render):** o que você salva na tela "Casa" se perde quando o serviço reinicia. Para não perder, use o botão **"Copiar para o Render"** e cole o texto na variável `CASA_JSON` (Render → Environment). No PC fica salvo na pasta `dados`.
> A nuvem só alcança aparelhos com link **público** (IFTTT, Tuya, Home Assistant exposto/Nabu Casa). Aparelhos só na sua rede local funcionam com o Jarvis rodando no PC de casa.

### O que ele NÃO faz (de propósito)
Reconhecer pessoas na rua pela câmera, mostrar nome/idade/endereço de estranhos ou marcar alguém como "ameaça"; "hackear" aparelhos; invadir sistemas de empresas. Esses vídeos virais são encenação — nenhum app faz isso de verdade. O modo visão é só um efeito de scanner.

## 7. Usar o Muse como cérebro (opcional)
O Jarvis é compatível com o Muse. No Muse, mande esta instrução (troque o endereço pelo seu, se for outro):

> Monitore `https://jarvis-1-0mxx.onrender.com/api/muse-brain/queue` a cada 2 segundos. Para cada pedido da lista, responda como J.A.R.V.I.S. — curto, em português do Brasil, me chamando de senhor — enviando um POST para `https://jarvis-1-0mxx.onrender.com/api/muse-brain/respond` com o JSON `{"id": "<id do pedido>", "response": "<sua resposta>"}`. Para abrir um site, acrescente `"control": {"tipo": "abrir_site", "url": "https://..."}`; para trocar a interface, `"control": {"tipo": "interface", "modo": "holograma"}`.

Enquanto o Muse estiver lendo a fila, o painel mostra **CÉREBRO: MUSE**. Se ele parar de responder ou demorar mais de 25 s, o Groq assume na hora e o Jarvis nunca mais trava — foi exatamente esse travamento que quebrava o seu Jarvis antigo.

## Deixar o cérebro mais inteligente
Por padrão ele pensa com o Groq (grátis e rápido). Para ficar mais esperto:
- **Modelo mais forte no Groq:** adicione a variável `GROQ_MODELO` = `openai/gpt-oss-120b` (ou `openai/gpt-oss-20b`, mais rápido).
- **Usar o Gemini** (tem plano grátis e é bem inteligente): crie a chave em aistudio.google.com/apikey, adicione `GEMINI_API_KEY` e `CEREBRO_PRINCIPAL=gemini`.

## Problemas comuns
- **"Falha nos circuitos" / "chave recusada":** a `GROQ_API_KEY` está errada ou colada com espaço. Gere outra em console.groq.com/keys, apague a variável no Render e cadastre de novo (sem espaços), depois **Manual Deploy**. A tela mostra o motivo técnico embaixo da resposta.
- **Deu certo no teste mas o primeiro acesso falha:** no plano grátis o Render "dorme". Espere ~50s, recarregue e tente de novo.
- **"Permita o uso do microfone"**: toque no cadeado ao lado do endereço e libere o **Microfone**.
- **Não ouve no Brave, Opera ou Firefox**: esses navegadores não têm reconhecimento de voz. O Jarvis troca sozinho para o Whisper, que precisa da `GROQ_API_KEY`. Use o Chrome ou o Edge.
- **"Meu cérebro está desligado"**: falta configurar a `GROQ_API_KEY`.
- **Conferir o estado**: abra `/api/health` no endereço do Jarvis.
