// 导入标签配置
import tagConfig from './tag-config.js';

document.addEventListener('DOMContentLoaded', function() {
  // 等待所有资源加载完成
  window.addEventListener('load', function() {
    // 检查是否有错误参数
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
      document.body.innerHTML = `<div class="alert alert-danger" style="margin: 20px;">${error}</div>`;
      return;
    }

    // 确保 jQuery 已加载
    if (typeof jQuery === 'undefined') {
      console.error('jQuery is not loaded');
      document.body.innerHTML = '<div class="alert alert-danger" style="margin: 20px;">Error: jQuery is not loaded</div>';
      return;
    }

    // 确保 DataTables 已加载
    if (!$.fn.DataTable) {
      console.error('DataTables is not loaded');
      document.body.innerHTML = '<div class="alert alert-danger" style="margin: 20px;">Error: DataTables is not loaded</div>';
      return;
    }

    // 确保表格元素存在
    const tableElement = document.getElementById('productTable');
    if (!tableElement) {
      console.error('Table element not found');
      document.body.innerHTML = '<div class="alert alert-danger" style="margin: 20px;">Error: Table element not found</div>';
      return;
    }

    // 保存产品位置信息的字典和当前高亮的行
    window.productLocations = {};
    window.currentHighlightedRow = null;

    // 从 storage 获取 live_room_id
    chrome.storage.local.get(['currentLiveRoomId'], function(result) {
      if (!result.currentLiveRoomId) {
        document.body.innerHTML = '<div class="alert alert-danger" style="margin: 20px;">Error: No live room ID found</div>';
        return;
      }

      const apiUrl = `https://compass.jinritemai.com/compass_api/content_live/author/live_screen/product_list_after_live?index_selected=product_click_ucnt%2Cproduct_click_pay_ucnt_ratio%2Cproduct_show_ucnt%2Cproduct_show_click_ucnt_ratio%2Cgpm%2Cpay_combo_cnt&data_range=0&room_id=${result.currentLiveRoomId}`;

      fetch(apiUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(jsonData => {
          if (!jsonData || !jsonData.data || !jsonData.data.data_result || !jsonData.data.data_head) {
            throw new Error('Invalid JSON data structure');
          }

          try {
            // 销毁现有的 DataTable 实例（如果存在）
            if ($.fn.DataTable.isDataTable('#productTable')) {
              $('#productTable').DataTable().destroy();
            }

            // 清空表格内容
            $('#productTable').empty();

            // 计算所有产品的成交金额
            jsonData.data.data_result.forEach(product => {
              const price = product.market_price?.value || 0;
              const count = product.pay_combo_cnt?.value || 0;
              product._transaction_amount = (price * count) / 100;
            });

            // 初始化表格
            window.productTable = initializeTable(jsonData.data.data_result, jsonData.data.data_head);

            // 分析数据
            const { hotProducts, potentialProducts } = analyzeProducts(jsonData.data.data_result);

            // 显示爆款商品
            displayProductCards(hotProducts, 'hotProducts', true);
            
            // 显示潜力商品
            displayProductCards(potentialProducts, 'potentialProducts', false);

            // 更新表格
            updateTableWithTags(window.productTable, jsonData.data.data_result);
          } catch (error) {
            console.error('Error initializing DataTable:', error);
            document.body.innerHTML = '<div class="alert alert-danger" style="margin: 20px;">Error initializing table. Please try again.</div>';
          }
        })
        .catch(error => {
          console.error('Error:', error);
          document.body.innerHTML = `<div class="alert alert-danger" style="margin: 20px;">Error: ${error.message}</div>`;
        });
    });
  });
});

