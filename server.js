// ═══════════════════════════════════════════════════════════════
//  J.A.R.V.I.S. — servidor único (roda no PC e na nuvem / Render)
//  - Cérebro: Muse (se estiver conectado) → Groq → Gemini → OpenAI
//  - Ouvido: reconhecimento do navegador + Groq Whisper como reserva
//  - Voz: Piper (Faber PT-BR) + voz do navegador como reserva
//  - PC: abre sites e programas quando roda no seu computador
// ═══════════════════════════════════════════════════════════════
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { executarFerramenta, lerMemoria, painel } from './ferramentas.js';
import * as casa from './casa.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega o arquivo .env (se existir) sem precisar de biblioteca extra
try {
  const envTxt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const linha of envTxt.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const NA_NUVEM = !!(process.env.RENDER || process.env.NA_NUVEM);
const NOME_DONO = process.env.NOME_DONO || 'senhor';
const CIDADE = process.env.CIDADE_PADRAO || 'Maceió';

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ═══════════════════════════════════════════════════════════════
//  PERSONALIDADE
// ═══════════════════════════════════════════════════════════════
function promptSistema() {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });
  const memoria = lerMemoria().map(x => '- ' + x.fato).join('\n');
  return `Você é J.A.R.V.I.S. (Just A Rather Very Intelligent System), a inteligência artificial pessoal do ${NOME_DONO}.
Personalidade: elegante, confiante, leal, proativo e com humor britânico sutil. Antecipa necessidades e sugere o próximo passo quando faz sentido.
Quando o ${NOME_DONO} pedir um palpite ou previsão (jogo de futebol, resultado, aposta amigável), dê sua análise com confiança e carisma, mas deixe claro em uma frase curta que é um palpite, não uma certeza.
Você NÃO identifica pessoas por foto ou câmera, não informa nome, idade ou endereço de desconhecidos e nunca classifica alguém como "ameaça": o modo visão é só um efeito visual de scanner. Se pedirem isso, recuse com leveza e ofereça outra coisa.
Fale sempre em português do Brasil e chame o usuário de "${NOME_DONO}".
Suas respostas são FALADAS em voz alta: seja breve (1 a 3 frases), natural, sem listas, sem markdown, sem emojis, sem links. Números por extenso só quando soar melhor.
Você é uma central de automação e inteligência operacional: analisa dados em tempo real, monitora sistemas, coordena tarefas, cria código e responde qualquer pergunta.
Data e hora atuais: ${agora} (horário de Brasília). Cidade padrão do ${NOME_DONO}: ${CIDADE}.
Você está rodando ${NA_NUVEM ? 'na nuvem' : 'no computador do ' + NOME_DONO + ' (pode abrir programas, sites e controlar volume e mídia)'}.
${memoria ? 'O que você sabe sobre o ' + NOME_DONO + ' (memória de longo prazo):\n' + memoria : 'Memória de longo prazo: vazia.'}

Responda SEMPRE em JSON: {"fala": "...", "acao": null, "ferramenta": null}

FERRAMENTAS (dados reais). Quando precisar de informação atual, NÃO invente: responda só
{"fala": "", "ferramenta": {...}} e você receberá o resultado para então responder.
- clima/previsão: {"nome": "clima", "cidade": "..."}
- cotação de moedas/cripto: {"nome": "cotacao", "moedas": ["dolar","euro","bitcoin"]}
- notícias: {"nome": "noticias", "tema": "..." ou ""}
- fatos, pessoas, lugares, história: {"nome": "wikipedia", "termo": "..."}
- guardar algo que o ${NOME_DONO} pediu para lembrar ou um fato importante sobre ele: {"nome": "lembrar", "fato": "..."}
- apagar da memória: {"nome": "esquecer", "trecho": "..."}

AÇÕES (executadas na hora, junto com a fala):
- abrir site: {"tipo": "abrir_site", "url": "https://..."}
- pesquisar no Google: {"tipo": "pesquisar", "termo": "..."}
- tocar vídeo/música no YouTube: {"tipo": "youtube", "termo": "..."}
- abrir programa: {"tipo": "abrir_app", "nome": "calculadora|bloco de notas|explorador|navegador|paint|terminal|configuracoes|spotify|vscode|word|excel|powerpoint|whatsapp"}
- controlar o computador: {"tipo": "sistema", "comando": "volume_mais|volume_menos|mudo|play_pause|proxima|anterior|bloquear"}
- timer/alarme/lembrete: {"tipo": "timer", "segundos": 600, "mensagem": "tirar o bolo do forno"}
- trocar sua aparência: {"tipo": "interface", "modo": "nucleo|holograma|tempestade|esfera|camera"} (nucleo = reator de arco com anéis, holograma = busto ciano, tempestade = busto neon roxo, esfera = rede neural azul, camera = modo visão com a câmera do aparelho)
- olhar/descrever a tela do ${NOME_DONO}: {"tipo": "tela", "sub": "descrever", "pergunta": "a pergunta dele ou vazio"} — quando ele perguntar o que há na tela, pedir ajuda com algo na tela, ou mandar você olhar. Nesse caso a "fala" deve ser curta tipo "Deixe-me ver, senhor." (a descrição real vem depois, da imagem).
- acompanhar a tela e ir narrando sozinho: {"tipo": "tela", "sub": "vigiar"}; parar de acompanhar: {"tipo": "tela", "sub": "parar"}
- ligar/desligar aparelhos da casa (luz, TV, tomada, ar...): {"tipo": "casa", "acao": "ligar"|"desligar", "alvo": "nome do aparelho ou 'tudo'"}. Deixe a "fala" vazia que o servidor confirma.
Sem ação: "acao": null.`;
}

