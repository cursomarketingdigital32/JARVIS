
// ════════════════════════════════════════════════════════════════
//  J.A.R.V.I.S. — VISUAIS
//  3 interfaces que reagem à voz:
//   • esfera    — rede neural 3D de pontos
//   • holograma — busto de linhas ciano, rosto laranja, montanhas
//   • tempestade — busto masculino neon roxo, fumaça e raios
// ════════════════════════════════════════════════════════════════
'use strict';
(() => {
const celular = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
let tela, g, L = 0, A = 0, DPR = 1, lerNivel = () => 0;
let modo = null, nomeModo = '', ultimo = performance.now(), tempo = 0;

const P = { energia: .25, deform: .05, giro: .12, brilho: .55, nivel: 0, escala: 1, estado: 'espera' };
const alvo = { energia: .25, deform: .05, giro: .12, brilho: .55, escala: 1 };
const TABELA = {
  espera:   { energia: .2,  deform: .04, giro: .08, brilho: .4,  escala: .96 },
  ouvindo:  { energia: .45, deform: .07, giro: .14, brilho: .75, escala: 1 },
  pensando: { energia: 1.4, deform: .16, giro: .55, brilho: .9,  escala: .92 },
  falando:  { energia: .8,  deform: .09, giro: .2,  brilho: 1,   escala: 1.04 }
};

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const lim = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const suave = x => { x = lim(x); return x * x * (3 - 2 * x); };
const cubica = (p0, p1, p2, p3, t) => {
  const m = 1 - t;
  return [m*m*m*p0[0] + 3*m*m*t*p1[0] + 3*m*t*t*p2[0] + t*t*t*p3[0], m*m*m*p0[1] + 3*m*m*t*p1[1] + 3*m*t*t*p2[1] + t*t*t*p3[1]];
};
const curva = (p0, p1, p2, p3, n = 24) => Array.from({ length: n + 1 }, (_, i) => cubica(p0, p1, p2, p3, i / n));

function novaCamada() {
  const c = document.createElement('canvas');
  c.width = Math.max(1, L * DPR); c.height = Math.max(1, A * DPR);
  const cg = c.getContext('2d');
  cg.setTransform(DPR, 0, 0, DPR, 0, 0);
  return [c, cg];
}

function textoStatus() {
  const e = { espera: 'STANDBY', ouvindo: 'OUVINDO', pensando: 'PROCESSANDO', falando: 'FALANDO' }[P.estado] || 'STANDBY';
  const n = P.nivel < .2 ? 'BAIXA' : P.nivel < .5 ? 'MÉDIA' : 'ALTA';
  return `STATUS: ${e}   INTENSIDADE: ${n}`;
}

// ════════════════════════════════════════════════════════════════
//  MODO 1 — ESFERA NEURAL
// ════════════════════════════════════════════════════════════════
const esfera = (() => {
  const N = celular ? 300 : 460;
  const pts = [], pares = [];
  const ouro = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y);
    const th = ouro * i + (Math.random() - .5) * .35;
    let x = Math.cos(th) * r, z = Math.sin(th) * r, yy = y + (Math.random() - .5) * .05;
    const n = Math.hypot(x, yy, z); x /= n; yy /= n; z /= n;
    pts.push({ x, y: yy, z, raio: .92 + Math.random() * .14, f1: rnd(0, 6.28), f2: rnd(0, 6.28), f3: rnd(0, 6.28),
      tam: Math.random() < .12 ? 2.4 + Math.random() * 1.4 : 1 + Math.random() * 1.2,
      espinho: Math.random() < .035 ? .6 + Math.random() * .9 : 0,
      sx: rnd(-3, 3), sy: rnd(-3, 3), sz: rnd(-3, 3), px: 0, py: 0, pz: 0, ps: 0 });
  }
  const visto = new Set(), K = celular ? 3 : 4;
  for (let i = 0; i < N; i++) {
    const d = [];
    for (let j = 0; j < N; j++) if (i !== j) d.push([(pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2 + (pts[i].z - pts[j].z) ** 2, j]);
    d.sort((p, q) => p[0] - q[0]);
    for (let k = 0; k < K; k++) { const j = d[k][1], ch = i < j ? i + '-' + j : j + '-' + i; if (!visto.has(ch)) { visto.add(ch); pares.push([i, j]); } }
  }
  for (let k = 0; k < N * .08; k++) pares.push([Math.random() * N | 0, Math.random() * N | 0]);
  const poeira = Array.from({ length: celular ? 40 : 90 }, () => ({ x: Math.random(), y: Math.random(), v: rnd(.002, .008), a: Math.random() * .35 }));
  let t0 = 0, interno = 0, angY = 0;

  return {
    entrar() { t0 = tempo; },
    redim() {},
    desenhar(dt) {
      const mont = 1 - Math.pow(1 - lim((tempo - t0) / 2.6), 3);
      interno += dt * (0.8 + P.energia * 1.6);
      angY += dt * (P.giro + P.nivel * .35);
      const t = interno, angX = .32 + Math.sin(t * .13) * .18;
      const cy = Math.cos(angY), sy = Math.sin(angY), cx = Math.cos(angX), sx = Math.sin(angX);
      const bg = g.createRadialGradient(L / 2, A * .45, 0, L / 2, A * .45, Math.max(L, A) * .75);
      bg.addColorStop(0, '#10224a'); bg.addColorStop(.45, '#081226'); bg.addColorStop(1, '#040913');
      g.fillStyle = bg; g.fillRect(0, 0, L, A);
      g.fillStyle = '#7db8ff';
      for (const p of poeira) {
        p.y -= p.v * dt * 6; if (p.y < 0) { p.y = 1; p.x = Math.random(); }
        g.globalAlpha = p.a * (.5 + P.brilho * .5); g.fillRect(p.x * L, p.y * A, 1.2, 1.2);
      }
      const R = Math.min(L * .42, A * .25) * P.escala * (1 + P.nivel * .1);
      const CX = L / 2, CY = A * (L < 640 ? .4 : .42), foco = R * 3.2;
      const gr = g.createRadialGradient(CX, CY, 0, CX, CY, R * 1.6);
      gr.addColorStop(0, `rgba(77,155,255,${.08 + P.brilho * .1 + P.nivel * .18})`); gr.addColorStop(1, 'rgba(77,155,255,0)');
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(CX - R * 2, CY - R * 2, R * 4, R * 4);
      const def = P.deform + P.nivel * .32, achata = 1 + Math.sin(t * .37) * .07 * (1 + P.energia);
      for (const p of pts) {
        const onda = Math.sin(p.x * 3.1 + t * .9 + p.f1) * .5 + Math.sin(p.y * 4.3 - t * 1.25 + p.f2) * .32 + Math.sin(p.z * 5.6 + t * 1.7 + p.f3) * .18;
        const r = p.raio + onda * def + p.espinho * P.nivel * (.6 + .4 * Math.sin(t * 6 + p.f1));
        let x = p.x * r, y = p.y * r / achata, z = p.z * r * achata;
        if (mont < 1) { x = p.sx + (x - p.sx) * mont; y = p.sy + (y - p.sy) * mont; z = p.sz + (z - p.sz) * mont; }
        const x1 = x * cy - z * sy, z1 = x * sy + z * cy, y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        const esc = foco / (foco + z2 * R);
        p.px = CX + x1 * R * esc; p.py = CY + y2 * R * esc; p.pz = z2; p.ps = esc;
      }
      g.lineWidth = .7; g.strokeStyle = '#6aaaff';
      const grupos = [[], [], [], []];
      for (const [i, j] of pares) { const a = pts[i], b = pts[j]; grupos[Math.max(0, Math.min(3, (((a.pz + b.pz) / 2 + 1.3) / 2.6 * 4) | 0))].push(a, b); }
      const al = (.1 + P.brilho * .22 + P.nivel * .25) * mont;
      grupos.forEach((lista, gi) => {
        g.globalAlpha = al * (1 - gi * .22); g.beginPath();
        for (let k = 0; k < lista.length; k += 2) { g.moveTo(lista[k].px, lista[k].py); g.lineTo(lista[k + 1].px, lista[k + 1].py); }
        g.stroke();
      });
      g.globalCompositeOperation = 'lighter';
      for (const p of pts) {
        const a = (.25 + (1 - (p.pz + 1.2) / 2.4) * .75) * (.55 + P.brilho * .45), s = p.tam * p.ps * (1 + P.nivel * .5);
        g.globalAlpha = Math.max(.05, a); g.fillStyle = p.tam > 2.3 ? '#d4e8ff' : '#8fc3ff';
        g.fillRect(p.px - s / 2, p.py - s / 2, s, s);
        if (p.tam > 2.3) { g.globalAlpha = a * .18; g.fillRect(p.px - s * 1.6, p.py - s * 1.6, s * 3.2, s * 3.2); }
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
  };
})();

// ════════════════════════════════════════════════════════════════
//  BUSTO — geometria compartilhada (coordenadas normalizadas:
//  u = horizontal a partir do centro, v = vertical a partir do topo)
// ════════════════════════════════════════════════════════════════
function criarBusto(fem) {
  const kL = fem ? .84 : 1, queixo = fem ? .56 : .575, vc = fem ? .25 : .26;
  const cabeca = v => {
    if (v < 0 || v > queixo) return 0;
    let w;
    if (v <= vc) { const t = (v - vc) / vc; w = .2 * Math.sqrt(Math.max(0, 1 - t * t)); }
    else { const t = (v - vc) / (queixo - vc); w = .2 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - (fem ? .3 : .22) * t); }
    if (!fem) w += .016 * Math.exp(-(((v - .3) / .035) ** 2));
    return w * kL;
  };
  // ombros (curvas de Bézier amostradas)
  const seg = fem
    ? [[[.085, .62], [.09, .75], [.32, .73], [.45, .83]], [[.45, .83], [.53, .89], [.53, 1.0], [.52, 1.6]]]
    : [[[.112, .62], [.118, .745], [.40, .75], [.58, .86]], [[.58, .86], [.70, .93], [.74, 1.0], [.77, 1.6]]];
  const tab = [];
  seg.forEach(s => { for (let i = 0; i <= 80; i++) tab.push(cubica(...s, i / 80)); });
  tab.sort((a, b) => a[1] - b[1]);
  const pescocoTopo = .47, pesc0 = fem ? .078 : .105;
  const corpo = v => {
    if (v < pescocoTopo) return 0;
    if (v < seg[0][0][1]) return pesc0 + (seg[0][0][0] - pesc0) * (v - pescocoTopo) / (seg[0][0][1] - pescocoTopo);
    if (v >= tab[tab.length - 1][1]) return tab[tab.length - 1][0];
    let i = 1; while (tab[i][1] < v) i++;
    const a = tab[i - 1], b = tab[i], k = (v - a[1]) / Math.max(1e-6, b[1] - a[1]);
    return a[0] + (b[0] - a[0]) * k;
  };
  const dentroCorpo = (u, v) => v > pescocoTopo + .02 && Math.abs(u) < corpo(v) - .004;
  return { cabeca, corpo, dentroCorpo, queixo, vc, pescocoTopo, fem };
}

// Base dos modos holográficos: layout, partículas de montagem, conversão de coordenadas
function baseHolo(fem) {
  const B = criarBusto(fem);
  const H = { B, S: 1, cx: 0, topo: 0, vMax: 1.6, linhas: [], amostras: [], estatico: null, t0: 0 };
  H.X = u => H.cx + u * H.S;
  H.Y = v => H.topo + v * H.S;
  H.layout = () => {
    if (L < 640) { H.S = Math.min(A * .6, L * 1.05); H.topo = A * .17; }
    else { H.S = Math.min(A * .8, L * .9); H.topo = A * .09; }
    H.cx = L / 2;
    H.vMax = (A - H.topo) / H.S + .05;
  };
  H.caminhoCabeca = (cg) => {
    cg.beginPath();
    for (let v = 0; v <= B.queixo; v += .005) cg.lineTo(H.X(B.cabeca(v)), H.Y(v));
    for (let v = B.queixo; v >= 0; v -= .005) cg.lineTo(H.X(-B.cabeca(v)), H.Y(v));
    cg.closePath();
  };
  H.caminhoCorpo = (cg) => {
    cg.beginPath();
    for (let v = B.pescocoTopo; v <= H.vMax; v += .005) cg.lineTo(H.X(-B.corpo(v)), H.Y(v));
    for (let v = H.vMax; v >= B.pescocoTopo; v -= .005) cg.lineTo(H.X(B.corpo(v)), H.Y(v));
    cg.closePath();
  };
  H.contornoCorpo = (lado) => { const pts = []; for (let v = B.pescocoTopo + .04; v <= H.vMax; v += .006) pts.push([lado * B.corpo(v), v]); return pts; };
  H.contornoCabeca = () => {
    const pts = [];
    for (let v = 0; v <= B.queixo; v += .004) pts.push([B.cabeca(v), v]);
    for (let v = B.queixo; v >= 0; v -= .004) pts.push([-B.cabeca(v), v]);
    pts.push(pts[0]);
    return pts;
  };
  // amostra pontos das linhas para a animação de montagem
  H.amostrar = (total) => {
    const todos = [];
    for (const l of H.linhas) for (const p of l.pts) todos.push([p[0], p[1], l.cor2 || l.cor]);
    const passo = Math.max(1, todos.length / total);
    H.amostras = [];
    for (let i = 0; i < todos.length; i += passo) {
      const [u, v, cor] = todos[i | 0];
      H.amostras.push({ u, v, cor, atraso: rnd(.25, 1.55), cu: rnd(.35, .85) * (fem ? -1 : 1), cv: rnd(.15, .55) });
    }
  };
  H.desenharLinha = (cg, pts) => { cg.beginPath(); pts.forEach((p, i) => i ? cg.lineTo(H.X(p[0]), H.Y(p[1])) : cg.moveTo(H.X(p[0]), H.Y(p[1]))); };
  // partículas saindo da esfera de luz e formando o busto
  H.montagem = (tm, corOrbe) => {
    const orbe = [0, fem ? .95 : .98];
    const fimParticulas = 1 - lim((tm - 2.5) / .7);
    // esfera de luz
    const ox = H.X(orbe[0]), oy = H.Y(orbe[1]);
    const brilhoOrbe = tm < 2.6 ? lim(tm / .3) : .35 + P.nivel * .4;
    const go = g.createRadialGradient(ox, oy, 0, ox, oy, H.S * (tm < 2.6 ? .07 : .035));
    go.addColorStop(0, `rgba(255,255,255,${brilhoOrbe})`); go.addColorStop(.25, corOrbe(brilhoOrbe * .9)); go.addColorStop(1, corOrbe(0));
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = go; g.fillRect(ox - H.S * .1, oy - H.S * .1, H.S * .2, H.S * .2);
    if (fimParticulas <= 0) { g.globalCompositeOperation = 'source-over'; return; }
    for (const a of H.amostras) {
      const k = suave((tm - a.atraso) / 1.25);
      if (k <= 0) continue;
      const c = [orbe[0] + a.cu, orbe[1] - a.cv];
      const m = 1 - k;
      const u = m * m * orbe[0] + 2 * m * k * c[0] + k * k * a.u + Math.sin(k * 9 + a.atraso * 7) * .01 * m;
      const v = m * m * orbe[1] + 2 * m * k * c[1] + k * k * a.v;
      g.globalAlpha = fimParticulas * (.35 + .65 * k);
      g.fillStyle = a.cor;
      const s = 1.1 + (1 - k) * 1.4;
      g.fillRect(H.X(u) - s / 2, H.Y(v) - s / 2, s, s);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  };
  return H;
}

// anéis de HUD (marcas, arcos e leitura de dados) em volta da cabeça
function anelHUD(cx, cy, S, t, n, aparece, rgb) {
  const R = S * .335;
  const vel = P.estado === 'pensando' ? 1.6 : .25 + n * .8;
  g.save();
  g.translate(cx, cy);
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = `rgb(${rgb})`; g.fillStyle = `rgb(${rgb})`;
  // arco externo segmentado
  g.lineWidth = 1.2; g.globalAlpha = (.22 + n * .3) * aparece;
  for (let k = 0; k < 6; k++) {
    const a0 = t * vel * .5 + k * Math.PI / 3;
    g.beginPath(); g.arc(0, 0, R * 1.08, a0, a0 + Math.PI / 5); g.stroke();
  }
  // marcas de escala
  g.globalAlpha = (.18 + n * .25) * aparece; g.lineWidth = 1;
  g.beginPath();
  for (let k = 0; k < 72; k++) {
    const a = -t * vel * .3 + k * Math.PI / 36, r1 = R * (k % 6 ? 1.0 : .97);
    g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02);
  }
  g.stroke();
  // arco de intensidade (mostra o volume da voz)
  g.globalAlpha = (.35 + n * .5) * aparece; g.lineWidth = 2.4;
  g.beginPath(); g.arc(0, 0, R * 1.15, -Math.PI * .25, -Math.PI * .25 + Math.PI * .5 * (.08 + n * .92)); g.stroke();
  g.globalAlpha = .12 * aparece; g.lineWidth = 2.4;
  g.beginPath(); g.arc(0, 0, R * 1.15, -Math.PI * .25, Math.PI * .25); g.stroke();
  // pontos orbitando
  g.globalAlpha = .8 * aparece;
  for (let k = 0; k < 3; k++) {
    const a = t * (vel + .3) * (k % 2 ? -1 : 1) + k * 2.1, r = R * (1.08 + k * .035);
    g.fillRect(Math.cos(a) * r - 1.5, Math.sin(a) * r - 1.5, 3, 3);
  }
  g.restore();
}

// ════════════════════════════════════════════════════════════════
//  MODO 2 — HOLOGRAMA (ciano + núcleo laranja)
// ════════════════════════════════════════════════════════════════
const holograma = (() => {
  const H = baseHolo(false);
  const B = H.B;
  let terreno = null, brilhosTerreno = [], veias = [], halo = [];
  const CIANO = 'rgb(95,230,255)', LARANJA = 'rgb(255,170,60)';

  function gerarVeias() {
    const linhas = [];
    const ramo = (x, y, ang, comp, prof) => {
      const pts = [[x, y]]; let a = ang; const passos = 9;
      for (let i = 0; i < passos; i++) {
        a += rnd(-.38, .38); a = lim(a, -.9, .9);
        x += Math.sin(a) * comp / passos; y += Math.cos(a) * comp / passos;
        if (!B.dentroCorpo(x, y) && y > .62) break;
        pts.push([x, y]);
        if (prof < 3 && Math.random() < .2) ramo(x, y, a + (Math.random() < .5 ? -1 : 1) * rnd(.45, .9), comp * .5, prof + 1);
      }
      linhas.push({ pts, prof, fase: rnd(0, 6.28) });
    };
    ramo(0, .565, 0, .3, 0);
    ramo(-.025, .6, -.18, .26, 1); ramo(.025, .6, .18, .26, 1);
    ramo(-.05, .66, -.5, .2, 2); ramo(.05, .66, .5, .2, 2);
    return linhas;
  }

  function gerarTerreno() {
    const [c, cg] = novaCamada();
    brilhosTerreno = [];
    const camadas = celular ? 6 : 9;
    const passo = celular ? 2.4 : 2;
    // de trás para a frente: cada camada mais próxima cobre a anterior
    for (let j = 0; j < camadas; j++) {
      const perto = (j + 1) / camadas;
      const base = A * (.5 + j * .052), amp = A * (.09 + perto * .13);
      const f = [rnd(.0025, .0045), rnd(.008, .013), rnd(.02, .032)], fa = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
      const fr = rnd(.004, .008), frp = rnd(0, 6);
      const cume = [];
      for (let x = -4; x <= L + 4; x += passo) {
        const pico = k => 1 - Math.abs(Math.sin(x * f[k] + fa[k]));
        const h = .58 * pico(0) ** 1.3 + .28 * pico(1) + .14 * pico(2);
        const lado = .35 + 1.15 * Math.min(1, Math.abs(x - L / 2) / (L * .5));
        cume.push([x, base - amp * lado * h, lado]);
      }
      // corpo escuro da montanha (esconde as camadas de trás)
      cg.fillStyle = 'rgba(2,5,11,.93)';
      cg.beginPath(); cg.moveTo(-4, A);
      for (const [x, y] of cume) cg.lineTo(x, y);
      cg.lineTo(L + 4, A); cg.closePath(); cg.fill();
      for (const [x, y, lado] of cume) {
        const a = (.3 + .65 * perto) * rnd(.55, 1);
        cg.fillStyle = `rgba(90,210,255,${a})`;
        cg.fillRect(x, y, 1.4, 1.4);
        if (Math.random() < .02) brilhosTerreno.push([x, y]);
        // encosta com pontos (mais densos perto do cume)
        for (let k = 0; k < 9; k++) {
          const d = Math.pow(Math.random(), 2.2) * amp * lado;
          cg.fillStyle = `rgba(55,165,235,${a * (1 - d / (amp * lado + 1)) * rnd(.25, .7)})`;
          cg.fillRect(x + rnd(-1.5, 1.5), y + d, 1.1, 1.1);
        }
        // rios de lava nos vales
        if (Math.sin(x * fr + frp) > .35 && Math.random() < .5) {
          const d = rnd(.08, .45) * amp * lado;
          cg.fillStyle = `rgba(255,${rnd(120, 200) | 0},50,${(.35 + .6 * perto) * rnd(.4, 1)})`;
          cg.fillRect(x, y + d, 1.5, 1.5);
          if (Math.random() < .03) brilhosTerreno.push([x, y + d]);
        }
      }
    }
    // some suavemente no alto
    const fade = cg.createLinearGradient(0, A * .25, 0, A * .5);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    cg.globalCompositeOperation = 'destination-out';
    cg.fillStyle = fade; cg.fillRect(0, 0, L, A * .5);
    cg.globalCompositeOperation = 'source-over';
    return c;
  }

  function gerarEstatico() {
    H.linhas = [];
    // linhas horizontais da cabeça
    for (let v = .018; v < B.queixo - .008; v += .0115) {
      const hw = B.cabeca(v) * .985, pts = [];
      for (let i = 0; i <= 30; i++) { const u = -hw + 2 * hw * i / 30; pts.push([u, v + .008 * (1 - (u / hw) ** 2)]); }
      H.linhas.push({ pts, cor: CIANO, alfa: .55, larg: 1.05, cor2: v > .14 && v < .5 ? LARANJA : CIANO });
    }
    // anéis do peito e ombros
    const vAnel = Math.max(1.27, H.vMax + .15);
    for (let r = .12; r < 1.9; r += .021) {
      let atual = [];
      const fechar = () => { if (atual.length > 2) H.linhas.push({ pts: atual, cor: CIANO, alfa: .3, larg: .9 }); atual = []; };
      for (let a = Math.PI; a <= Math.PI * 2; a += .012) {
        const u = Math.cos(a) * r, v = vAnel + Math.sin(a) * r * .6;
        if (B.dentroCorpo(u, v) && v < H.vMax) atual.push([u, v]); else fechar();
      }
      fechar();
    }
    // linhas do pescoço
    for (let k = -4; k <= 4; k++) {
      const pts = [];
      for (let v = .52; v < .72; v += .01) pts.push([k * .022 * (1 + (v - .52) * 1.6), v]);
      H.linhas.push({ pts, cor: CIANO, alfa: .18, larg: .8 });
    }
    veias = gerarVeias();
    H.amostrar(celular ? 1100 : 2000);

    const [c, cg] = novaCamada();
    cg.fillStyle = 'rgba(2,6,14,.94)';
    H.caminhoCorpo(cg); cg.fill();
    H.caminhoCabeca(cg); cg.fill();
    cg.globalCompositeOperation = 'lighter';
    cg.lineCap = 'round';
    for (const l of H.linhas) {
      cg.globalAlpha = l.alfa; cg.strokeStyle = l.cor; cg.lineWidth = l.larg;
      H.desenharLinha(cg, l.pts); cg.stroke();
    }
    // contornos com brilho
    cg.globalAlpha = 1;
    cg.shadowColor = '#00c8ff';
    const contornos = [H.contornoCabeca(), H.contornoCorpo(-1), H.contornoCorpo(1)];
    for (const [larg, blur, cor] of [[6, 26, 'rgba(0,170,255,.35)'], [2.6, 14, 'rgba(110,235,255,.95)'], [1.1, 4, 'rgba(230,255,255,.9)']]) {
      cg.lineWidth = larg; cg.shadowBlur = blur * DPR; cg.strokeStyle = cor;
      for (const pts of contornos) { H.desenharLinha(cg, pts); cg.stroke(); }
    }
    cg.shadowBlur = 0;
    // contorno interno da cabeça
    cg.globalAlpha = .5; cg.lineWidth = 1; cg.strokeStyle = CIANO;
    cg.beginPath();
    for (let v = .03; v <= B.queixo - .03; v += .004) cg.lineTo(H.X(B.cabeca(v) * .93), H.Y(v));
    cg.stroke(); cg.beginPath();
    for (let v = .03; v <= B.queixo - .03; v += .004) cg.lineTo(H.X(-B.cabeca(v) * .93), H.Y(v));
    cg.stroke();
    H.estatico = c;
  }

  function novaParticulaHalo(inicio) {
    const a = rnd(-Math.PI * .95, -Math.PI * .05);
    const r = 1 + rnd(0, .08);
    return { u: Math.cos(a) * .2 * r, v: .26 + Math.sin(a) * .27 * r, du: Math.cos(a) * rnd(.004, .02), dv: Math.sin(a) * rnd(.006, .025) - .006,
      vida: inicio ? rnd(0, 1) : 0, dur: rnd(1.5, 4) };
  }

  return {
    entrar() { H.t0 = tempo; if (!H.estatico) this.redim(); },
    redim() {
      H.layout(); terreno = gerarTerreno(); gerarEstatico();
      halo = Array.from({ length: celular ? 160 : 280 }, () => novaParticulaHalo(true));
    },
    desenhar(dt) {
      const tm = tempo - H.t0, t = tempo, n = P.nivel, S = H.S;
      const aparece = suave((tm - 2.1) / .8);
      // fundo
      g.fillStyle = '#02050b'; g.fillRect(0, 0, L, A);
      g.globalAlpha = .55 + .45 * suave(tm / 1.5);
      g.drawImage(terreno, 0, 0, L, A);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const p = brilhosTerreno[(Math.random() * brilhosTerreno.length) | 0];
        if (!p) break;
        g.globalAlpha = rnd(.3, .9); g.fillStyle = Math.random() < .3 ? LARANJA : CIANO;
        g.fillRect(p[0] - 1, p[1] - 1, 2.2, 2.2);
      }
      // anéis quando está ouvindo
      if (P.estado === 'ouvindo' || P.estado === 'pensando') {
        g.strokeStyle = CIANO; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const f = (t * (P.estado === 'pensando' ? .9 : .45) + k / 4) % 1;
          g.globalAlpha = (1 - f) * (.1 + n * .5) * aparece;
          g.beginPath(); g.ellipse(H.X(0), H.Y(.29), S * (.24 + f * .35), S * (.31 + f * .35), 0, 0, Math.PI * 2); g.stroke();
        }
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      if (aparece > 0) {
        g.globalAlpha = aparece;
        g.drawImage(H.estatico, 0, 0, L, A);
        if (n > .05) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = aparece * n * .55; g.drawImage(H.estatico, 0, 0, L, A); }
        g.globalCompositeOperation = 'lighter';
        // núcleo laranja do rosto
        const fx = H.X(0), fy = H.Y(.33);
        const forca = (.5 + P.brilho * .25 + n * .6) * aparece;
        const nucleo = g.createRadialGradient(fx, fy, 0, fx, fy, S * (.19 + n * .04));
        nucleo.addColorStop(0, `rgba(255,240,170,${.75 * forca})`);
        nucleo.addColorStop(.35, `rgba(255,160,40,${.55 * forca})`);
        nucleo.addColorStop(.75, `rgba(255,90,10,${.18 * forca})`);
        nucleo.addColorStop(1, 'rgba(255,80,0,0)');
        g.globalAlpha = 1; g.fillStyle = nucleo; g.fillRect(fx - S * .3, fy - S * .3, S * .6, S * .6);
        // ondas do rosto
        const amp = .0022 + n * .013 + (P.estado === 'pensando' ? .004 : 0);
        const vel = 3 + n * 6 + P.energia * 2;
        g.lineWidth = 1.3;
        for (let v = .12; v < .53; v += .0115) {
          const hw = B.cabeca(v) * .9;
          const a = forca * Math.exp(-(((v - .33) / .14) ** 2));
          if (a < .03) continue;
          const lg = g.createLinearGradient(H.X(-hw), 0, H.X(hw), 0);
          lg.addColorStop(0, 'rgba(255,140,40,0)');
          lg.addColorStop(.5, `rgba(255,${(200 + n * 50) | 0},${(90 + n * 90) | 0},${lim(a)})`);
          lg.addColorStop(1, 'rgba(255,140,40,0)');
          g.strokeStyle = lg; g.beginPath();
          for (let i = 0; i <= 28; i++) {
            const u = -hw + 2 * hw * i / 28;
            let dv = amp * Math.sin(u * 26 + t * vel + v * 9) + amp * .4 * Math.sin(u * 47 - t * vel * .7);
            if (P.estado === 'pensando') dv += .005 * Math.sin(Math.atan2(v - .33, u) * 3 + t * 5);
            const y = H.Y(v + .008 * (1 - (u / hw) ** 2) + dv);
            i ? g.lineTo(H.X(u), y) : g.moveTo(H.X(u), y);
          }
          g.stroke();
        }
        // veias
        g.lineCap = 'round';
        for (const ve of veias) {
          const pul = .45 + .35 * Math.sin(t * 2.2 + ve.fase) + n * .7;
          g.globalAlpha = lim(pul) * aparece * (1 - ve.prof * .15);
          g.strokeStyle = 'rgba(255,150,40,.9)'; g.lineWidth = 1.7 - ve.prof * .3;
          H.desenharLinha(g, ve.pts); g.stroke();
          g.globalAlpha *= .3; g.lineWidth = 5; g.stroke();
        }
        // anéis de HUD girando em volta da cabeça
        anelHUD(H.X(0), H.Y(.29), S, t, n, aparece, '95,230,255');
        // poeira de luz em volta da cabeça
        g.fillStyle = '#7fe6ff';
        for (let i = 0; i < halo.length; i++) {
          const p = halo[i];
          p.vida += dt / p.dur;
          if (p.vida >= 1) { halo[i] = novaParticulaHalo(false); continue; }
          const k = 1 + n * 3;
          p.u += p.du * dt * k; p.v += p.dv * dt * k;
          g.globalAlpha = Math.sin(p.vida * Math.PI) * .75 * aparece;
          g.fillRect(H.X(p.u), H.Y(p.v), 1.4, 1.4);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        // texto de status
        g.globalAlpha = .85 * aparece;
        g.fillStyle = CIANO;
        g.font = `${Math.max(9, Math.round(S * .015))}px ui-monospace, Consolas, monospace`;
        if (L >= 640) { g.textAlign = 'right'; g.fillText(textoStatus(), H.X(-.42), H.Y(.12)); g.textAlign = 'left'; }
        g.textAlign = 'left'; g.globalAlpha = 1;
      }
      H.montagem(tm, a => `rgba(80,210,255,${a})`);
    }
  };
})();

// ════════════════════════════════════════════════════════════════
//  MODO 3 — TEMPESTADE (busto masculino neon, fumaça e raios)
// ════════════════════════════════════════════════════════════════
const tempestade = (() => {
  const H = baseHolo(false);
  const B = H.B;
  let fumacas = [], raios = [], brilhos = [];
  const LUZ = 'rgb(232,210,255)', OURO = 'rgb(255,190,110)', ROXO = 'rgb(170,110,255)', AZUL = 'rgb(140,170,255)';

  function linha(pts, cor, alfa, larg, filtrar) {
    if (filtrar) pts = pts.filter(p => B.dentroCorpo(p[0], p[1]));
    if (pts.length > 2) H.linhas.push({ pts, cor, alfa, larg });
  }
  const espelho = (fn) => { for (const s of [-1, 1]) fn(s); };

  function gerarEstatico() {
    H.linhas = [];
    // cabelo curto, penteado para cima (energia no topo da cabeça)
    const topoCab = u => B.vc - B.vc * Math.sqrt(Math.max(0, 1 - (u / .2) ** 2));
    for (let i = 0; i < (celular ? 46 : 70); i++) {
      const u0 = rnd(-.165, .165);
      const v0 = .105 + .07 * (u0 / .165) ** 2 + rnd(-.008, .008);
      const u3 = lim(u0 * 1.18 + rnd(-.015, .015), -.2, .2);
      const v3 = topoCab(u3) - rnd(.008, .04);
      linha(curva([u0, v0], [u0 * 1.05, v0 - .04], [u3 * .98, v3 + .05], [u3, v3], 18),
        Math.random() < .22 ? OURO : LUZ, rnd(.3, .75), rnd(.7, 1.4));
    }
    // costeletas
    for (let i = 0; i < 10; i++) {
      const s = i % 2 ? 1 : -1;
      linha(curva([s * rnd(.165, .18), rnd(.11, .14)], [s * rnd(.18, .19), .17], [s * rnd(.185, .195), .21], [s * rnd(.18, .19), rnd(.24, .28)], 12), LUZ, rnd(.3, .6), rnd(.7, 1.2));
    }
    espelho(s => {
      // rosto: maxilar, maçãs, sobrancelhas
      linha(curva([s * .19, .35], [s * .185, .46], [s * .11, .56], [s * .02, .573], 24), LUZ, .55, 1.3);
      linha(curva([s * .175, .28], [s * .15, .31], [s * .1, .345], [s * .06, .36], 16), ROXO, .35, 1);
      linha(curva([s * .155, .205], [s * .12, .19], [s * .06, .2], [s * .02, .215], 16), LUZ, .55, 1.4);
      // pescoço: esternocleidomastoideo e trapézio
      linha(curva([s * .12, .45], [s * .1, .55], [s * .06, .62], [s * .025, .68], 20), LUZ, .45, 1.1);
      linha(curva([s * .1, .55], [s * .14, .68], [s * .32, .72], [s * .47, .78], 26), LUZ, .55, 1.3, true);
      // clavículas
      linha(curva([s * .03, .695], [s * .15, .67], [s * .3, .72], [s * .42, .735], 24), OURO, .65, 1.4, true);
      // peitorais (várias linhas paralelas)
      for (let k = 0; k < 6; k++) {
        const o = k * .016;
        linha(curva([s * .015, .74 + o * .5], [s * (.04 + o * .3), .93 - o * .4], [s * (.3 - o), .96 - o], [s * (.43 - o * .8), .8 + o * .3], 30), k % 3 ? LUZ : OURO, .62 - k * .07, 1.4 - k * .12, true);
      }
      // deltoides
      for (let k = 0; k < 5; k++) {
        const o = k * .018;
        linha(curva([s * (.38 + o * .2), .745 + o * .3], [s * (.55 + o * .3), .74 + o], [s * (.66 - o * .2), .9], [s * (.6 - o * .3), 1.08], 28), k ? LUZ : OURO, .55 - k * .08, 1.3 - k * .12, true);
      }
      // linhas de energia descendo
      for (let k = 0; k < (celular ? 5 : 8); k++) {
        linha(curva([s * rnd(0, .03), rnd(.66, .7)], [s * rnd(.05, .15), rnd(.75, .85)], [s * rnd(.1, .25), rnd(.9, 1.05)], [s * rnd(.05, .3), rnd(1.05, 1.3)], 26),
          Math.random() < .4 ? OURO : AZUL, rnd(.2, .45), rnd(.6, 1.1), true);
      }
      // abdômen
      for (let k = 0; k < 3; k++) linha(curva([s * .015, 1.0 + k * .07], [s * .06, .99 + k * .07], [s * .11, 1.0 + k * .07], [s * .13, 1.03 + k * .07], 12), LUZ, .3, 1, true);
    });
    linha(curva([0, .7], [0, .85], [0, 1.0], [0, 1.25], 20), LUZ, .4, 1.1, true);
    // contornos suaves do rosto
    for (let v = .07; v < B.queixo - .02; v += .028) {
      const hw = B.cabeca(v) * .92, pts = [];
      for (let i = 0; i <= 20; i++) { const u = -hw + 2 * hw * i / 20; pts.push([u, v + .01 * (1 - (u / hw) ** 2)]); }
      H.linhas.push({ pts, cor: ROXO, alfa: .1, larg: .8 });
    }
    H.amostrar(celular ? 1000 : 1800);
    brilhos = [];
    for (const l of H.linhas) for (const p of l.pts) if (Math.random() < .12) brilhos.push({ u: p[0], v: p[1], f: rnd(0, 6.28), vel: rnd(1, 4) });

    const [c, cg] = novaCamada();
    cg.fillStyle = 'rgba(8,3,18,.9)';
    H.caminhoCorpo(cg); cg.fill(); H.caminhoCabeca(cg); cg.fill();
    cg.globalCompositeOperation = 'lighter'; cg.lineCap = 'round';
    cg.shadowColor = '#8f3dff';
    for (const l of H.linhas) {
      cg.globalAlpha = l.alfa; cg.strokeStyle = l.cor; cg.lineWidth = l.larg; cg.shadowBlur = 8 * DPR;
      H.desenharLinha(cg, l.pts); cg.stroke();
    }
    cg.globalAlpha = 1;
    const contornos = [H.contornoCabeca(), H.contornoCorpo(-1), H.contornoCorpo(1)];
    for (const [larg, blur, cor] of [[6, 26, 'rgba(140,60,255,.35)'], [2.4, 14, 'rgba(220,190,255,.9)'], [1, 4, 'rgba(250,245,255,.9)']]) {
      cg.lineWidth = larg; cg.shadowBlur = blur * DPR; cg.strokeStyle = cor;
      for (const pts of contornos) { H.desenharLinha(cg, pts); cg.stroke(); }
    }
    cg.shadowBlur = 0;
    H.estatico = c;
  }

  function novoRaio() {
    const s = Math.random() < .5 ? -1 : 1;
    const v0 = rnd(.05, .9);
    const u0 = s * (v0 < B.queixo ? B.cabeca(v0) + .02 : B.corpo(v0));
    let pts = [[u0, v0], [u0 + s * rnd(.35, .9), v0 + rnd(-.35, .25)]];
    for (let nivel = 0; nivel < 6; nivel++) {
      const novo = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        novo.push([(a[0] + b[0]) / 2 + rnd(-.5, .5) * d * .35, (a[1] + b[1]) / 2 + rnd(-.5, .5) * d * .35], b);
      }
      pts = novo;
    }
    return { pts, vida: 0, dur: rnd(.12, .3) };
  }

  return {
    entrar() { H.t0 = tempo; if (!H.estatico) this.redim(); },
    redim() {
      H.layout(); gerarEstatico();
      fumacas = Array.from({ length: celular ? 6 : 9 }, (_, i) => ({ x: rnd(0, 1), y: rnd(.1, 1), r: rnd(.25, .55), f: rnd(0, 6), v: rnd(.05, .15), a: rnd(.08, .17), azul: i % 3 === 0 }));
    },
    desenhar(dt) {
      const tm = tempo - H.t0, t = tempo, n = P.nivel, S = H.S;
      const aparece = suave((tm - 2.1) / .8);
      const bg = g.createLinearGradient(0, 0, 0, A);
      bg.addColorStop(0, '#0e0522'); bg.addColorStop(1, '#04010b');
      g.fillStyle = bg; g.fillRect(0, 0, L, A);
      g.globalCompositeOperation = 'lighter';
      const M = Math.max(L, A);
      for (const f of fumacas) {
        const x = (f.x + Math.sin(t * f.v + f.f) * .08) * L, y = (f.y + Math.cos(t * f.v * .8 + f.f) * .06) * A;
        const gr = g.createRadialGradient(x, y, 0, x, y, f.r * M);
        const c = f.azul ? '60,70,220' : '110,45,220';
        gr.addColorStop(0, `rgba(${c},${f.a * (1 + n * .6)})`); gr.addColorStop(.6, `rgba(${c},${f.a * .3})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(x - f.r * M, y - f.r * M, f.r * M * 2, f.r * M * 2);
      }
      g.lineWidth = 1.1;
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = `rgba(200,180,255,${.1 + n * .15})`;
        g.beginPath();
        for (let x = -20; x <= L + 20; x += 12) {
          const y = A * (.16 + i * .17) + Math.sin(x * .0035 + t * .35 + i * 1.7) * A * .07 + Math.sin(x * .011 - t * .25 + i) * A * .02;
          x === -20 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      if (aparece > 0) {
        g.globalAlpha = aparece;
        g.drawImage(H.estatico, 0, 0, L, A);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = aparece * (.15 + n * .65 + .1 * Math.sin(t * 1.5));
        g.drawImage(H.estatico, 0, 0, L, A);
        anelHUD(H.X(0), H.Y(.29), S, t, n, aparece, '200,160,255');
        // olhos
        const olho = (.25 + n * .75 + (P.estado === 'pensando' ? .3 * Math.sin(t * 8) : 0)) * aparece;
        for (const s of [-1, 1]) {
          const ex = H.X(s * .075), ey = H.Y(.29);
          const go = g.createRadialGradient(ex, ey, 0, ex, ey, S * .05);
          go.addColorStop(0, `rgba(255,250,255,${lim(olho)})`); go.addColorStop(.3, `rgba(190,120,255,${lim(olho) * .6})`); go.addColorStop(1, 'rgba(150,80,255,0)');
          g.globalAlpha = 1; g.fillStyle = go; g.fillRect(ex - S * .05, ey - S * .05, S * .1, S * .1);
          g.fillStyle = `rgba(255,255,255,${lim(olho)})`; g.fillRect(ex - S * .022, ey - 1, S * .044, 2);
        }
        // núcleo de energia no peito
        const cx = H.X(0), cy = H.Y(.86);
        const r0 = S * (.035 + n * .02);
        const gc = g.createRadialGradient(cx, cy, 0, cx, cy, S * (.13 + n * .08));
        gc.addColorStop(0, `rgba(255,240,255,${(.5 + n * .5) * aparece})`); gc.addColorStop(.25, `rgba(180,110,255,${(.3 + n * .4) * aparece})`); gc.addColorStop(1, 'rgba(120,60,255,0)');
        g.globalAlpha = 1; g.fillStyle = gc; g.fillRect(cx - S * .25, cy - S * .25, S * .5, S * .5);
        g.strokeStyle = `rgba(230,210,255,${.6 * aparece})`; g.lineWidth = 1.2;
        for (let k = 0; k < 3; k++) {
          g.beginPath(); g.arc(cx, cy, r0 * (1.4 + k * .7), t * (k % 2 ? -1.2 : .9) + k, t * (k % 2 ? -1.2 : .9) + k + Math.PI * 1.3); g.stroke();
        }
        // brilhos nas linhas
        g.fillStyle = '#f6eeff';
        for (const b of brilhos) {
          const s = Math.sin(t * b.vel + b.f);
          if (s < .8 - n * .4) continue;
          g.globalAlpha = (s - .5) * 1.6 * aparece;
          g.fillRect(H.X(b.u) - 1, H.Y(b.v) - 1, 2, 2);
        }
        // raios
        if (n > .3 && Math.random() < dt * (2 + n * 10)) raios.push(novoRaio());
        if (P.estado === 'pensando' && Math.random() < dt * 1.5) raios.push(novoRaio());
        raios = raios.filter(r => (r.vida += dt) < r.dur);
        for (const r of raios) {
          const a = 1 - r.vida / r.dur;
          g.globalAlpha = a * .35; g.strokeStyle = '#9a5cff'; g.lineWidth = 5;
          H.desenharLinha(g, r.pts); g.stroke();
          g.globalAlpha = a; g.strokeStyle = '#f8f2ff'; g.lineWidth = 1.3; g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = .8 * aparece; g.fillStyle = 'rgb(215,190,255)';
        g.font = `${Math.max(9, Math.round(S * .015))}px ui-monospace, Consolas, monospace`;
        if (L >= 640) { g.textAlign = 'right'; g.fillText(textoStatus(), H.X(-.42), H.Y(.12)); g.textAlign = 'left'; }
        g.textAlign = 'left'; g.globalAlpha = 1;
      }
      H.montagem(tm, a => `rgba(180,120,255,${a})`);
    }
  };
})();

// ════════════════════════════════════════════════════════════════
//  MODO NÚCLEO — o "meu" Jarvis: reator de arco com anéis de HUD,
//  anel de onda sonora reativo à voz e leituras orbitando.
// ════════════════════════════════════════════════════════════════
const nucleo = (() => {
  const CI = '95,215,255', CI2 = '150,235,255', OU = '255,200,120', BR = '235,250,255';
  // anéis concêntricos girando
  const aneis = [
    { r: 1.00, vel: .06, seg: 0, larg: 1.2, a: .18 },
    { r: 0.92, vel: -.18, seg: 20, larg: 2.2, a: .5 },
    { r: 0.82, vel: .28, seg: 4, larg: 3, a: .6, arco: Math.PI * .42 },
    { r: 0.70, vel: -.12, seg: 60, larg: 1, a: .3 },
    { r: 0.58, vel: .5, seg: 3, larg: 2.4, a: .55, arco: Math.PI * .5 },
    { r: 0.30, vel: -.7, seg: 6, larg: 2, a: .5 }
  ];
  const orbes = Array.from({ length: 10 }, (_, i) => ({ r: .6 + Math.random() * .5, a0: Math.random() * 6.28, vel: (.15 + Math.random() * .4) * (i % 2 ? -1 : 1), tam: 1.2 + Math.random() * 1.8 }));
  const poeira = Array.from({ length: celular ? 50 : 100 }, () => ({ x: Math.random(), y: Math.random(), v: rnd(.002, .01), a: Math.random() * .4 }));
  const Nw = 120; // pontos do anel de onda
  const t0ref = { v: 0 };
  let leituras = [];
  function gerarLeituras() {
    const r = () => Math.floor(Math.random() * 10);
    leituras = Array.from({ length: 5 }, () => `0x${r()}${r()}${r()}${r()}·${r()}${r()}`);
  }
  gerarLeituras();

  function arco(cx, cy, raio, a0, a1, larg, cor, alfa) {
    g.globalAlpha = alfa; g.strokeStyle = `rgb(${cor})`; g.lineWidth = larg;
    g.beginPath(); g.arc(cx, cy, raio, a0, a1); g.stroke();
  }

  return {
    entrar() { t0ref.v = tempo; },
    redim() {},
    desenhar(dt) {
      const t = tempo, n = P.nivel, S = Math.min(L, A);
      const CX = L / 2, CY = A * (L < 640 ? .42 : .45);
      const R = S * (celular ? .32 : .28) * (1 + n * .05);
      if (Math.random() < dt * .6) gerarLeituras();
      // fundo
      const bg = g.createRadialGradient(CX, CY, 0, CX, CY, Math.max(L, A) * .7);
      bg.addColorStop(0, '#0a1a33'); bg.addColorStop(.5, '#060f20'); bg.addColorStop(1, '#02060d');
      g.fillStyle = bg; g.fillRect(0, 0, L, A);
      // poeira
      g.fillStyle = `rgb(${CI})`;
      for (const p of poeira) { p.y -= p.v * dt * 6; if (p.y < 0) { p.y = 1; p.x = Math.random(); } g.globalAlpha = p.a * (.4 + P.brilho * .4); g.fillRect(p.x * L, p.y * A, 1.1, 1.1); }
      g.globalCompositeOperation = 'lighter';
      // brilho central
      const forca = .5 + P.brilho * .3 + n * .5;
      let gl = g.createRadialGradient(CX, CY, 0, CX, CY, R * 1.3);
      gl.addColorStop(0, `rgba(${CI2},${.12 + n * .3})`); gl.addColorStop(1, `rgba(${CI},0)`);
      g.globalAlpha = 1; g.fillStyle = gl; g.fillRect(CX - R * 1.5, CY - R * 1.5, R * 3, R * 3);

      // anéis de HUD girando
      for (const an of aneis) {
        const ang = t * (an.vel + (P.estado === 'pensando' ? an.vel * 2 : 0)) + an.a0 * 0;
        const raio = R * an.r;
        if (!an.seg) { arco(CX, CY, raio, 0, Math.PI * 2, an.larg, CI, an.a * forca); continue; }
        if (an.arco) {
          for (let k = 0; k < an.seg; k++) {
            const a = ang + k * (Math.PI * 2 / an.seg);
            arco(CX, CY, raio, a, a + an.arco, an.larg, k % 2 ? OU : CI2, an.a * forca);
          }
        } else {
          g.globalAlpha = an.a * forca * .8; g.strokeStyle = `rgb(${CI})`; g.lineWidth = an.larg; g.beginPath();
          for (let k = 0; k < an.seg; k++) {
            const a = ang + k * (Math.PI * 2 / an.seg);
            const r1 = raio - an.larg * 2.5, r2 = raio + an.larg * 2.5;
            g.moveTo(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1); g.lineTo(CX + Math.cos(a) * r2, CY + Math.sin(a) * r2);
          }
          g.stroke();
        }
      }

      // anel de onda sonora reativo
      const Rw = R * 1.08;
      g.globalAlpha = .5 + n * .5; g.lineWidth = 2; g.strokeStyle = `rgb(${CI2})`;
      g.beginPath();
      for (let i = 0; i <= Nw; i++) {
        const a = i / Nw * Math.PI * 2;
        const w = (.02 + n * .22) * (Math.sin(a * 6 + t * 5) * .5 + Math.sin(a * 13 - t * 7) * .3 + Math.sin(a * 3 + t * 3) * .2);
        const rr = Rw * (1 + w);
        const x = CX + Math.cos(a) * rr, y = CY + Math.sin(a) * rr;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.stroke();
      // reflexo externo da onda
      g.globalAlpha = (.15 + n * .3); g.lineWidth = 6; g.stroke();

      // orbes
      for (const o of orbes) {
        const a = o.a0 + t * o.vel, rr = R * o.r;
        const x = CX + Math.cos(a) * rr, y = CY + Math.sin(a) * rr;
        g.globalAlpha = .7; g.fillStyle = `rgb(${BR})`;
        g.fillRect(x - o.tam / 2, y - o.tam / 2, o.tam, o.tam);
        g.globalAlpha = .15; g.fillRect(x - o.tam * 1.5, y - o.tam * 1.5, o.tam * 3, o.tam * 3);
      }

      // REATOR central (triângulo de arco)
      const rc = R * .26;
      g.lineWidth = 2.4; g.globalAlpha = .9; g.strokeStyle = `rgb(${CI2})`;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + k * (Math.PI * 2 / 3) + t * .2;
        const a2 = a + Math.PI * 2 / 3;
        g.beginPath();
        g.arc(CX, CY, rc, a + .18, a2 - .18); g.stroke();
        // bobinas (raios internos)
        g.globalAlpha = .5;
        const mx = CX + Math.cos((a + a2) / 2) * rc, my = CY + Math.sin((a + a2) / 2) * rc;
        g.beginPath(); g.moveTo(CX, CY); g.lineTo(mx, my); g.stroke();
        g.globalAlpha = .9;
      }
      // núcleo branco
      const pulso = 1 + n * .4 + .06 * Math.sin(t * 3);
      const nc = g.createRadialGradient(CX, CY, 0, CX, CY, rc * .85 * pulso);
      nc.addColorStop(0, `rgba(255,255,255,${.95 * forca})`);
      nc.addColorStop(.4, `rgba(${CI2},${.7 * forca})`);
      nc.addColorStop(1, `rgba(${CI},0)`);
      g.globalAlpha = 1; g.fillStyle = nc; g.fillRect(CX - rc, CY - rc, rc * 2, rc * 2);
      g.fillStyle = `rgba(255,255,255,${forca})`;
      g.beginPath(); g.arc(CX, CY, rc * .34 * pulso, 0, Math.PI * 2); g.fill();

      g.globalCompositeOperation = 'source-over';
      // leituras de dados
      g.globalAlpha = .7; g.fillStyle = `rgb(${CI})`;
      g.font = `${Math.max(9, Math.round(S * .015))}px ui-monospace, Consolas, monospace`;
      const et = { espera: 'STANDBY', ouvindo: 'OUVINDO', pensando: 'PROCESSANDO', falando: 'FALANDO' }[P.estado] || 'STANDBY';
      g.textAlign = 'left'; g.fillText(`REATOR · ${et}`, CX - R, CY - R - S * .03);
      g.textAlign = 'right'; g.fillText(`NÚCLEO ${Math.round((.4 + n * .6) * 100)}%`, CX + R, CY - R - S * .03);
      if (L >= 640) { g.globalAlpha = .4; g.textAlign = 'left'; leituras.forEach((l, i) => g.fillText(l, CX + R + S * .01, CY - R * .3 + i * S * .022)); }
      g.textAlign = 'left'; g.globalAlpha = 1;
    }
  };
})();

// ════════════════════════════════════════════════════════════════
//  MODO VISÃO — câmera do aparelho com HUD de scanner (cosmético)
//  NÃO reconhece pessoas, não mostra nome/endereço, não marca "ameaça".
//  É só um efeito visual sobre a imagem da sua câmera.
// ════════════════════════════════════════════════════════════════
const camera = (() => {
  let video = null, stream = null, estadoCam = 'parado', erro = '', t0 = 0, usandoTras = true;
  function criarVideo() {
    if (video) return;
    video = document.createElement('video');
    video.setAttribute('playsinline', ''); video.muted = true; video.autoplay = true;
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px;';
    document.body.appendChild(video);
  }
  async function abrir() {
    criarVideo();
    estadoCam = 'abrindo'; erro = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: usandoTras ? { ideal: 'environment' } : 'user' }, audio: false });
      video.srcObject = stream; await video.play().catch(() => {});
      estadoCam = 'ligado';
    } catch (e) {
      estadoCam = 'erro';
      erro = e.name === 'NotAllowedError' ? 'permita o uso da câmera' : e.name === 'NotFoundError' ? 'nenhuma câmera encontrada' : 'câmera indisponível';
    }
  }
  function fechar() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) video.srcObject = null;
    estadoCam = 'parado';
  }
  return {
    alternarCamera() { usandoTras = !usandoTras; if (estadoCam === 'ligado' || estadoCam === 'abrindo') { fechar(); abrir(); } },
    entrar() { t0 = tempo; abrir(); },
    sair() { fechar(); },
    redim() {},
    desenhar(dt) {
      const t = tempo, n = P.nivel, S = Math.min(L, A);
      g.fillStyle = '#04070e'; g.fillRect(0, 0, L, A);
      // imagem da câmera (cobre a tela)
      if (estadoCam === 'ligado' && video && video.videoWidth) {
        const vw = video.videoWidth, vh = video.videoHeight;
        const escala = Math.max(L / vw, A / vh), dw = vw * escala, dh = vh * escala;
        g.save();
        if (!usandoTras) { g.translate(L, 0); g.scale(-1, 1); } // espelha a câmera frontal
        g.globalAlpha = 1; g.drawImage(video, (L - dw) / 2, (A - dh) / 2, dw, dh);
        g.restore();
        // leve tom ciano por cima
        g.fillStyle = `rgba(20,60,90,${.18 + .12 * Math.sin(t * .5)})`; g.fillRect(0, 0, L, A);
      }
      const CX = L / 2, CY = A * .45;
      g.globalCompositeOperation = 'lighter';
      // linha de varredura descendo
      const sy = (t * .22 % 1) * A;
      const lg = g.createLinearGradient(0, sy - 40, 0, sy + 40);
      lg.addColorStop(0, 'rgba(95,230,255,0)'); lg.addColorStop(.5, `rgba(95,230,255,${.25 + n * .3})`); lg.addColorStop(1, 'rgba(95,230,255,0)');
      g.fillStyle = lg; g.fillRect(0, sy - 40, L, 80);
      // grade sutil
      g.strokeStyle = 'rgba(95,230,255,.06)'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x <= L; x += S * .1) { g.moveTo(x, 0); g.lineTo(x, A); }
      for (let y = 0; y <= A; y += S * .1) { g.moveTo(0, y); g.lineTo(L, y); }
      g.stroke();
      // cantos (brackets)
      const m = S * .08, bl = S * .05;
      g.strokeStyle = `rgba(95,230,255,${.6 + n * .3})`; g.lineWidth = 2;
      for (const [sx, sgy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const x = sx > 0 ? m : L - m, y = sgy > 0 ? m + (L < 640 ? 70 : 0) : A - m - (L < 640 ? 90 : 0);
        g.beginPath();
        g.moveTo(x + sx * bl, y); g.lineTo(x, y); g.lineTo(x, y + sgy * bl); g.stroke();
      }
      // retículo central + anéis de HUD
      anelHUD(CX, CY, S * .78, t, n, 1, '95,230,255');
      g.strokeStyle = `rgba(95,230,255,${.5 + n * .4})`; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(CX - S * .04, CY); g.lineTo(CX + S * .04, CY);
      g.moveTo(CX, CY - S * .04); g.lineTo(CX, CY + S * .04); g.stroke();
      g.globalCompositeOperation = 'source-over';
      // textos de HUD
      g.fillStyle = 'rgb(95,230,255)';
      g.font = `${Math.max(10, Math.round(S * .018))}px ui-monospace, Consolas, monospace`;
      g.textAlign = 'left';
      const et = { espera: 'VISÃO ATIVA', ouvindo: 'OUVINDO', pensando: 'ANALISANDO AMBIENTE', falando: 'FALANDO' }[P.estado] || 'VISÃO';
      g.fillText(et + '   ·   SCANNER ÓPTICO', m, A < 700 ? A - m - 60 : A - m);
      if (estadoCam !== 'ligado') {
        g.textAlign = 'center';
        g.font = `${Math.max(13, Math.round(S * .028))}px 'Rajdhani', sans-serif`;
        g.fillStyle = estadoCam === 'erro' ? '#ff9a9a' : 'rgba(95,230,255,.85)';
        g.fillText(estadoCam === 'erro' ? erro.toUpperCase() : 'INICIANDO CÂMERA…', CX, CY + S * .18);
        g.textAlign = 'left';
      }
    }
  };
})();

const MODOS = { nucleo, holograma, tempestade, esfera, camera };
const CICLO = ['nucleo', 'holograma', 'tempestade', 'esfera'];
const sujos = new Set();

function redimensionar() {
  DPR = Math.min(window.devicePixelRatio || 1, celular ? 1.5 : 2);
  L = innerWidth; A = innerHeight;
  tela.width = L * DPR; tela.height = A * DPR;
  for (const k in MODOS) sujos.add(k);
  if (modo) { modo.redim(); sujos.delete(nomeModo); }
}

function quadro(agora) {
  const dt = Math.min(.05, (agora - ultimo) / 1000); ultimo = agora;
  tempo += dt;
  for (const k in alvo) P[k] += (alvo[k] - P[k]) * Math.min(1, dt * 3);
  const n = lerNivel();
  P.nivel += (n - P.nivel) * Math.min(1, dt * (n > P.nivel ? 18 : 6));
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  try { modo && modo.desenhar(dt); } catch (e) { console.error(e); }
  requestAnimationFrame(quadro);
}

window.Visual = {
  modos: CICLO,
  iniciar(canvas, fnNivel) {
    tela = canvas; g = canvas.getContext('2d'); lerNivel = fnNivel || lerNivel;
    redimensionar();
    let espera; addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(redimensionar, 150); });
    requestAnimationFrame(quadro);
  },
  estado(e) { P.estado = e; Object.assign(alvo, TABELA[e] || TABELA.espera); },
  modo(nome) {
    if (!MODOS[nome]) nome = 'holograma';
    if (modo && modo !== MODOS[nome] && modo.sair) modo.sair();
    nomeModo = nome; modo = MODOS[nome];
    if (sujos.has(nome)) { modo.redim(); sujos.delete(nome); }
    modo.entrar();
    document.body.dataset.modo = nome === 'camera' ? 'holograma' : nome;
    return nome;
  },
  alternarCamera() { if (nomeModo === 'camera') camera.alternarCamera(); },
  atual: () => nomeModo
};
})();
