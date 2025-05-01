document.addEventListener('DOMContentLoaded', function() {
  // 初始化页面
  initializePage();

  // 绑定筛选按钮事件
  document.getElementById('applyFilters').addEventListener('click', function() {
    loadProductReviewData();
  });

  document.getElementById('resetFilters').addEventListener('click', function() {
    document.getElementById('timeRangeFilter').value = '30';
    document.getElementById('productTypeFilter').value = 'all';
    document.getElementById('sortFilter').value = 'sales';
    
    loadProductReviewData();
  });
});

// 初始化页面
function initializePage() {
  // 加载商品回顾数据
  loadProductReviewData();
}

// 加载商品回顾数据
function loadProductReviewData() {
  // 获取筛选条件
  const timeRange = document.getElementById('timeRangeFilter').value;
  const productType = document.getElementById('productTypeFilter').value;
  const sortBy = document.getElementById('sortFilter').value;
  
  // 在实际应用中，这里应该调用API获取数据
  // 目前使用模拟数据进行演示
  
  // 显示加载状态
  showLoadingState();
  
  // 模拟API请求延迟
  setTimeout(() => {
    // 生成模拟数据
    const mockData = generateMockData(timeRange, productType, sortBy);
    
    // 更新页面数据
    updatePageData(mockData);
    
    // 隐藏加载状态
    hideLoadingState();
  }, 1000);
}

// 显示加载状态
function showLoadingState() {
  document.querySelectorAll('.loading-spinner').forEach(spinner => {
    spinner.style.display = 'flex';
  });
}

// 隐藏加载状态
function hideLoadingState() {
  document.querySelectorAll('.loading-spinner').forEach(spinner => {
    spinner.style.display = 'none';
  });
}

// 生成模拟数据
function generateMockData(timeRange, productType, sortBy) {
  // 基础销售数据
  const baseSales = 100000;
  const baseOrders = 500;
  const baseConversion = 5;
  const baseGPM = 20;
  
  // 根据时间范围调整数据量
  const timeMultiplier = parseInt(timeRange) / 30;
  
  // 生成商品数据
  const products = [];
  const productCount = 20;
  
  for (let i = 1; i <= productCount; i++) {
    const isHot = i <= 5;
    const isPotential = i > 5 && i <= 10;
    
    // 根据商品类型筛选
    if (productType === 'hot' && !isHot) continue;
    if (productType === 'potential' && !isPotential) continue;
    
    const price = Math.floor(Math.random() * 500) + 100;
    const sales = Math.floor(Math.random() * 100) + 10;
    const conversion = Math.floor(Math.random() * 10) + 1;
    const gpm = Math.floor(Math.random() * 30) + 5;
    
    products.push({
      id: i,
      image: `https://picsum.photos/id/${i + 100}/200/200`,
      title: `测试商品 ${i} - 高品质多功能家居用品`,
      price: price,
      salesAmount: price * sales,
      salesCount: sales,
      conversion: conversion,
      gpm: gpm,
      trend: Math.random() > 0.5 ? 'up' : 'down',
      isHot: isHot,
      isPotential: isPotential
    });
  }
  
  // 根据排序方式排序
  if (sortBy === 'sales') {
    products.sort((a, b) => b.salesAmount - a.salesAmount);
  } else if (sortBy === 'conversion') {
    products.sort((a, b) => b.conversion - a.conversion);
  } else if (sortBy === 'gpm') {
    products.sort((a, b) => b.gpm - a.gpm);
  }
  
  // 生成销售趋势数据
  const salesTrend = [];
  const days = parseInt(timeRange);
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));
    
    salesTrend.push({
      date: date.toISOString().split('T')[0],
      sales: Math.floor(Math.random() * 10000) + 5000,
      orders: Math.floor(Math.random() * 50) + 20
    });
  }
  
  return {
    summary: {
      totalSales: baseSales * timeMultiplier,
      totalOrders: baseOrders * timeMultiplier,
      avgConversion: baseConversion,
      avgGPM: baseGPM,
      salesTrend: 5,
      ordersTrend: 3,
      conversionTrend: -1,
      gpmTrend: 2
    },
    products: products,
    salesTrend: salesTrend
  };
}

