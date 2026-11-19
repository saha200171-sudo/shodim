// Сервис-воркер: кэширует оболочку приложения, чтобы оно быстро открывалось.
// Данные и фото всегда берутся из сети (Supabase).
const VERSION = 'shodim-v34';
const SHELL = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/room.js', 'js/config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/fonts.css', 'fonts/caveat-cyrillic-0.woff2', 'fonts/caveat-latin-1.woff2', 'fonts/lora-cyrillic-2.woff2', 'fonts/lora-latin-3.woff2', 'fonts/nunito-cyrillic-4.woff2', 'fonts/nunito-latin-5.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Своё приложение: сначала сеть мимо HTTP-кэша (GitHub Pages кэширует на 10 минут),
  // чтобы обновления приходили сразу; без сети — кэш
  if (u.origin === location.origin) {
    const isPage = e.request.mode === 'navigate';
    e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
      // в кэш кладём только целые, правильные ответы — «сломанная» загрузка не должна запомниться
      const okType = isPage || !/text\/html/.test(r.headers.get('content-type') || '');
      if (r.ok && okType) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || (isPage ? caches.match('index.html') : Response.error()))));
    return;
  }
  // Шрифты и библиотека Supabase с CDN: кэш, потом сеть
  if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(u.host)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    })));
  }
});
