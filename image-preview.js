// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 获取图片预览容器
  const overlay = document.querySelector('.image-preview-overlay');
  const image = overlay.querySelector('.image-preview');
  let hideTimeout = null;
  let currentTarget = null;

  // 检查是否是预览目标
  function isPreviewTarget(element) {
    return element.tagName === 'IMG' && 
           (element.closest('.product-cell') || element.closest('.image-container'));
  }

  // 显示预览
  function showPreview(target) {
    // 清除任何待执行的隐藏操作
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    const src = target.getAttribute('src');
    if (currentTarget !== target) {
      image.src = src;
      currentTarget = target;
      
      if (overlay.style.display !== 'block') {
        overlay.style.display = 'block';
      }
      overlay.style.opacity = 1;
    } else if (overlay.style.opacity !== '1') {
      // 如果是同一个目标但预览被隐藏了，重新显示
      overlay.style.display = 'block';
      overlay.style.opacity = 1;
    }
  }

  // 隐藏预览
  function hidePreview() {
    overlay.style.opacity = 0;
    hideTimeout = setTimeout(() => {
      if (overlay.style.opacity === '0') {
        overlay.style.display = 'none';
        currentTarget = null;
      }
    }, 200);
  }

  // 监听鼠标事件
  document.addEventListener('mouseover', function(e) {
    const target = e.target;
    if (isPreviewTarget(target)) {
      showPreview(target);
    }
  }, true);

  document.addEventListener('mouseout', function(e) {
    const target = e.target;
    if (isPreviewTarget(target)) {
      const relatedTarget = e.relatedTarget;
      // 检查鼠标是否移动到了另一个预览目标上
      if (!relatedTarget || !isPreviewTarget(relatedTarget)) {
        hidePreview();
      }
    }
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (overlay.style.display === 'block') {
      const previewWidth = 300;  // 预览图宽度
      const previewHeight = 300; // 预览图高度
      const gap = 20;           // 预览图与鼠标的间距

      // 计算视口尺寸
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 计算预览图位置
      let posX = e.clientX + gap;
      let posY = e.clientY + gap;

      // 如果预览图会超出右边界，显示在鼠标左侧
      if (posX + previewWidth > viewportWidth) {
        posX = e.clientX - previewWidth - gap;
      }

      // 如果预览图会超出下边界，显示在鼠标上方
      if (posY + previewHeight > viewportHeight) {
        posY = e.clientY - previewHeight - gap;
      }

      // 设置预览图尺寸和位置（使用 fixed 定位，相对于视口）
      overlay.style.position = 'fixed';
      overlay.style.width = `${previewWidth}px`;
      overlay.style.height = `${previewHeight}px`;
      overlay.style.left = `${posX}px`;
      overlay.style.top = `${posY}px`;
    }
  });
});