// 初始化表格
function initializeTable(products, dataHead) {
  // 计算所有产品的成交金额
  products.forEach(product => {
    const price = product.market_price?.value || 0;
    const count = product.pay_combo_cnt?.value || 0;
    product._transaction_amount = (price * count) / 100;
  });

  // 构建列定义
  const columns = [
    {
      data: null,
      title: '商品',
      width: '300px',
      render: function(data, type, row) {
        if (type === 'sort') {
          return row.title || '';
        }
        return `
          <div class="product-cell">
            <img src="${row.image_uri}" alt="${row.title}" class="table-product-image">
            <div class="product-info">
              <span class="product-title" title="${row.title}">${row.title}</span>
            </div>
          </div>
        `;
      }
    },
    {
      data: null,
      title: '价格',
      width: '80px',
      render: function(data, type, row) {
        const price = row.market_price?.value || 0;
        if (type === 'sort') {
          return Number(price);
        }
        return `¥${(price / 100).toFixed(2)}`;
      }
    }
  ];

  // 添加指标列
  dataHead.forEach(header => {
    columns.push({
      data: null,
      title: header.index_display,
      width: '120px',
      render: function(data, type, row) {
        const value = row[header.index_name]?.value;
        if (value === undefined || value === null) {
          return type === 'sort' ? 0 : '-';
        }

        // 排序时返回原始数值
        if (type === 'sort') {
          return Number(value);
        }

        // 显示时进行格式化
        let displayValue;
        let tag = '';

        if (header.index_name.includes('ratio')) {
          displayValue = `${(value * 100).toFixed(2)}%`;
        } else if (header.index_name === 'gpm') {
          displayValue = `¥${(value / 100).toFixed(2)}`;
        } else {
          displayValue = value;
        }

        // 添加高性能标签
        if (header.index_name === 'product_show_ucnt' && row.performanceTags?.includes('高曝光')) {
          tag = `<span class="tag" data-performance="exposure" data-tooltip="曝光人数: ${value}">高曝光</span>`;
        } else if (header.index_name === 'product_show_click_ucnt_ratio' && row.performanceTags?.includes('点击率优')) {
          // 只有当曝光人数大于等于50时才显示点击率优标签
          const showCount = row.product_show_ucnt?.value || 0;
          if (showCount >= 50) {
            tag = `<span class="tag" data-performance="conversion" data-tooltip="点击率: ${displayValue} (曝光人数: ${showCount})">点击率优</span>`;
          }
        } else if (header.index_name === 'product_click_pay_ucnt_ratio' && row.performanceTags?.includes('转化率优')) {
          // 只有当点击人数大于等于20时才显示转化率优标签
          const clickCount = row.product_click_ucnt?.value || 0;
          if (clickCount >= 20) {
            tag = `<span class="tag" data-performance="conversion" data-tooltip="转化率: ${displayValue} (点击人数: ${clickCount})">转化率优</span>`;
          }
        } else if (header.index_name === 'gpm' && row.performanceTags?.includes('高GPM')) {
          tag = `<span class="tag" data-performance="gpm" data-tooltip="GPM: ¥${displayValue}">高GPM</span>`;
        } else if (header.index_name === 'pay_combo_cnt' && row.performanceTags?.includes('高销量')) {
          tag = `<span class="tag" data-performance="sales" data-tooltip="成交件数: ${value}">高销量</span>`;
        }

        return `
          <div class="metric-card">
            <span class="metric-value">${displayValue}</span>
            ${tag}
          </div>
        `;
      }
    });
  });

  // 添加成交额列
  columns.push({
    data: null,
    title: '成交额',
    width: '120px',
    render: function(data, type, row) {
      if (type === 'sort') {
        return Number(row._transaction_amount || 0);
      }

      const amount = row._transaction_amount || 0;
      const hasTag = row.performanceTags?.includes('高成交额');
      
      return `
        <div class="metric-card">
          <span class="metric-value">¥${amount.toFixed(2)}</span>
          ${hasTag ? `<span class="tag" data-performance="transaction" data-tooltip="成交额: ¥${amount.toFixed(2)}">高成交额</span>` : ''}
        </div>
      `;
    }
  });

  // 完全重新实现表格初始化
  let table;
  if ($.fn.DataTable.isDataTable('#productTable')) {
    // 如果表格已存在，先销毁它
    $('#productTable').DataTable().destroy();
    $('#productTable').empty();
  }
  
  // 创建新表格
  table = $('#productTable').DataTable({
    data: products,
    columns: columns,
    order: [[2, 'desc']], // 默认按曝光人数降序
    pageLength: 25,
    scrollX: true,
    lengthMenu: [[25, 50, 100, -1], [25, 50, 100, "全部"]],
    language: {
      url: '//cdn.datatables.net/plug-ins/1.10.24/i18n/Chinese.json'
    },
    columnDefs: [
      // 强制所有列使用数字排序 (除了第一列商品名)
      { targets: '_all', type: 'num' },
      { targets: 0, type: 'string' }
    ],
    createdRow: function(row, data) {
      row.id = `product-${data.product_id}`;
      if (window.currentHighlightedRow === data.product_id) {
        $(row).addClass('highlighted-row');
      }
    },
    drawCallback: function(settings) {
      console.log('表格重绘完成');
      
      // 更新产品位置信息
      const api = this.api();
      window.productLocations = {};
      const pageLen = api.page.len();
      
      // 重建位置索引
      api.rows({ order: 'current' }).every(function(rowIdx) {
        const data = this.data();
        window.productLocations[data.product_id] = {
          index: rowIdx,
          page: Math.floor(rowIdx / pageLen),
          row: rowIdx % pageLen
        };
      });
      
      console.log('更新了位置信息:', Object.keys(window.productLocations).length);
      
      // 高亮当前行
      if (window.currentHighlightedRow) {
        const row = document.getElementById(`product-${window.currentHighlightedRow}`);
        if (row) {
          row.classList.add('highlighted-row');
        }
      }
    }
  });

  window.productTable = table;
  return table;
}

