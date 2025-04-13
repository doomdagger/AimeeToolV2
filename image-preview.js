// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 获取图片预览容器
  const overlay = document.querySelector('.image-preview-overlay');
  const image = overlay.querySelector('.image-preview');

  // 监听鼠标事件
  document.addEventListener('mouseover', function(e) {
    const target = e.target;
    if (target.tagName === 'IMG' && 
        (target.closest('.product-cell') || target.classList.contains('product-image'))) {
      const src = target.getAttribute('src');
      image.src = src;
      overlay.style.display = 'block';
      setTimeout(() => overlay.style.opacity = 1, 10);
    }
  }, true);

  document.addEventListener('mouseout', function(e) {
    const target = e.target;
    if (target.tagName === 'IMG' && 
        (target.closest('.product-cell') || target.classList.contains('product-image'))) {
      overlay.style.opacity = 0;
      setTimeout(() => overlay.style.display = 'none', 200);
    }
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (overlay.style.display === 'block') {
      // 计算图片预览的位置
      const x = e.pageX + 15;
      const y = e.pageY + 15;
      
      // 计算图片预览的宽度和高度
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const imgWidth = image.offsetWidth;
      const imgHeight = image.offsetHeight;
      
      let posX = x;
      let posY = y;
      
      if (x + imgWidth + 20 > viewportWidth) {
        posX = x - imgWidth - 30; // 鼠标在右侧时，图片预览显示在左侧
      }
      
      if (y + imgHeight + 20 > viewportHeight) {
        posY = viewportHeight - imgHeight - 20; // 图片预览超出底部时，显示在上方
      }
      
      overlay.style.left = posX + 'px';
      overlay.style.top = posY + 'px';
    }
  });
});
