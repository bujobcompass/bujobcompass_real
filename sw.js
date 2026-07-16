/* 부업 나침반 — 서비스워커
   지금 하는 일: 앱 기본 화면(HTML)을 캐시해서 오프라인이거나 네트워크가 느릴 때도 켜지게 함.
   ⚠️ 푸시 알림(다음 날 Day 열림 알림 등)은 여기 없음 — 그건 서버(푸시 발송 백엔드)가 있어야
   가능한 별도 기능이라, 나중에 서버 붙일 때 추가해야 함. */

const CACHE_NAME = 'bujob-compass-v1';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      /* 일부 파일 경로가 배포 구조와 다르면 실패할 수 있음 — 무시하고 계속 진행 */
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 네트워크 우선, 실패하면 캐시로 (콘텐츠는 최신 유지, 오프라인일 때만 캐시 사용)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});

/* 매일 아침 8시(KST) 서버(/api/send-daily)가 보내는 푸시를 실제 알림으로 표시.
   payload는 /api/send-daily.js에서 { title, body, url } 형태의 JSON으로 보냄. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* 무시 */ }
  const title = data.title || '부업 나침반';
  const options = {
    body: data.body || '오늘의 챌린지를 확인해보세요',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './index.html' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림을 탭하면 이미 열려있는 탭이 있으면 포커스, 없으면 새로 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes('index.html') && 'focus' in c);
      if (existing) return existing.focus();
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
