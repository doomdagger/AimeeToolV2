function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Aimee Tool Compass',
    message: message
  });
}

chrome.action.onClicked.addListener((tab) => {
  // 直接检查 URL 中是否包含 live_room_id=
  const liveRoomId = tab.url.match(/live_room_id=([^&]+)/)?.[1];
  
  if (liveRoomId) {
    // 将 live_room_id 存储到 storage 中
    chrome.storage.local.set({ currentLiveRoomId: liveRoomId }, () => {
      // 打开新标签页显示数据
      chrome.tabs.create({ url: 'index.html' });
    });
  } else {
    // 使用 chrome.tabs.create 显示错误信息
    chrome.tabs.create({ 
      url: 'index.html?error=请打开一个包含直播ID的页面后再使用此插件'
    });
  }
});

// 注册Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(registration => {
        console.log('Service Worker registered successfully:', registration);
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
      });
  });
}
