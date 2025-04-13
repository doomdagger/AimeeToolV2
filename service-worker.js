// service-worker.js
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
});

self.addEventListener('fetch', (event) => {
  // 处理跨域请求
  if (event.request.url.includes('compass.jinritemai.com')) {
    event.respondWith(
      fetch(event.request, {
        mode: 'cors',
        credentials: 'include'
      })
    );
  }
});