// 分析商品性能
function analyzeProducts(products) {
  // 使用配置中的阈值
  const thresholds = tagConfig.thresholds;

  // 分析每个商品
  products.forEach(product => {
    // 计算分数
    const scores = {
      exposure: product.product_show_ucnt.value >= thresholds.exposure ? 1 : 0,
      clickRate: (product.product_show_ucnt.value >= thresholds.minExposure && 
                 product.product_show_click_ucnt_ratio.value >= thresholds.clickRate) ? 1 : 0,
      convRate: (product.product_click_ucnt.value >= thresholds.minClicks && 
                product.product_click_pay_ucnt_ratio.value >= thresholds.convRate) ? 1 : 0,
      gpm: (product.gpm?.value || 0) >= thresholds.gpm ? 1 : 0,
      sales: (product.pay_combo_cnt?.value || 0) >= thresholds.sales ? 1 : 0
    };

    // 计算总分
    product.analysisScore = {
      ...scores,
      total: Object.values(scores).reduce((a, b) => a + b, 0)
    };

    // 生成性能标签
    product.performanceTags = [];
    if (scores.exposure) product.performanceTags.push('高曝光');
    if (product.product_click_ucnt.value >= thresholds.clicks) product.performanceTags.push('高点击');
    if (scores.clickRate) product.performanceTags.push('点击率优');
    if (scores.convRate) product.performanceTags.push('转化率优');
    if (scores.gpm) product.performanceTags.push('高GPM');
    if (scores.sales) product.performanceTags.push('高销量');
    
    // 计算成交额
    const price = product.market_price?.value || 0;
    const count = product.pay_combo_cnt?.value || 0;
    const transactionAmount = (price * count) / 100;
    product.calculatedMetrics = {
      transactionAmount
    };
    
    if (transactionAmount >= thresholds.transactionAmount) {
      product.performanceTags.push('高成交额');
    }
  });

  // 按总分排序
  products.sort((a, b) => b.analysisScore.total - a.analysisScore.total);

  // 分离爆款和潜力商品
  const hotProducts = products.filter(product => product.analysisScore.total >= 3);
  const potentialProducts = products.filter(product => 
    product.analysisScore.total >= 1 && 
    product.analysisScore.total < 3 && 
    product.product_show_ucnt.value >= thresholds.minExposure
  );

  return { hotProducts, potentialProducts };
}

