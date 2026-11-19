// Сервис-воркер: кэширует оболочку приложения, чтобы оно быстро открывалось.
// Данные и фото всегда берутся из сети (Supabase).
const VERSION = 'shodim-v19';
const SHELL = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

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
    e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
      const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
    return;
  }
  // Шрифты и библиотека Supabase с CDN: кэш, потом сеть
  if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(u.host)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res;
    })));
  }
});
