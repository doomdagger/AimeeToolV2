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

// 获取直播间ID
function getRoomId() {
  const url = window.location.href;
  const match = url.match(/\/room\/(\d+)/);
  return match ? match[1] : null;
}

// 构建API URL
function fetchProductList() {
  try {
    const roomId = getRoomId();
    if (!roomId) {
      throw new Error('无法获取直播间ID');
    }

    const apiUrl = `https://compass.jinritemai.com/compass_api/content_live/author/live_screen/product_list_after_live?index_selected=product_click_ucnt%2Cproduct_click_pay_ucnt_ratio%2Cproduct_show_ucnt%2Cproduct_show_click_ucnt_ratio%2Cgpm%2Cpay_combo_cnt&data_range=0&room_id=${roomId}`;

    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('API请求失败');
        }
        return response.json();
      })
      .then(data => {
        console.log(data);
      })
      .catch(error => {
        console.error('获取商品列表失败:', error);
      });
  } catch (error) {
    console.error('获取商品列表失败:', error);
  }
}
