document.addEventListener('DOMContentLoaded', function() {
  // 获取当前标签页的URL，检查是否包含直播ID
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const liveRoomId = currentTab.url.match(/live_room_id=([^&]+)/)?.[1];
    
    if (!liveRoomId) {
      // 如果没有直播ID，显示错误信息
      document.body.innerHTML = `
        <div style="padding: 20px; color: #f5222d;">
          <h4>错误</h4>
          <p>请打开一个包含直播ID的页面后再使用此插件</p>
        </div>
      `;
      return;
    }
    
    // 将直播ID存储到本地存储中
    chrome.storage.local.set({ currentLiveRoomId: liveRoomId });
    
    // 设置菜单项点击事件
    document.getElementById('productAnalysis').addEventListener('click', function() {
      // 打开商品分析和订单列表页面
      chrome.tabs.create({ url: 'index.html' });
    });
    
    document.getElementById('productReview').addEventListener('click', function() {
      // 打开商品回顾页面
      chrome.tabs.create({ url: 'product-review.html' });
    });
  });
});
