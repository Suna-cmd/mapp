// オフライン用の Service Worker。
//
// アセットのパスはすべて './' 相対にしてある。GitHub Pages では
// https://<user>.github.io/<repo>/ 配下に置かれるため、'/js/app.js' のような
// 絶対パスにすると本番だけ 404 になる。

// アプリを更新したらこの版数を上げる。古いキャッシュは activate 時に消える。
const VERSION = 'v1';
const CACHE = `habit-tracker-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/habits.js',
  './js/dates.js',
  './js/ui.js',
  './js/views/today.js',
  './js/views/calendar.js',
  './js/views/stats.js',
  './js/views/settings.js',
  './js/views/editor.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // 1つでも失敗すると addAll ごと落ちるので、個別に入れて欠けを許容する
      Promise.all(
        ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] キャッシュできませんでした:', url, err);
          }),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// 更新トーストの「更新」から呼ばれる
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 別オリジンへのリクエストには手を出さない
  if (url.origin !== self.location.origin) return;

  // ページ遷移はネットワーク優先。落ちたらキャッシュ済みの index.html を返す。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) ?? (await cache.match('./')) ?? Response.error();
      }),
    );
    return;
  }

  // それ以外は stale-while-revalidate:
  // キャッシュを即返しつつ、裏で最新を取ってきて次回に備える。
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      return cached ?? (await network) ?? Response.error();
    })(),
  );
});
