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

            // 分析数据
            const { hotProducts, potentialProducts } = analyzeProducts(jsonData.data.data_result);

            // 初始化表格
            window.productTable = initializeTable(jsonData.data.data_result, jsonData.data.data_head);

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
        for (const tagName in tagConfig.tags) {
          const config = tagConfig.tags[tagName];
          if (header.index_name === config.field && row.performanceTags?.includes(tagName)) {
            tag = tagConfig.generateTagHtml(tagName, row);
            break;
          }
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
      const tag = row.performanceTags?.includes('高成交额') ? tagConfig.generateTagHtml('高成交额', row) : '';
      
      return `
        <div class="metric-card">
          <span class="metric-value">¥${amount.toFixed(2)}</span>
          ${tag}
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
    }
  });

  window.productTable = table;
  return table;
}

// 分析商品分数
function analyzeProducts(products) {
  // 使用配置中的阈值
  const thresholds = tagConfig.thresholds;

  // 分析每个商品
  products.forEach(product => {
    // 计算成交额（因为某些标签需要用到这个值）
    const price = product.market_price?.value || 0;
    const count = product.pay_combo_cnt?.value || 0;
    product._transaction_amount = (price * count) / 100;

    // 使用 tag-config 中的 shouldBeConsidered 逻辑计算分数
    const scores = {
      exposure: tagConfig.tags['高曝光'].shouldBeConsidered(product, thresholds) ? 1 : 0,
      click: tagConfig.tags['高点击'].shouldBeConsidered(product, thresholds) ? 1 : 0,
      clickRate: tagConfig.tags['点击率优'].shouldBeConsidered(product, thresholds) ? 1 : 0,
      convRate: tagConfig.tags['转化率优'].shouldBeConsidered(product, thresholds) ? 1 : 0,
      gpm: tagConfig.tags['高GPM'].shouldBeConsidered(product, thresholds) ? 1 : 0,
      sales: tagConfig.tags['高销量'].shouldBeConsidered(product, thresholds) ? 1 : 0
    };

    // 计算总分
    product.analysisScore = {
      ...scores,
      total: Object.values(scores).reduce((a, b) => a + b, 0)
    };

    // 生成性能标签
    product.performanceTags = Object.keys(tagConfig.tags)
      .filter(tagName => tagConfig.tags[tagName].shouldBeConsidered(product, thresholds));
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

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = `product-card ${isHot ? 'hot' : 'potential'}`;
    
    // 生成性能标签HTML
    const performanceTags = product.performanceTags
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

      // 先绑定事件监听器
      table.one('draw.dt', function() {
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

      // 然后再执行页面跳转
      table
        .page(targetPage)
        .draw('page');
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