// 显示商品卡片
function displayProductCards(products, containerId, isHot) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (products.length === 0) {
    container.innerHTML = `<div class="no-products">暂无${isHot ? '爆款' : '潜力'}商品</div>`;
    return;
  }

  const tagConfig = {
    getTagConfig: function(tag) {
      switch (tag) {
        case '高曝光':
          return { enabled: true, tooltip: '曝光人数: ${value}' };
        case '高点击':
          return { enabled: true, tooltip: '点击人数: ${value}' };
        case '点击率优':
          return { enabled: true, tooltip: '点击率: ${displayValue} (曝光人数: ${showCount})' };
        case '转化率优':
          return { enabled: true, tooltip: '转化率: ${displayValue} (点击人数: ${clickCount})' };
        case '高GPM':
          return { enabled: true, tooltip: 'GPM: ¥${displayValue}' };
        case '高成交额':
          return { enabled: true, tooltip: '成交额: ¥${amount.toFixed(2)}' };
        case '高销量':
          return { enabled: true, tooltip: '成交件数: ${value}' };
        default:
          return { enabled: false };
      }
    },
    generateTagHtml: function(tag, product) {
      const config = this.getTagConfig(tag);
      if (!config.enabled) return '';

      let type = '';
      let tooltip = '';
      
      switch (tag) {
        case '高曝光':
          type = 'exposure';
          tooltip = `曝光人数: ${product.product_show_ucnt.value}`;
          break;
        case '高点击':
          type = 'click';
          tooltip = `点击人数: ${product.product_click_ucnt.value}`;
          break;
        case '点击率优':
          type = 'conversion';
          tooltip = `点击率: ${(product.product_show_click_ucnt_ratio.value * 100).toFixed(2)}%`;
          break;
        case '转化率优':
          type = 'conversion';
          tooltip = `转化率: ${(product.product_click_pay_ucnt_ratio.value * 100).toFixed(2)}%`;
          break;
        case '高GPM':
          type = 'gpm';
          tooltip = `GPM: ¥${(product.gpm?.value / 100 || 0).toFixed(2)}`;
          break;
        case '高成交额':
          type = 'transaction';
          tooltip = `成交额: ¥${product.calculatedMetrics.transactionAmount.toFixed(2)}`;
          break;
        case '高销量':
          type = 'sales';
          tooltip = `成交件数: ${product.pay_combo_cnt?.value || 0}`;
          break;
      }
      
      return `<span class="tag" data-performance="${type}" data-tooltip="${tooltip}">${tag}</span>`;
    }
  };

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = `product-card ${isHot ? 'hot' : 'potential'}`;
    
    // 生成性能标签HTML
    const performanceTags = product.performanceTags
      .filter(tag => tagConfig.getTagConfig(tag)?.enabled)
      .map(tag => tagConfig.generateTagHtml(tag, product))
      .join('');

    card.innerHTML = `
      <img src="${product.image_uri}" alt="${product.title}" class="product-image">
      <div class="product-info">
        <div class="product-title" title="${product.title}">${product.title}</div>
        <div class="tags" style="display: flex; flex-wrap: wrap; gap: 4px;">
          ${isHot ? `<span class="tag hot" data-tooltip="总分: ${product.analysisScore.total.toFixed(1)}">爆款</span>` : 
                  `<span class="tag potential" data-tooltip="总分: ${product.analysisScore.total.toFixed(1)}">潜力款</span>`}
          ${performanceTags}
        </div>
      </div>
    `;

    // 添加点击事件
    card.addEventListener('click', function() {
      const table = window.productTable;
      if (!table) {
        console.log('表格不存在');
        return;
      }

      const productId = product.product_id;
      
      // 移除之前的高亮
      $('.highlighted-row').removeClass('highlighted-row');

      // 更新当前高亮的行ID
      window.currentHighlightedRow = productId;

      // 查找产品在当前排序下的位置
      const targetIndex = table
        .rows()
        .indexes()
        .toArray()
        .findIndex(idx => table.row(idx).data().product_id === productId);

      if (targetIndex === -1) {
        console.log('找不到商品位置', productId);
        return;
      }

      // 计算目标页码
      const pageLength = table.page.len();
      const targetPage = Math.floor(targetIndex / pageLength);

      // 先清除所有高亮
      table.$('tr.highlighted-row').removeClass('highlighted-row');

      // 跳转到对应页面并等待完成
      table
        .page(targetPage)
        .draw('page')
        .one('draw.dt', function() {
          // 获取目标行的DOM元素
          const targetRow = table
            .rows()
            .nodes()
            .toArray()
            .find(row => row.id === `product-${productId}`);

          if (targetRow) {
            // 添加高亮
            $(targetRow).addClass('highlighted-row');
            
            // 使用 requestAnimationFrame 确保在下一帧渲染时滚动
            requestAnimationFrame(() => {
              targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
              console.log('已高亮并滚动到行', productId);
            });
          } else {
            console.log('找不到目标行', `product-${productId}`);
          }
        });
    });

    container.appendChild(card);
  });

  console.log(`已加载 ${isHot ? '爆款' : '潜力'} 商品 ${products.length} 个`);
}

// 更新表格显示标签
function updateTableWithTags(table, products) {
  if (!table) return;

  // 重新绘制表格
  table.clear().rows.add(products).draw();
}

// 计算平均值
function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 计算标准差
function standardDeviation(arr) {
  const avg = average(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(average(squareDiffs));
}
