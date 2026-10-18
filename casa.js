// ═══════════════════════════════════════════════════════════════
//  CASA INTELIGENTE — liga/desliga aparelhos (luz, TV, tomada…)
//  Funciona de dois jeitos, sem programar:
//   1) WEBHOOK: você cola o link "ligar" e "desligar" de cada
//      aparelho (IFTTT, Tuya/Smart Life, SmartThings, Home
//      Assistant, etc.). Mais fácil e funciona pela nuvem.
//   2) HOME ASSISTANT: endereço + token e o id da entidade.
//  Config: arquivo dados/casa.json (editável pela tela /casa) e/ou
//  a variável de ambiente CASA_JSON (persistente no Render).
// ═══════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = process.env.PASTA_DADOS || path.join(path.dirname(fileURLToPath(import.meta.url)), 'dados');
const ARQ = path.join(DIR, 'casa.json');

const semAcento = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function lerConfig() {
  let cfg = { dispositivos: [], ha: {} };
  try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(ARQ, 'utf8')) }; } catch {}
  if (process.env.CASA_JSON) {
    try {
      const env = JSON.parse(process.env.CASA_JSON);
      const porNome = new Map(cfg.dispositivos.map(d => [semAcento(d.nome), d]));
      for (const d of (env.dispositivos || [])) porNome.set(semAcento(d.nome), d);
      cfg.dispositivos = [...porNome.values()];
      if (env.ha) cfg.ha = { ...cfg.ha, ...env.ha };
    } catch {}
  }
  return cfg;
}

export function salvarConfig(cfg) {
  fs.mkdirSync(DIR, { recursive: true });
  const limpo = {
    dispositivos: (cfg.dispositivos || []).filter(d => d && d.nome).slice(0, 60).map(d => ({
      nome: String(d.nome).slice(0, 40),
      tipo: d.tipo === 'ha' ? 'ha' : 'webhook',
      ligar: String(d.ligar || '').slice(0, 500),
      desligar: String(d.desligar || '').slice(0, 500),
      metodo: /^(GET|POST)$/i.test(d.metodo) ? d.metodo.toUpperCase() : 'POST',
      entidade: String(d.entidade || '').slice(0, 80)
    })),
    ha: { url: String(cfg.ha?.url || '').slice(0, 300), token: String(cfg.ha?.token || '').slice(0, 400) }
  };
  fs.writeFileSync(ARQ, JSON.stringify(limpo, null, 2));
  return limpo;
}

export function listar() {
  const cfg = lerConfig();
  return cfg.dispositivos.map(d => ({ nome: d.nome, tipo: d.tipo, temLigar: !!(d.ligar || d.entidade), temDesligar: !!(d.desligar || d.entidade) }));
}

function achar(cfg, alvo) {
  const a = semAcento(alvo);
  if (!a) return [];
  if (/\b(tudo|tudos|geral|casa inteira)\b/.test(a)) return cfg.dispositivos.slice();
  // casamento por nome contido (nos dois sentidos)
  const exato = cfg.dispositivos.filter(d => semAcento(d.nome) === a);
  if (exato.length) return exato;
  return cfg.dispositivos.filter(d => { const n = semAcento(d.nome); return n && (a.includes(n) || n.includes(a)); });
}

async function acionarUm(cfg, d, acao) {
  const ligar = acao === 'ligar';
  if (d.tipo === 'ha') {
    const base = (cfg.ha?.url || '').replace(/\/+$/, '');
    if (!base || !cfg.ha?.token) throw new Error('Home Assistant não configurado');
    const dominio = (d.entidade || '').split('.')[0] || 'homeassistant';
    const r = await fetch(`${base}/api/services/${dominio}/${ligar ? 'turn_on' : 'turn_off'}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.ha.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: d.entidade }),
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) throw new Error(`HA HTTP ${r.status}`);
    return true;
  }
  const url = ligar ? d.ligar : d.desligar;
  if (!url) throw new Error(`sem link de ${ligar ? 'ligar' : 'desligar'} para ${d.nome}`);
  const r = await fetch(url, { method: d.metodo || 'POST', signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return true;
}

// acao: 'ligar' | 'desligar' ; alvo: nome do aparelho ou "tudo"
export async function acionar(acao, alvo) {
  const cfg = lerConfig();
  if (!cfg.dispositivos.length) return { ok: false, motivo: 'nenhum_dispositivo' };
  acao = acao === 'desligar' ? 'desligar' : 'ligar';
  const alvos = achar(cfg, alvo);
  if (!alvos.length) return { ok: false, motivo: 'nao_encontrado', alvo };
  const feitos = [], falhas = [];
  for (const d of alvos) {
    try { await acionarUm(cfg, d, acao); feitos.push(d.nome); }
    catch (e) { falhas.push({ nome: d.nome, erro: e.message }); }
  }
  return { ok: feitos.length > 0, acao, feitos, falhas };
}

// Detecta "liga/desliga <aparelho>" no texto, só se houver aparelho configurado.
export function comandoDoTexto(texto) {
  const t = semAcento(texto);
  const desliga = /\b(desliga|desligar|desligue|apaga|apague|apagar|desativa|desativar|desative)\b/.test(t);
  const liga = /\b(liga|ligar|ligue|acende|acenda|acender|ativa|ativar|ative|abre a luz)\b/.test(t);
  if (!liga && !desliga) return null;
  const cfg = lerConfig();
  if (!cfg.dispositivos.length) return null;
  const acao = desliga ? 'desligar' : 'ligar';
  if (/\b(tudo|geral|casa inteira|todas as luzes|tudos)\b/.test(t)) return { acao, alvo: 'tudo' };
  // procura algum aparelho configurado citado no texto
  const bate = cfg.dispositivos.find(d => { const n = semAcento(d.nome); return n && t.includes(n); });
  if (bate) return { acao, alvo: bate.nome };
  // palavras-chave comuns que batem com um aparelho configurado
  for (const chave of ['luz', 'lampada', 'tv', 'televisao', 'tomada', 'ar condicionado', 'ventilador', 'som']) {
    if (t.includes(chave)) {
      const d = cfg.dispositivos.find(x => semAcento(x.nome).includes(chave));
      if (d) return { acao, alvo: d.nome };
    }
  }
  return null;
}