// 更新页面数据
function updatePageData(data) {
  // 更新概览卡片
  document.getElementById('totalSales').textContent = `¥${formatNumber(data.summary.totalSales)}`;
  document.getElementById('totalOrders').textContent = formatNumber(data.summary.totalOrders);
  document.getElementById('avgConversion').textContent = `${data.summary.avgConversion}%`;
  document.getElementById('avgGPM').textContent = `¥${data.summary.avgGPM.toFixed(2)}`;
  
  document.getElementById('salesTrend').textContent = `较上期 ${formatTrend(data.summary.salesTrend)}`;
  document.getElementById('ordersTrend').textContent = `较上期 ${formatTrend(data.summary.ordersTrend)}`;
  document.getElementById('conversionTrend').textContent = `较上期 ${formatTrend(data.summary.conversionTrend)}`;
  document.getElementById('gpmTrend').textContent = `较上期 ${formatTrend(data.summary.gpmTrend)}`;
  
  // 设置趋势颜色
  setTrendColor('salesTrend', data.summary.salesTrend);
  setTrendColor('ordersTrend', data.summary.ordersTrend);
  setTrendColor('conversionTrend', data.summary.conversionTrend);
  setTrendColor('gpmTrend', data.summary.gpmTrend);
  
  // 更新销售趋势图表
  updateSalesChart(data.salesTrend);
  
  // 更新商品表格
  updateProductTable(data.products);
}

// 设置趋势颜色
function setTrendColor(elementId, trend) {
  const element = document.getElementById(elementId);
  if (trend > 0) {
    element.classList.add('text-success');
    element.classList.remove('text-danger');
  } else if (trend < 0) {
    element.classList.add('text-danger');
    element.classList.remove('text-success');
  } else {
    element.classList.remove('text-success');
    element.classList.remove('text-danger');
  }
}

// 格式化趋势
function formatTrend(trend) {
  if (trend > 0) {
    return `+${trend}%`;
  } else {
    return `${trend}%`;
  }
}

// 格式化数字
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 更新销售趋势图表
function updateSalesChart(salesTrend) {
  const chartContainer = document.getElementById('salesChart');
  chartContainer.innerHTML = '<canvas id="salesChartCanvas"></canvas>';
  
  const ctx = document.getElementById('salesChartCanvas').getContext('2d');
  
  const dates = salesTrend.map(item => item.date);
  const sales = salesTrend.map(item => item.sales);
  const orders = salesTrend.map(item => item.orders);
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: '销售额',
          data: sales,
          borderColor: '#1890ff',
          backgroundColor: 'rgba(24, 144, 255, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: '订单数',
          data: orders,
          borderColor: '#52c41a',
          backgroundColor: 'rgba(82, 196, 26, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '销售额 (¥)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          title: {
            display: true,
            text: '订单数'
          }
        }
      }
    }
  });
}

// 更新商品表格
function updateProductTable(products) {
  // 销毁现有的 DataTable 实例（如果存在）
  if ($.fn.DataTable.isDataTable('#productReviewTable')) {
    $('#productReviewTable').DataTable().destroy();
  }
  
  // 初始化表格
  $('#productReviewTable').DataTable({
    data: products,
    pageLength: 10,
    dom: "<'row table-header-row'<'col-sm-12 col-md-4'l><'col-sm-12 col-md-4'p><'col-sm-12 col-md-4'f>>" +
         "<'row'<'col-sm-12'tr>>" +
         "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
    language: {
      url: '//cdn.datatables.net/plug-ins/1.10.24/i18n/Chinese.json'
    },
    order: [[3, 'desc']], // 默认按销售额降序排序
    columns: [
      {
        data: 'image',
        orderable: false,
        render: function(data) {
          return `<img src="${data}" class="product-image" alt="Product Image">`;
        }
      },
      {
        data: 'title',
        className: 'title-cell',
        render: function(data, type, row) {
          let tags = '';
          if (row.isHot) {
            tags += '<span class="badge bg-danger me-1">爆款</span>';
          }
          if (row.isPotential) {
            tags += '<span class="badge bg-primary me-1">潜力</span>';
          }
          return `${tags} ${data}`;
        }
      },
      {
        data: 'price',
        render: function(data) {
          return `¥${data.toFixed(2)}`;
        }
      },
      {
        data: 'salesAmount',
        render: function(data) {
          return `¥${formatNumber(data)}`;
        }
      },
      {
        data: 'salesCount',
        render: function(data) {
          return formatNumber(data);
        }
      },
      {
        data: 'conversion',
        render: function(data) {
          return `${data}%`;
        }
      },
      {
        data: 'gpm',
        render: function(data) {
          return `¥${data.toFixed(2)}`;
        }
      },
      {
        data: 'trend',
        orderable: false,
        render: function(data) {
          if (data === 'up') {
            return '<span class="text-success">↑</span>';
          } else {
            return '<span class="text-danger">↓</span>';
          }
        }
      }
    ]
  });
  
  // 添加图片点击预览功能
  $('#productReviewTable').on('click', '.product-image', function() {
    const src = $(this).attr('src');
    $('.image-preview').attr('src', src);
    $('.image-preview-overlay').fadeIn();
  });
  
  // 点击预览图片外部关闭预览
  $('.image-preview-overlay').on('click', function() {
    $(this).fadeOut();
  });
}
