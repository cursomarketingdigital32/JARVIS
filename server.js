// J.A.R.V.I.S. — servidor para Render (Linux)
// Adaptado do servidor mínimo do PC
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10mb' }));

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════
// MUSE-BRAIN: fila de pedidos → eu respondo via poller
// ═══════════════════════════════════════════════════════════
const queueFile = () => path.join(os.tmpdir(), 'muse-brain-queue.json');
const resFile = (id) => path.join(os.tmpdir(), `muse-brain-res-${id}.json`);

function readQueue() {
  try { return JSON.parse(fs.readFileSync(queueFile(), 'utf8')); } catch { return []; }
}
function writeQueue(q) {
  fs.writeFileSync(queueFile(), JSON.stringify(q));
}

app.post('/api/muse-brain', async (req, res) => {
  const { text, language } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const id = Math.random().toString(36).slice(2, 10);
  const q = readQueue();
  q.push({ id, text, language: language || 'BR', ts: Date.now(), status: 'pending' });
  writeQueue(q);

  // Long-polling: aguarda resposta por até 90s
  const start = Date.now();
  while (Date.now() - start < 90000) {
    try {
      const r = JSON.parse(fs.readFileSync(resFile(id), 'utf8'));
      fs.unlinkSync(resFile(id));
      const nq = readQueue().filter(x => x.id !== id);
      writeQueue(nq);
      return res.json(r);
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return res.status(504).json({ error: 'timeout' });
});

app.get('/api/muse-brain/queue', (req, res) => {
  res.json(readQueue().filter(x => x.status === 'pending'));
});

app.post('/api/muse-brain/respond', (req, res) => {
  const { id, response, audio_url, control } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  fs.writeFileSync(resFile(id), JSON.stringify({ response, audio_url, control }));
  const q = readQueue().filter(x => x.id !== id);
  writeQueue(q);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// PIPER TTS (Linux)
// ═══════════════════════════════════════════════════════════
const PIPER_BIN = path.join(__dirname, 'system', 'piper', 'piper');
const VOICE = path.join(__dirname, 'system', 'piper', 'pt_BR-faber-medium.onnx');

app.post('/api/piper-tts', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!fs.existsSync(PIPER_BIN)) return res.status(503).json({ error: 'piper_not_installed' });

  const outFile = path.join(os.tmpdir(), `piper-${Date.now()}.wav`);

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await new Promise((resolve, reject) => {
        const p = spawn(PIPER_BIN, ['--model', VOICE, '--output_file', outFile]);
        let stderr = '';
        p.stderr.on('data', d => stderr += d);
        p.on('close', code => {
          if (code !== 0 || !fs.existsSync(outFile)) reject(new Error('piper_failed_' + code + '_' + stderr.slice(0, 200)));
          else resolve();
        });
        p.stdin.write(text);
        p.stdin.end();
      });
      const audio = fs.readFileSync(outFile);
      try { fs.unlinkSync(outFile); } catch {}
      res.set('Content-Type', 'audio/wav');
      return res.send(audio);
    } catch (e) {
      console.log(`[piper] Tentativa ${tentativa} falhou: ${e.message}`);
      if (tentativa === 3) return res.status(500).json({ error: 'piper_failed', detail: e.message });
      await new Promise(r => setTimeout(r, 1000));
    }
  }
});

// ═══════════════════════════════════════════════════════════
// TRANSCRIÇÃO: áudio → texto (Groq Whisper)
// ═══════════════════════════════════════════════════════════
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(503).json({ error: 'transcribe_not_configured' });
  }
  if (!req.file) return res.status(400).json({ error: 'No audio file' });
  try {
    const formData = new FormData();
    formData.append('file', new Blob([fs.readFileSync(req.file.path)]), 'audio.webm');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'pt');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    const d = await r.json();
    try { fs.unlinkSync(req.file.path); } catch {}
    if (!r.ok) return res.status(500).json({ error: d.error?.message || 'groq_failed' });
    res.json({ text: d.text || '' });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({
  ok: true,
  muse: true,
  cloud: 'render',
  capabilities: {
    voice_realtime: true,
    voice_free: true,
    task_execution: false
  },
  cerebro: { modelo: 'muse' }
}));

// Voice options
app.get('/api/voice/options', (req, res) => res.json({
  openai: { available: false },
  free: {
    available: true,
    voices: [
      { id: 'faber', name: 'Faber (PT-BR)' }
    ]
  }
}));

// Rota raiz → cerebro
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cerebro.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`JARVIS no ar na porta ${PORT}`);
});