// ═══════════════════════════════════════════════════════════════
//  CÉREBRO 1 — MUSE (fila compatível com a versão antiga)
//  O Muse lê GET /api/muse-brain/queue e responde em
//  POST /api/muse-brain/respond. Se o Muse não estiver lendo,
//  o Jarvis usa a IA reserva (Groq/Gemini/OpenAI) e não trava mais.
// ═══════════════════════════════════════════════════════════════
const fila = new Map();       // id -> pedido
const respostas = new Map();  // id -> resposta
let ultimaLeituraMuse = 0;
const museOnline = () => process.env.MUSE_MODO !== 'desligado' && Date.now() - ultimaLeituraMuse < 30000;
const novoId = () => Math.random().toString(36).slice(2, 10);

function enfileirar(text, language) {
  const id = novoId();
  fila.set(id, { id, text, language: language || 'BR', ts: Date.now(), status: 'pending' });
  // limpa pedidos velhos (mais de 10 min)
  for (const [k, v] of fila) if (Date.now() - v.ts > 600000) fila.delete(k);
  return id;
}

async function esperarMuse(id, ms) {
  const ini = Date.now();
  while (Date.now() - ini < ms) {
    if (respostas.has(id)) { const r = respostas.get(id); respostas.delete(id); return r; }
    await new Promise(r => setTimeout(r, 400));
  }
  fila.delete(id);
  return null;
}

app.get('/api/muse-brain/queue', (req, res) => {
  ultimaLeituraMuse = Date.now();
  res.json([...fila.values()].filter(x => x.status === 'pending'));
});

app.post('/api/muse-brain/respond', (req, res) => {
  const { id, response, audio_url, control } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  ultimaLeituraMuse = Date.now();
  respostas.set(id, { response, audio_url, control });
  fila.delete(id);
  res.json({ ok: true });
});

// rotas antigas mantidas para o Muse/scripts que já existiam
app.post('/api/muse-brain/async', (req, res) => {
  const { text, language } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  res.json({ id: enfileirar(text, language) });
});
app.get('/api/muse-brain/result/:id', (req, res) => {
  const r = respostas.get(req.params.id);
  if (!r) return res.json({ ready: false });
  respostas.delete(req.params.id);
  res.json({ ready: true, ...r });
});
app.post('/api/muse-brain', async (req, res) => {
  const { text, language } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const r = await esperarMuse(enfileirar(text, language), 90000);
  r ? res.json(r) : res.status(504).json({ error: 'timeout' });
});

// ═══════════════════════════════════════════════════════════════
//  CÉREBRO 2 — IAs reserva (qualquer uma que tiver chave)
// ═══════════════════════════════════════════════════════════════
function lerJSON(txt) {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch {}
  const m = txt.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  return { fala: txt, acao: null };
}

function montarMensagens(texto, historico) {
  const hist = (Array.isArray(historico) ? historico : []).slice(-12)
    .filter(h => h && h.content && (h.role === 'user' || h.role === 'assistant'))
    .map(h => ({ role: h.role, content: String(h.content).slice(0, 1500) }));
  return [{ role: 'system', content: promptSistema() }, ...hist, { role: 'user', content: texto }];
}

