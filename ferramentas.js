
// ═══════════════════════════════════════════════════════════════
//  FERRAMENTAS DO J.A.R.V.I.S. — dados em tempo real, sem chave
//  clima (Open-Meteo) · cotações (AwesomeAPI) · notícias (Google
//  Notícias) · Wikipédia · memória de longo prazo
// ═══════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pegar = async (url, tipo = 'json', tentativas = 3) => {
  let ultimoErro = null;
  for (let t = 0; t < tentativas; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'JARVIS/2.0 (assistente pessoal)' }, signal: AbortSignal.timeout(12000) });
      if (r.status === 429 && t < tentativas - 1) { // rate limit: espera e tenta de novo
        await new Promise(rr => setTimeout(rr, Math.min(8000, 1500 * Math.pow(2, t))));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return tipo === 'json' ? r.json() : r.text();
    } catch (e) {
      ultimoErro = e;
      if (t < tentativas - 1 && /HTTP 429|timeout|timed out|fetch failed|network/i.test(e.message || ''))
        await new Promise(rr => setTimeout(rr, 900 * (t + 1)));
      else throw e;
    }
  }
  throw ultimoErro;
};

// ── CLIMA ──────────────────────────────────────────────────────
const CODIGOS = {
  0: 'céu limpo', 1: 'predominantemente limpo', 2: 'parcialmente nublado', 3: 'nublado', 45: 'neblina', 48: 'neblina',
  51: 'garoa fraca', 53: 'garoa', 55: 'garoa forte', 61: 'chuva fraca', 63: 'chuva', 65: 'chuva forte',
  66: 'chuva congelante', 67: 'chuva congelante', 71: 'neve fraca', 73: 'neve', 75: 'neve forte',
  80: 'pancadas de chuva', 81: 'pancadas de chuva', 82: 'pancadas fortes de chuva', 95: 'trovoadas', 96: 'trovoadas com granizo', 99: 'trovoadas com granizo'
};
const cacheGeo = new Map();
// coordenadas conhecidas: se a geocodificação falhar (ex.: rate limit), usa direto
const COORDS_CONHECIDAS = {
  'são josé dos campos': { latitude: -23.17944, longitude: -45.88694, name: 'São José dos Campos', admin1: 'São Paulo' },
  'sao jose dos campos': { latitude: -23.17944, longitude: -45.88694, name: 'São José dos Campos', admin1: 'São Paulo' }
};
export async function clima(cidade) {
  try { return await climaOpenMeteo(cidade); }
  catch (e) { return await climaWttr(cidade); }
}
// wttr.in (sem chave) — reserva quando o Open-Meteo limita o IP
const WTTR_PT = { 'clear': 'céu limpo', 'sunny': 'ensolarado', 'partly cloudy': 'parcialmente nublado', 'cloudy': 'nublado', 'overcast': 'encoberto', 'mist': 'neblina', 'fog': 'nevoeiro', 'patchy rain nearby': 'chuva fraca próxima', 'patchy rain possible': 'possível chuva fraca', 'light rain': 'chuva fraca', 'moderate rain': 'chuva moderada', 'heavy rain': 'chuva forte', 'light drizzle': 'garoa fraca', 'thundery outbreaks possible': 'possíveis trovoadas' };
const wPt = s => WTTR_PT[String(s || '').toLowerCase()] || String(s || '');
async function climaWttr(cidade) {
  cidade = String(cidade || '').trim() || process.env.CIDADE_PADRAO || 'São José dos Campos';
  const d = await pegar(`https://wttr.in/${encodeURIComponent(cidade)}?format=j1`);
  const a = d.current_condition[0], h = d.weather[0], m = d.weather[1];
  const dia = (w) => ({ max: Number(w.maxtempC), min: Number(w.mintempC), condicao: wPt(w.hourly[Math.min(4, w.hourly.length - 1)].weatherDesc[0].value) });
  return {
    cidade,
    agora: { temperatura: Number(a.temp_C), sensacao: Number(a.FeelsLikeC), umidade: Number(a.humidity), vento_kmh: Math.round(Number(a.windspeedKmph)), condicao: wPt(a.weatherDesc[0].value) },
    hoje: dia(h), amanha: dia(m), fonte: 'wttr.in'
  };
}
async function climaOpenMeteo(cidade) {
  cidade = String(cidade || '').trim() || process.env.CIDADE_PADRAO || 'São José dos Campos';
  let geo = cacheGeo.get(cidade.toLowerCase());
  if (!geo) {
    try {
      const g = await pegar(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`);
      if (!g.results?.length) return { erro: `cidade "${cidade}" não encontrada` };
      geo = g.results[0];
    } catch (e) {
      geo = COORDS_CONHECIDAS[cidade.toLowerCase()] || null;
      if (!geo) return { erro: `falha ao consultar: ${e.message}` };
    }
    cacheGeo.set(cidade.toLowerCase(), geo);
  }
  const d = await pegar(`https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=2');
  const c = d.current, dd = d.daily;
  return {
    cidade: `${geo.name}${geo.admin1 ? ', ' + geo.admin1 : ''}`,
    agora: { temperatura: Math.round(c.temperature_2m), sensacao: Math.round(c.apparent_temperature), umidade: c.relative_humidity_2m, vento_kmh: Math.round(c.wind_speed_10m), condicao: CODIGOS[c.weather_code] || 'indefinido' },
    hoje: { max: Math.round(dd.temperature_2m_max[0]), min: Math.round(dd.temperature_2m_min[0]), chance_chuva: dd.precipitation_probability_max[0], condicao: CODIGOS[dd.weather_code[0]] },
    amanha: { max: Math.round(dd.temperature_2m_max[1]), min: Math.round(dd.temperature_2m_min[1]), chance_chuva: dd.precipitation_probability_max[1], condicao: CODIGOS[dd.weather_code[1]] }
  };
}

// ── COTAÇÕES ───────────────────────────────────────────────────
const NOMES_MOEDA = { dolar: 'USD', 'dólar': 'USD', usd: 'USD', euro: 'EUR', eur: 'EUR', bitcoin: 'BTC', btc: 'BTC', libra: 'GBP', gbp: 'GBP',
  iene: 'JPY', ethereum: 'ETH', eth: 'ETH', peso: 'ARS', 'peso argentino': 'ARS', 'dolar canadense': 'CAD', 'franco suico': 'CHF', yuan: 'CNY' };
export async function cotacao(moedas) {
  try { return await cotacaoAwesome(moedas); }
  catch { return await cotacaoReserva(moedas); }
}
async function cotacaoAwesome(moedas) {
  let lista = (Array.isArray(moedas) ? moedas : String(moedas || 'dolar,euro,bitcoin').split(/\s*(?:,|;|\se\s)\s*/))
    .map(m => NOMES_MOEDA[String(m).trim().toLowerCase()] || String(m).trim().toUpperCase()).filter(m => /^[A-Z]{3}$/.test(m));
  if (!lista.length) lista = ['USD', 'EUR', 'BTC'];
  const d = await pegar(`https://economia.awesomeapi.com.br/json/last/${[...new Set(lista)].map(m => m + '-BRL').join(',')}`);
  const saida = {};
  for (const k in d) saida[d[k].code] = { nome: d[k].name.split('/')[0], valor_reais: Number(d[k].bid), variacao_pct: Number(d[k].pctChange) };
  return saida;
}
// reserva quando a AwesomeAPI limita o IP: er-api (moedas) + CoinGecko (cripto)
const NOMES_CRIPTO = { BTC: 'bitcoin', ETH: 'ethereum' };
async function cotacaoReserva(moedas) {
  let lista = (Array.isArray(moedas) ? moedas : String(moedas || 'dolar,euro,bitcoin').split(/\s*(?:,|;|\se\s)\s*/))
    .map(m => NOMES_MOEDA[String(m).trim().toLowerCase()] || String(m).trim().toUpperCase()).filter(m => /^[A-Z]{3}$/.test(m));
  if (!lista.length) lista = ['USD', 'EUR', 'BTC'];
  lista = [...new Set(lista)];
  const fiat = lista.filter(m => !NOMES_CRIPTO[m]);
  const cripto = lista.filter(m => NOMES_CRIPTO[m]);
  const saida = {};
  if (fiat.length) {
    const d = await pegar('https://open.er-api.com/v6/latest/USD');
    const usdBrl = d.rates.BRL;
    for (const m of fiat) {
      if (m === 'USD') saida.USD = { nome: 'Dólar', valor_reais: usdBrl };
      else if (d.rates[m]) saida[m] = { nome: m, valor_reais: usdBrl / d.rates[m] };
    }
  }
  if (cripto.length) {
    const ids = cripto.map(m => NOMES_CRIPTO[m]).join(',');
    const d = await pegar(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl&include_24hr_change=true`);
    for (const m of cripto) {
      const info = d[NOMES_CRIPTO[m]];
      if (info) saida[m] = { nome: m === 'BTC' ? 'Bitcoin' : 'Ethereum', valor_reais: info.brl, variacao_pct: info.brl_24h_change };
    }
  }
  if (!Object.keys(saida).length) throw new Error('cotações indisponíveis');
  return saida;
}

// ── NOTÍCIAS ───────────────────────────────────────────────────
export async function noticias(tema) {
  const url = tema
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(tema)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
    : 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419';
  const xml = await pegar(url, 'texto');
  const itens = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/item>/g)].slice(0, 6)
    .map(m => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim());
  return { tema: tema || 'principais', manchetes: itens };
}

// ── WIKIPÉDIA ──────────────────────────────────────────────────
export async function wikipedia(termo) {
  const busca = await pegar(`https://pt.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(termo)}&limit=1&namespace=0&format=json`);
  const titulo = busca?.[1]?.[0];
  if (!titulo) return { erro: 'nada encontrado' };
  const r = await pegar(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`);
  return { titulo: r.title, resumo: String(r.extract || '').slice(0, 1200) };
}

// ── MEMÓRIA DE LONGO PRAZO ─────────────────────────────────────
const PASTA = process.env.PASTA_DADOS || path.join(path.dirname(fileURLToPath(import.meta.url)), 'dados');
const ARQ = path.join(PASTA, 'memoria.json');
export function lerMemoria() {
  try { return JSON.parse(fs.readFileSync(ARQ, 'utf8')); } catch { return []; }
}
export function lembrar(fato) {
  fato = String(fato || '').trim().slice(0, 300);
  if (!fato) return { erro: 'fato vazio' };
  const m = lerMemoria().filter(x => x.fato.toLowerCase() !== fato.toLowerCase());
  m.push({ fato, quando: new Date().toISOString() });
  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(ARQ, JSON.stringify(m.slice(-80), null, 2));
  return { ok: true, total: m.length };
}
export function esquecer(trecho) {
  const t = String(trecho || '').toLowerCase().trim();
  const antes = lerMemoria();
  const depois = t ? antes.filter(x => !x.fato.toLowerCase().includes(t)) : antes;
  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(ARQ, JSON.stringify(depois, null, 2));
  return { removidos: antes.length - depois.length };
}

// ── DESPACHO ───────────────────────────────────────────────────
export async function executarFerramenta(f) {
  const nome = String(f?.nome || '').toLowerCase();
  try {
    if (nome === 'clima') return await clima(f.cidade);
    if (nome === 'cotacao') return await cotacao(f.moedas);
    if (nome === 'noticias') return await noticias(f.tema);
    if (nome === 'wikipedia') return await wikipedia(f.termo || f.tema);
    if (nome === 'lembrar') return lembrar(f.fato);
    if (nome === 'esquecer') return esquecer(f.trecho || f.fato);
    if (nome === 'memoria') return { fatos: lerMemoria().map(x => x.fato) };
    return { erro: 'ferramenta desconhecida' };
  } catch (e) {
    return { erro: `falha ao consultar: ${e.message}` };
  }
}

// ── PAINEL (dados do HUD, com cache de 10 min) ────────────────
let painelCache = { t: 0, dados: null };
export async function painel() {
  if (painelCache.dados && Date.now() - painelCache.t < 600000) return painelCache.dados;
  const [c, q] = await Promise.allSettled([clima(), cotacao(['USD', 'EUR', 'BTC'])]);
  const dados = { clima: c.status === 'fulfilled' && !c.value.erro ? c.value : null, cotacao: q.status === 'fulfilled' ? q.value : null };
  if (dados.clima || dados.cotacao) painelCache = { t: Date.now(), dados };
  return dados;
}
