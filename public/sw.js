
// Service worker do J.A.R.V.I.S. — deixa o app abrir rápido no celular,
// mesmo enquanto o servidor da nuvem acorda. NUNCA guarda respostas de /api.
const CACHE = 'jarvis-v9';
const SHELL = [
  './', 'cerebro.html', 'visuais.js', 'casa.html',
  'icone-192.png', 'icone-512.png', 'icone-maskable.png', 'apple-touch-icon.png',
  'manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // dados ao vivo e outras origens: sempre pela rede, sem cache
  if (url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // app: responde do cache e atualiza por trás (stale-while-revalidate)
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cacheado = await cache.match(req, { ignoreSearch: true });
      const rede = fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') cache.put(req, resp.clone());
        return resp;
      }).catch(() => cacheado);
      return cacheado || rede;
    })
  );
});
