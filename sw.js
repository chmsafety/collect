/* 취합관리 시스템 — 서비스 워커
 * ------------------------------------------------------------------
 * 앱 껍데기(화면·아이콘)만 캐시합니다. 자료와 제출 현황은
 * Apps Script 로 그때그때 물어보므로 캐시하지 않습니다 —
 * 오래된 제출 현황을 보여주는 것이 안 보여주는 것보다 위험합니다.
 *
 * 파일을 바꿀 때마다 VERSION 을 올려야 설치된 기기가 새로 받습니다.
 * ------------------------------------------------------------------ */

var VERSION = 'collect-2026-09-02c';
var SHELL   = VERSION + '-shell';

/* 앱 껍데기 — 하나가 없어도 나머지는 캐시되도록 개별로 넣습니다 */
var SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon.ico'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      return Promise.allSettled(SHELL_FILES.map(function (u) {
        return fetch(u, { cache: 'reload' }).then(function (r) {
          if (r && r.ok) return c.put(u, r);
        });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('collect-') === 0 && k !== SHELL) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/** 새 버전을 지금 적용 — 화면의 [새로고침] 버튼이 보냅니다 */
self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                    // 업로드·발송은 그대로 통과

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  // Apps Script(서버)는 절대 캐시하지 않습니다 — 항상 최신이어야 합니다
  if (url.hostname.indexOf('script.google.com') >= 0 ||
      url.hostname.indexOf('googleusercontent.com') >= 0 ||
      url.hostname.indexOf('drive.google.com') >= 0) return;

  if (url.origin !== self.location.origin) return;     // 그 외 외부 자원도 건드리지 않음

  // 화면 이동: 네트워크 먼저, 안 되면 캐시된 화면으로
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(SHELL).then(function (c) { c.put('./index.html', copy); });
        return r;
      }).catch(function () {
        return caches.match('./index.html').then(function (m) {
          return m || caches.match('./') || new Response(
            '<meta charset="utf-8"><h3>오프라인입니다</h3><p>인터넷에 연결한 뒤 다시 열어 주세요.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        });
      })
    );
    return;
  }

  // 아이콘·매니페스트: 캐시 먼저, 없으면 받아서 캐시
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) {
        if (r && r.ok && r.type === 'basic') {
          var copy = r.clone();
          caches.open(SHELL).then(function (c) { c.put(req, copy); });
        }
        return r;
      }).catch(function () { return hit; });
    })
  );
});