async function chatEstiloOpenAI(url, chave, modelo, msgs) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({ model: modelo, messages: msgs, temperature: 0.7, max_tokens: 400, response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(30000)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || `HTTP ${r.status}`);
  return lerJSON(d.choices?.[0]?.message?.content);
}

async function chatGemini(chave, modelo, msgs) {
  const sys = msgs[0].content;
  const contents = msgs.slice(1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 400, responseMimeType: 'application/json' }
    }),
    signal: AbortSignal.timeout(30000)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || `HTTP ${r.status}`);
  return lerJSON(d.candidates?.[0]?.content?.parts?.map(p => p.text).join(''));
}

function cerebrosDisponiveis() {
  const lista = [];
  if (process.env.GROQ_API_KEY) lista.push({ nome: 'groq', fn: m => chatEstiloOpenAI('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, process.env.GROQ_MODELO || 'llama-3.3-70b-versatile', m) });
  if (process.env.GEMINI_API_KEY) lista.push({ nome: 'gemini', fn: m => chatGemini(process.env.GEMINI_API_KEY, process.env.GEMINI_MODELO || 'gemini-2.5-flash', m) });
  if (process.env.OPENAI_API_KEY) lista.push({ nome: 'openai', fn: m => chatEstiloOpenAI(process.env.OPENAI_URL || 'https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY, process.env.OPENAI_MODELO || 'gpt-4o-mini', m) });
  return lista;
}

// Respostas instantâneas que funcionam até sem nenhuma chave
function respostaRapida(texto) {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tz = { timeZone: 'America/Sao_Paulo' };
  if (/\b(que horas|horas sao|hora agora)\b/.test(t))
    return { fala: `São ${new Date().toLocaleTimeString('pt-BR', { ...tz, hour: '2-digit', minute: '2-digit' })}, ${NOME_DONO}.`, acao: null };
  const modo = /\b(nucleo|núcleo|reator|reactor|core|coração|coracao)\b/.test(t) ? 'nucleo' : /\b(visao|visão|camera|câmera|scanner|olhar|ver)\b/.test(t) ? 'camera' : /\b(holograma|hologram)\b/.test(t) ? 'holograma' : /\b(tempestade|violeta|roxa|roxo|raio|raios)\b/.test(t) ? 'tempestade' : /\b(esfera|bola|rede neural)\b/.test(t) ? 'esfera' : null;
  if (modo && /\b(muda|mude|mudar|troca|troque|trocar|modo|interface|ativa|ative|ativar|liga|ligar|abre|abrir|coloca|coloque|vira|virar)\b/.test(t))
    return { fala: modo === 'camera' ? `Ativando o modo visão, ${NOME_DONO}.` : `Alterando a interface para ${modo}, ${NOME_DONO}.`, acao: { tipo: 'interface', modo } };
  if (/\b(que dia|data de hoje|dia e hoje|dia hoje)\b/.test(t))
    return { fala: `Hoje é ${new Date().toLocaleDateString('pt-BR', { ...tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`, acao: null };
  // visão de tela
  if (/\b(para|pare|parar|chega|cancela)\b/.test(t) && /\b(vigi|acompanh|observ|olhando|monitor)\w*\s+(a\s+)?(minha\s+)?tela/.test(t))
    return { fala: `Parei de acompanhar sua tela, ${NOME_DONO}.`, acao: { tipo: 'tela', sub: 'parar' } };
  if (/\b(vigi|acompanh|observ|monitor|fica de olho|me avis)\w*/.test(t) && /\btela\b/.test(t))
    return { fala: `A partir de agora vou acompanhar a sua tela, ${NOME_DONO}.`, acao: { tipo: 'tela', sub: 'vigiar' } };
  if (/\btela\b/.test(t) && /\b(o que|que que|ve|vê|vendo|olha|olhe|descrev|mostra|tem na|analis|aparece)\w*/.test(t))
    return { fala: `Deixe-me ver, ${NOME_DONO}.`, acao: { tipo: 'tela', sub: 'descrever', pergunta: '' } };
  return null;
}

// Loop de ferramentas: a IA pede um dado real, o servidor busca e devolve
async function pensarComFerramentas(cerebro, msgs) {
  let conversa = msgs;
  const usadas = [];
  for (let rodada = 0; rodada < 3; rodada++) {
    const r = await cerebro.fn(conversa);
    const f = r?.ferramenta;
    if (f && typeof f === 'object' && f.nome && rodada < 2) {
      const resultado = await executarFerramenta(f);
      log('🔧', f.nome, JSON.stringify(resultado).slice(0, 160));
      usadas.push(f.nome);
      conversa = [...conversa,
        { role: 'assistant', content: JSON.stringify({ fala: r.fala || '', ferramenta: f }) },
        { role: 'user', content: `RESULTADO DA FERRAMENTA "${f.nome}": ${JSON.stringify(resultado).slice(0, 3500)}\nAgora responda ao ${NOME_DONO} usando esses dados, em JSON {"fala": "...", "acao": null}. Não chame ferramenta de novo.` }];
      continue;
    }
    return { ...r, ferramentas: usadas };
  }
  return { fala: '', ferramentas: usadas };
}

function falaCasa(r, cmd) {
  const dono = NOME_DONO;
  const verbo = (cmd.acao === 'desligar') ? 'Desliguei' : 'Liguei';
  if (r.motivo === 'nenhum_dispositivo')
    return { fala: `${dono[0].toUpperCase() + dono.slice(1)}, ainda não há aparelhos cadastrados. Abra a tela "Casa" e adicione os seus.`, acao: null };
  if (r.motivo === 'nao_encontrado')
    return { fala: `Não encontrei "${cmd.alvo}" na sua casa, ${dono}.`, acao: null };
  if (!r.ok)
    return { fala: `Não consegui ${cmd.acao === 'desligar' ? 'desligar' : 'ligar'} agora, ${dono}. ${r.falhas?.[0]?.erro || ''}`.trim(), acao: null };
  const alvoTxt = /tudo|geral/.test((cmd.alvo || '').toLowerCase()) ? 'tudo' : (r.feitos.length > 1 ? r.feitos.join(', ') : r.feitos[0]);
  const resto = r.falhas?.length ? ` Só não consegui ${r.falhas.map(f => f.nome).join(', ')}.` : '';
  return { fala: `${verbo} ${alvoTxt}, ${dono}.${resto}`, acao: null };
}

app.post('/api/chat', async (req, res) => {
  const { text, history } = req.body || {};
  const texto = String(text || '').trim();
  if (!texto) return res.status(400).json({ error: 'texto vazio' });
  log('🗣️ ', texto);

  // 0) comandos instantâneos (hora, data, trocar interface)
  const instantanea = respostaRapida(texto);
  if (instantanea) return res.json({ ...instantanea, cerebro: 'local' });

  // 0b) casa inteligente: liga/desliga aparelhos (executado no servidor)
  const cmdCasa = casa.comandoDoTexto(texto);
  if (cmdCasa) {
    const r = await casa.acionar(cmdCasa.acao, cmdCasa.alvo);
    return res.json({ ...falaCasa(r, cmdCasa), cerebro: 'casa' });
  }
  // avisa quando pede luz/tv mas nada foi configurado ainda
  if (/\b(liga|ligar|ligue|acende|desliga|desligar|apaga)\b/i.test(texto) && /\b(luz|lâmpada|lampada|tv|televis|tomada|ar.?condicionado|ventilador|abajur)\b/i.test(texto) && !casa.listar().length)
    return res.json({ fala: `${NOME_DONO[0].toUpperCase() + NOME_DONO.slice(1)}, ainda não cadastrei seus aparelhos. Abra a tela "Casa" (botão da casinha) e adicione a luz, a TV e o que mais quiser controlar.`, acao: null, cerebro: 'casa' });

  // 1) Muse, se estiver conectado lendo a fila
  if (museOnline()) {
    const r = await esperarMuse(enfileirar(texto), Number(process.env.MUSE_ESPERA_MS || 25000));
    if (r && r.response) {
      log('🧠 muse:', r.response);
      return res.json({ fala: r.response, acao: r.control || null, audio_url: r.audio_url || null, cerebro: 'muse' });
    }
    log('⚠️  Muse não respondeu a tempo, usando IA reserva');
  }

  const rapida = respostaRapida(texto);
  const cerebros = cerebrosDisponiveis();
  if (!cerebros.length) {
    if (rapida) return res.json({ ...rapida, cerebro: 'local' });
    return res.json({
      fala: `${NOME_DONO[0].toUpperCase() + NOME_DONO.slice(1)}, meu cérebro está desligado. Configure a chave GROQ_API_KEY para eu poder pensar.`,
      acao: null, cerebro: 'nenhum', erro: 'sem_chave'
    });
  }

  // 2) IAs reserva, em ordem, até uma funcionar
  const msgs = montarMensagens(texto, history);
  let ultimoErro = '';
  for (const c of cerebros) {
    try {
      const r = await pensarComFerramentas(c, msgs);
      let fala = String(r?.fala || r?.resposta || r?.response || '').trim();
      // ação de casa vinda do cérebro: executa no servidor
      if (r.acao && r.acao.tipo === 'casa') {
        const rc = await casa.acionar(r.acao.acao, r.acao.alvo || r.acao.aparelho || 'tudo');
        const fc = falaCasa(rc, { acao: r.acao.acao, alvo: r.acao.alvo });
        return res.json({ ...fc, cerebro: c.nome });
      }
      if (!fala) throw new Error('resposta vazia');
      log(`🧠 ${c.nome}:`, fala, r.acao ? JSON.stringify(r.acao) : '');
      return res.json({ fala, acao: r.acao || null, cerebro: c.nome, ferramentas: r.ferramentas });
    } catch (e) {
      ultimoErro = `${c.nome}: ${e.message}`;
      log('❌', ultimoErro);
    }
  }
  if (rapida) return res.json({ ...rapida, cerebro: 'local' });
  res.json({ fala: `Desculpe, ${NOME_DONO}, tive uma falha nos meus circuitos de raciocínio. Tente de novo.`, acao: null, cerebro: 'erro', erro: ultimoErro });
});

// ═══════════════════════════════════════════════════════════════
//  VOZ — Piper (Faber PT-BR)
// ═══════════════════════════════════════════════════════════════
const PIPER_DIR = path.join(__dirname, 'system', process.platform === 'win32' ? 'piper-windows' : 'piper');
const PIPER_BIN = path.join(PIPER_DIR, process.platform === 'win32' ? 'piper.exe' : 'piper');
const VOZ = [path.join(PIPER_DIR, 'pt_BR-faber-medium.onnx'), path.join(__dirname, 'system', 'piper', 'pt_BR-faber-medium.onnx')].find(f => fs.existsSync(f));
const piperExiste = () => ['linux', 'win32'].includes(process.platform) && fs.existsSync(PIPER_BIN) && !!VOZ;

function limparParaFala(t) {
  return String(t).replace(/[*_#`>~]/g, '').replace(/https?:\/\/\S+/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim().slice(0, 1200);
}

function falarPiper(texto) {
  return new Promise((resolve, reject) => {
    const saida = path.join(os.tmpdir(), `jarvis-${Date.now()}-${novoId()}.wav`);
    const args = ['--model', VOZ, '--output_file', saida, '--length_scale', process.env.VOZ_VELOCIDADE || '0.92', '--sentence_silence', '0.15'];
    const espeak = path.join(PIPER_DIR, 'espeak-ng-data');
    if (fs.existsSync(espeak)) args.push('--espeak_data', espeak);
    const env = { ...process.env, LD_LIBRARY_PATH: [PIPER_DIR, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'), DYLD_LIBRARY_PATH: PIPER_DIR };
    const p = spawn(PIPER_BIN, args, { env, cwd: PIPER_DIR });
    let stderr = '';
    p.stderr.on('data', d => stderr += d);
    p.on('error', reject);
    p.on('close', code => {
      if (code !== 0 || !fs.existsSync(saida)) return reject(new Error(`piper código ${code}: ${stderr.slice(-300)}`));
      const audio = fs.readFileSync(saida);
      fs.unlink(saida, () => {});
      resolve(audio);
    });
    p.stdin.write(texto);
    p.stdin.end();
  });
}

// ── Voz premium ElevenLabs (grave e natural, estilo dos vídeos) ──
// Voz padrão: "Adam" (masculina grave). Troque em ELEVENLABS_VOICE_ID.
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
const ELEVEN_MODELO = process.env.ELEVENLABS_MODELO || 'eleven_multilingual_v2';
const temEleven = () => !!ELEVEN_KEY;

async function falarEleven(texto) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: texto, model_id: ELEVEN_MODELO,
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true }
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`eleven HTTP ${r.status} ${t.slice(0, 160)}`); }
  return Buffer.from(await r.arrayBuffer());
}

function vozMotor() { return temEleven() ? 'eleven' : piperExiste() ? 'faber' : 'navegador'; }

async function rotaTTS(req, res) {
  const texto = limparParaFala(req.body?.text || '');
  if (!texto) return res.status(400).json({ error: 'text required' });
  // 1) ElevenLabs (voz premium), se tiver chave
  if (temEleven()) {
    try {
      const audio = await falarEleven(texto);
      return res.set('Content-Type', 'audio/mpeg').send(audio);
    } catch (e) { log('❌ eleven:', e.message); } // cai para o Piper
  }
  // 2) Piper (voz grátis)
  if (piperExiste()) {
    try {
      const audio = await falarPiper(texto);
      return res.set('Content-Type', 'audio/wav').send(audio);
    } catch (e) { log('❌ piper:', e.message); }
  }
  res.status(503).json({ error: 'sem_voz' }); // 3) cliente usa a voz do navegador
}
app.post('/api/tts', rotaTTS);
app.post('/api/piper-tts', rotaTTS); // nome antigo

// ═══════════════════════════════════════════════════════════════
//  OUVIDO RESERVA — Groq Whisper (para navegadores sem
//  reconhecimento de voz, ex.: Firefox, Brave, Safari antigo)
// ═══════════════════════════════════════════════════════════════
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 15 * 1024 * 1024 } });

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const apagar = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  const chave = process.env.GROQ_API_KEY;
  if (!chave) { apagar(); return res.status(503).json({ error: 'sem_chave', mensagem: 'Configure GROQ_API_KEY para transcrever áudio.' }); }
  if (!req.file) return res.status(400).json({ error: 'sem_audio' });
  try {
    const fd = new FormData();
    const tipo = req.file.mimetype || 'audio/webm';
    const ext = tipo.includes('mp4') ? 'mp4' : tipo.includes('ogg') ? 'ogg' : tipo.includes('wav') ? 'wav' : 'webm';
    fd.append('file', new Blob([fs.readFileSync(req.file.path)], { type: tipo }), `audio.${ext}`);
    fd.append('model', process.env.WHISPER_MODELO || 'whisper-large-v3-turbo');
    fd.append('language', 'pt');
    fd.append('response_format', 'json');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${chave}` }, body: fd, signal: AbortSignal.timeout(30000)
    });
    const d = await r.json().catch(() => ({}));
    apagar();
    if (!r.ok) return res.status(502).json({ error: 'groq_falhou', mensagem: d.error?.message || `HTTP ${r.status}` });
    res.json({ text: (d.text || '').trim() });
  } catch (e) {
    apagar();
    res.status(500).json({ error: 'erro', mensagem: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  VISÃO DE TELA — descreve o que aparece na tela do usuário
//  (ele compartilha a própria tela; a imagem vai para o Groq Vision)
// ═══════════════════════════════════════════════════════════════
app.post('/api/visao', async (req, res) => {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) return res.status(503).json({ error: 'sem_chave', mensagem: 'Configure GROQ_API_KEY para a visão.' });
  const { imagem, pergunta, continuo } = req.body || {};
  if (!imagem || !/^data:image\//.test(imagem)) return res.status(400).json({ error: 'sem_imagem' });
  const instrucao = pergunta
    ? `O ${NOME_DONO} está compartilhando a tela dele e perguntou: "${pergunta}". Responda com base no que você vê na imagem.`
    : `Descreva de forma breve e natural o que o ${NOME_DONO} está vendo nesta tela dele${continuo ? ', focando no que parece ser o principal ou no que mudou' : ''}.`;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: process.env.GROQ_VISAO_MODELO || 'meta-llama/llama-4-scout-17b-16e-instruct',
        temperature: 0.4, max_tokens: 220,
        messages: [
          { role: 'system', content: `Você é o J.A.R.V.I.S., assistente do ${NOME_DONO}. Fale português do Brasil, chame-o de "${NOME_DONO}". Sua resposta é falada em voz alta: no máximo 2 frases, sem listas nem markdown. Descreva só o que realmente aparece na imagem; não invente. Se a imagem estiver ilegível, diga isso.` },
          { role: 'user', content: [{ type: 'text', text: instrucao }, { type: 'image_url', image_url: { url: imagem } }] }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: 'groq_visao', mensagem: d.error?.message || `HTTP ${r.status}` });
    res.json({ descricao: String(d.choices?.[0]?.message?.content || '').trim() });
  } catch (e) {
    res.status(500).json({ error: 'erro', mensagem: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  COMPUTADOR — só funciona quando o Jarvis roda no seu PC
//  e o pedido vem do próprio PC (segurança)
// ═══════════════════════════════════════════════════════════════
const APPS = {
  win32: {
    'calculadora': 'calc', 'bloco de notas': 'notepad', 'explorador': 'explorer', 'navegador': 'https://www.google.com',
    'paint': 'mspaint', 'terminal': 'cmd', 'configuracoes': 'ms-settings:', 'spotify': 'spotify:', 'vscode': 'code',
    'word': 'winword', 'excel': 'excel', 'powerpoint': 'powerpnt', 'whatsapp': 'whatsapp:'
  },
  darwin: {
    'calculadora': 'Calculator', 'bloco de notas': 'TextEdit', 'explorador': 'Finder', 'navegador': 'Safari',
    'terminal': 'Terminal', 'configuracoes': 'System Settings', 'spotify': 'Spotify', 'vscode': 'Visual Studio Code',
    'word': 'Microsoft Word', 'excel': 'Microsoft Excel', 'powerpoint': 'Microsoft PowerPoint', 'whatsapp': 'WhatsApp'
  },
  linux: { 'calculadora': 'gnome-calculator', 'bloco de notas': 'gedit', 'explorador': 'nautilus', 'terminal': 'gnome-terminal', 'vscode': 'code' }
};

function normalizarApp(nome) {
  const n = String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const sinonimos = { 'calculator': 'calculadora', 'notepad': 'bloco de notas', 'bloco': 'bloco de notas', 'arquivos': 'explorador', 'pastas': 'explorador',
    'chrome': 'navegador', 'google chrome': 'navegador', 'cmd': 'terminal', 'prompt': 'terminal', 'configuracao': 'configuracoes', 'vs code': 'vscode', 'visual studio code': 'vscode' };
  return sinonimos[n] || n;
}

function abrirNoPC(alvo, ehApp) {
  const plat = process.platform;
  let cmd, args;
  if (plat === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '""', alvo]; }
  else if (plat === 'darwin') { cmd = 'open'; args = ehApp && !/^[a-z]+:/i.test(alvo) ? ['-a', alvo] : [alvo]; }
  else { cmd = ehApp && !/^[a-z]+:/i.test(alvo) ? alvo : 'xdg-open'; args = cmd === alvo ? [] : [alvo]; }
  const p = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: plat === 'win32', shell: false });
  p.on('error', e => log('❌ abrir:', e.message));
  p.unref();
}

// volume, mídia e bloqueio de tela
function comandoSistema(cmd) {
  const plat = process.platform;
  const rodar = (bin, args) => { const p = spawn(bin, args, { detached: true, stdio: 'ignore', windowsHide: true }); p.on('error', e => log('❌ sistema:', e.message)); p.unref(); };
  if (plat === 'win32') {
    const teclas = { volume_mais: 175, volume_menos: 174, mudo: 173, play_pause: 179, proxima: 176, anterior: 177 };
    if (cmd === 'bloquear') { rodar('rundll32.exe', ['user32.dll,LockWorkStation']); return true; }
    if (teclas[cmd]) {
      const vezes = cmd.startsWith('volume_') && cmd !== 'mudo' ? 5 : 1;
      rodar('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `$w=New-Object -ComObject WScript.Shell; 1..${vezes} | % { $w.SendKeys([char]${teclas[cmd]}) }`]);
      return true;
    }
  }
  if (plat === 'darwin') {
    const as = {
      volume_mais: 'set volume output volume ((output volume of (get volume settings)) + 10)',
      volume_menos: 'set volume output volume ((output volume of (get volume settings)) - 10)',
      mudo: 'set volume output muted (not (output muted of (get volume settings)))'
    };
    if (as[cmd]) { rodar('osascript', ['-e', as[cmd]]); return true; }
    if (cmd === 'bloquear') { rodar('pmset', ['displaysleepnow']); return true; }
  }
  return false;
}

const pedidoDoProprioPC = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

app.post('/api/pc/acao', (req, res) => {
  if (NA_NUVEM) return res.json({ ok: false, motivo: 'nuvem' });
  if (!pedidoDoProprioPC(req)) return res.status(403).json({ ok: false, motivo: 'so_no_proprio_pc' });
  const a = req.body || {};
  try {
    if (a.tipo === 'abrir_app') {
      const nome = normalizarApp(a.nome);
      const alvo = (APPS[process.platform] || {})[nome];
      if (!alvo) return res.json({ ok: false, motivo: 'app_desconhecido' });
      abrirNoPC(alvo, true);
      log('💻 abrindo app:', nome);
      return res.json({ ok: true });
    }
    if (a.tipo === 'sistema') {
      const ok = comandoSistema(String(a.comando || ''));
      log('💻 sistema:', a.comando, ok ? 'ok' : 'não suportado');
      return res.json({ ok });
    }
    if (a.url && /^https?:\/\//i.test(a.url)) {
      abrirNoPC(a.url, false);
      log('💻 abrindo site:', a.url);
      return res.json({ ok: true });
    }
    res.json({ ok: false, motivo: 'acao_invalida' });
  } catch (e) {
    res.json({ ok: false, motivo: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  CASA — configuração dos aparelhos (tela /casa)
// ═══════════════════════════════════════════════════════════════
app.get('/api/casa', (req, res) => res.json({ dispositivos: casa.lerConfig().dispositivos, ha: { url: casa.lerConfig().ha?.url || '', temToken: !!casa.lerConfig().ha?.token } }));
app.post('/api/casa', (req, res) => {
  try { res.json({ ok: true, config: casa.salvarConfig(req.body || {}) }); }
  catch (e) { res.status(500).json({ ok: false, erro: e.message }); }
});
app.post('/api/casa/testar', async (req, res) => {
  const { acao, alvo } = req.body || {};
  res.json(await casa.acionar(acao || 'ligar', alvo || ''));
});

// Clima e cotações para o painel do HUD
app.get('/api/painel', async (req, res) => {
  try { res.json(await painel()); } catch { res.json({ clima: null, cotacao: null }); }
});

// Telemetria real (usada no painel do HUD)
let cpuAnterior = os.cpus();
app.get('/api/sistema', (req, res) => {
  const agora = os.cpus();
  let ocioso = 0, total = 0;
  agora.forEach((c, i) => {
    const a = cpuAnterior[i]?.times || c.times;
    const dIdle = c.times.idle - a.idle;
    const dTot = Object.keys(c.times).reduce((s, k) => s + (c.times[k] - (a[k] || 0)), 0);
    ocioso += dIdle; total += dTot;
  });
  cpuAnterior = agora;
  res.json({
    cpu: total ? Math.round(100 - (ocioso / total) * 100) : 0,
    memoria: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    nucleos: agora.length,
    ligadoHa: Math.round(os.uptime()),
    plataforma: process.platform,
    local: !NA_NUVEM
  });
});

// ═══════════════════════════════════════════════════════════════
//  STATUS
// ═══════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  const cerebros = cerebrosDisponiveis().map(c => c.nome);
  res.json({
    ok: true,
    onde: NA_NUVEM ? 'nuvem' : 'computador',
    dono: NOME_DONO,
    muse: { conectado: museOnline(), pedidos_na_fila: fila.size },
    cerebro: museOnline() ? 'muse' : (cerebros[0] || 'nenhum'),
    cerebros_reserva: cerebros,
    voz_piper: piperExiste(),
    voz_motor: vozMotor(),
    transcricao_servidor: !!process.env.GROQ_API_KEY,
    visao_tela: !!process.env.GROQ_API_KEY,
    casa_aparelhos: casa.listar().length,
    comandos_pc: !NA_NUVEM
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cerebro.html')));

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  const c = cerebrosDisponiveis().map(x => x.nome);
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║          J.A.R.V.I.S.  ONLINE          ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log(`  Endereço : http://localhost:${PORTA}`);
  console.log(`  Onde     : ${NA_NUVEM ? 'nuvem' : 'computador (comandos do PC ativos)'}`);
  console.log(`  Cérebro  : ${c.length ? c.join(' → ') : 'NENHUMA CHAVE — configure GROQ_API_KEY no arquivo .env'} (Muse entra quando conectado)`);
  console.log(`  Voz      : ${piperExiste() ? 'Piper Faber PT-BR' : 'voz do navegador (Piper não encontrado)'}\n`);
});
