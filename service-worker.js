// Muhasaba service-worker (relative paths for GitHub Pages)
const CACHE_NAME = 'muhasaba-v3'; // <- زِد الرقم هنا كلما عدّلت لتفريغ الكاش القديم
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './offline.html',
  './service-worker.js',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

self.addEventListener('install', evt => {
  // فور التثبيت نتخطى الانتظار ونخزّن كافة الملفات
  self.skipWaiting();
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener('activate', evt => {
  // نحذف الكاشات القديمة فور التفعيل
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  // استقبال رسالة من الصفحة لإجبار التحديث (optional)
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', evt => {
  const req = evt.request;

  // لو كانت محاولة تنقّل (navigation) أو طلب صفحة HTML -> network-first مع fallback للكاش/offline
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    evt.respondWith(
      fetch(req).then(networkResponse => {
        // خزّن نسخة في الكاش للطلبات المستقبلية
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return networkResponse;
      }).catch(() => {
        // لو لم يتوفر الإنترنت استخدم index.html أو offline.html
        return caches.match('./index.html').then(r => r || caches.match('./offline.html'));
      })
    );
    return;
  }

  // لباقي الموارد: cache-first ثم network ثم fallback
  evt.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkResponse => {
        // خزّن نسخة من المورد إن أمكن
        caches.open(CACHE_NAME).then(cache => {
          try { cache.put(req, networkResponse.clone()); } catch(e) { /* ignore */ }
        });
        return networkResponse;
      }).catch(() => {
        // لو مورد صورة، أعد استجابة فارغة أو غيرها
        if (req.destination === 'image') {
          return new Response('', { status: 404 });
        }
        return new Response('', { status: 503, statusText: 'offline' });
      });
    })
  );
});
