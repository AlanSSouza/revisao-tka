// Service Worker: guarda o app inteiro no aparelho para abrir sem sinal.
const VERSAO = 'v1';
const CACHE = 'revisao-tka-' + VERSAO;
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/ui.js', 'js/db.js', 'js/modelo.js', 'js/api.js', 'js/sync.js', 'js/midia.js', 'js/config.js', 'js/rascunho.js',
  'js/telas/entrada.js', 'js/telas/hoje.js', 'js/telas/planejar.js', 'js/telas/parque.js',
  'js/telas/equipamento.js', 'js/telas/visita.js', 'js/telas/ocorrencia.js', 'js/telas/treinamento.js', 'js/telas/comum.js',
  'js/relatorio.js', 'js/graficos.js', 'js/pdf.js', 'js/telas/relatorios.js', 'js/telas/relatorio-placa.js', 'vendor/jspdf.umd.min.js',
  'assets/logo.png', 'assets/gptw.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
  'assets/fonts/barlow-latin-400-normal.woff2', 'assets/fonts/barlow-latin-500-normal.woff2',
  'assets/fonts/barlow-latin-600-normal.woff2', 'assets/fonts/barlow-latin-700-normal.woff2',
  'assets/fonts/barlow-condensed-latin-600-normal.woff2', 'assets/fonts/barlow-condensed-latin-700-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('revisao-tka-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'pular') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req).catch(() =>
      req.mode === 'navigate' ? caches.match('index.html') : Response.error())),
  );
});
