// 订单数据管理类
class OrderManager {
  constructor() {
    this.excelParser = new OrderExcelParser();
    this.orderTable = null;
    this.shopTable = null;
    this.productSummaryTable = null;
    this.orders = [];
    this.productDb = new ProductDatabase(); // 使用现有的商品数据库
    this.statusChart = null;
  }

  // 初始化
  async init() {
    try {
      await this.productDb.init();
      this.setupEventListeners();
      this.initOrderTable();
      this.initShopTable();
      this.applyStatusCardStyles();
    } catch (error) {
      console.error('订单管理器初始化失败:', error);
      alert('初始化失败: ' + error.message);
    }
  }

  // 设置事件监听器
  setupEventListeners() {
    // 文件上传相关
    const uploadArea = document.getElementById('orderUploadArea');
    const fileInput = document.getElementById('orderExcelFileInput');
    const selectFileBtn = document.getElementById('orderSelectFileBtn');
    
    // 点击选择文件按钮
    selectFileBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    // 文件拖拽区域事件
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('border-primary');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('border-primary');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('border-primary');
      
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.xlsx')) {
          fileInput.files = e.dataTransfer.files;
          this.handleFileUpload(file);
        } else {
          alert('请上传.xlsx格式的Excel文件');
        }
      }
    });
    
    // 文件选择事件
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.name.endsWith('.xlsx')) {
          this.handleFileUpload(file);
        } else {
          alert('请上传.xlsx格式的Excel文件');
          fileInput.value = '';
        }
      }
    });
  }

  // 处理文件上传
  async handleFileUpload(file) {
    try {
      // 显示进度条
      const progressBar = document.querySelector('#orderUploadProgress .progress-bar');
      document.getElementById('orderUploadProgress').style.display = 'block';
      progressBar.style.width = '30%';
      
      // 解析Excel文件
      this.excelParser.setFile(file);
      const result = await this.excelParser.parseExcel();
      
      progressBar.style.width = '60%';
      
      // 处理订单数据
      const { orders, skippedCount } = result;
      this.orders = orders;
      
      progressBar.style.width = '90%';
      
      // 计算汇总数据
      this.calculateSummary();
      
      progressBar.style.width = '100%';
      
      // 显示导入结果
      document.getElementById('orderImportSummary').textContent = 
        `成功导入 ${orders.length} 条订单数据。跳过 ${skippedCount} 条无效数据。`;
      document.getElementById('orderUploadResult').style.display = 'block';
      
      // 显示订单数据表格和汇总信息
      document.getElementById('orderTableCard').style.display = 'block';
      document.getElementById('orderSummaryCard').style.display = 'block';
      document.getElementById('shopTableCard').style.display = 'block';
      
      // 显示订单表格
      this.displayOrderTable(this.orders);
      
      // 显示店铺数据表格
      this.displayShopTable(this.summary.shopSummary);
      
    } catch (error) {
      console.error('订单文件上传处理失败:', error);
      alert('文件处理失败: ' + error.message);
      document.getElementById('orderUploadProgress').style.display = 'none';
    }
  }

  // 计算汇总数据
  calculateSummary() {
    // 初始化汇总数据
    const summary = {
      totalDealAmount: 0,
      commissionByStatus: {
        settled: 0,     // 已结算佣金
        unsettled: 0,   // 未结算佣金
        refunded: 0     // 已退款佣金
      },
      statusCounts: {
        '订单付款': 0,
        '订单收货': 0,
        '订单退货退款': 0,
        '订单结算': 0
      },
      statusCommission: {
        '订单付款': 0,
        '订单收货': 0,
        '订单退货退款': 0,
        '订单结算': 0
      },
      shopSummary: {}
    };
    
    // 遍历订单数据计算汇总
    this.orders.forEach(order => {
      // 累加金额
      summary.totalDealAmount += order.dealAmount;
      
      // 按订单状态累加佣金
      if (order.orderStatus === '订单结算') {
        summary.commissionByStatus.settled += order.commissionTotal;
      } else if (order.orderStatus === '订单退货退款') {
        summary.commissionByStatus.refunded += order.commissionTotal;
      } else if (order.orderStatus === '订单付款' || order.orderStatus === '订单收货') {
        summary.commissionByStatus.unsettled += order.commissionTotal;
      }
      
      // 统计订单状态
      summary.statusCounts[order.orderStatus] = (summary.statusCounts[order.orderStatus] || 0) + 1;
      summary.statusCommission[order.orderStatus] = (summary.statusCommission[order.orderStatus] || 0) + order.commissionTotal;
      
      // 按店铺汇总
      if (!summary.shopSummary[order.shopName]) {
        summary.shopSummary[order.shopName] = {
          shopName: order.shopName,
          totalDealAmount: 0,
          estimatedTotalCommission: 0,
          orderCount: 0,
          commissionRateSum: 0, // 用于计算平均佣金率
          statusCounts: {
            '订单付款': 0,
            '订单收货': 0,
            '订单退货退款': 0,
            '订单结算': 0
          }
        };
      }
      
      const shopData = summary.shopSummary[order.shopName];
      shopData.totalDealAmount += order.dealAmount;
      shopData.estimatedTotalCommission += order.commissionTotal;
      shopData.orderCount++;
      shopData.commissionRateSum += order.commissionRate;
      shopData.statusCounts[order.orderStatus]++;
    });
    
    // 计算退货率
    const completedOrders = summary.statusCounts['订单结算'] + summary.statusCounts['订单退货退款'];
    const completedRefundRate = completedOrders > 0 ? 
      (summary.statusCounts['订单退货退款'] / completedOrders) * 100 : 0;
    
    const totalOrders = this.orders.length;
    const totalRefundRate = totalOrders > 0 ? 
      (summary.statusCounts['订单退货退款'] / totalOrders) * 100 : 0;
    
    // 计算平均佣金率
    const estimatedTotalCommission = summary.commissionByStatus.settled + 
                                  summary.commissionByStatus.unsettled + 
                                  summary.commissionByStatus.refunded;
    
    const averageCommissionRate = summary.totalDealAmount > 0 ? 
      (estimatedTotalCommission / summary.totalDealAmount) * 100 : 0;
    
    // 计算店铺退货率
    Object.values(summary.shopSummary).forEach(shop => {
      const shopCompletedOrders = shop.statusCounts['订单结算'] + shop.statusCounts['订单退货退款'];
      shop.completedRefundRate = shopCompletedOrders > 0 ? 
        (shop.statusCounts['订单退货退款'] / shopCompletedOrders) * 100 : 0;
      
      shop.totalRefundRate = shop.orderCount > 0 ? 
        (shop.statusCounts['订单退货退款'] / shop.orderCount) * 100 : 0;
      
      shop.averageCommissionRate = shop.orderCount > 0 ? 
        (shop.commissionRateSum / shop.orderCount) : 0;
    });
    
    // 计算订单状态百分比
    const statusPercentages = {
      '订单付款': totalOrders > 0 ? (summary.statusCounts['订单付款'] / totalOrders) * 100 : 0,
      '订单收货': totalOrders > 0 ? (summary.statusCounts['订单收货'] / totalOrders) * 100 : 0,
      '订单退货退款': totalOrders > 0 ? (summary.statusCounts['订单退货退款'] / totalOrders) * 100 : 0,
      '订单结算': totalOrders > 0 ? (summary.statusCounts['订单结算'] / totalOrders) * 100 : 0
    };
    
    // 更新UI显示
    document.getElementById('totalDealAmount').textContent = `¥${summary.totalDealAmount.toFixed(2)}`;
    document.getElementById('settledCommission').textContent = `¥${summary.commissionByStatus.settled.toFixed(2)}`;
    document.getElementById('unsettledCommission').textContent = `¥${summary.commissionByStatus.unsettled.toFixed(2)}`;
    document.getElementById('refundedCommission').textContent = `¥${summary.commissionByStatus.refunded.toFixed(2)}`;
    document.getElementById('averageCommissionRate').textContent = `${averageCommissionRate.toFixed(2)}%`;
    
    document.getElementById('statusPaid').textContent = summary.statusCounts['订单付款'] || 0;
    document.getElementById('statusReceived').textContent = summary.statusCounts['订单收货'] || 0;
    document.getElementById('statusRefunded').textContent = summary.statusCounts['订单退货退款'] || 0;
    document.getElementById('statusSettled').textContent = summary.statusCounts['订单结算'] || 0;
    
    document.getElementById('statusPaidPercent').textContent = `${statusPercentages['订单付款'].toFixed(1)}%`;
    document.getElementById('statusReceivedPercent').textContent = `${statusPercentages['订单收货'].toFixed(1)}%`;
    document.getElementById('statusRefundedPercent').textContent = `${statusPercentages['订单退货退款'].toFixed(1)}%`;
    document.getElementById('statusSettledPercent').textContent = `${statusPercentages['订单结算'].toFixed(1)}%`;
    
    document.getElementById('statusPaidCommission').textContent = `¥${summary.statusCommission['订单付款'].toFixed(2)}`;
    document.getElementById('statusReceivedCommission').textContent = `¥${summary.statusCommission['订单收货'].toFixed(2)}`;
    document.getElementById('statusRefundedCommission').textContent = `¥${summary.statusCommission['订单退货退款'].toFixed(2)}`;
    document.getElementById('statusSettledCommission').textContent = `¥${summary.statusCommission['订单结算'].toFixed(2)}`;
    
    document.getElementById('completedRefundRate').textContent = `${completedRefundRate.toFixed(2)}%`;
    document.getElementById('totalRefundRate').textContent = `${totalRefundRate.toFixed(2)}%`;
    
    // 更新订单状态图表
    this.updateStatusChart(summary.statusCounts);
    
    // 保存汇总数据供后续使用
    this.summary = summary;
  }

  // 应用订单状态卡片样式
  applyStatusCardStyles() {
    // 应用订单状态卡片样式
    const statusPaid = document.querySelector('.status-received');
    if (statusPaid) {
      statusPaid.style.backgroundColor = '#e3f2fd'; // 蓝色
      statusPaid.style.borderLeft = '4px solid #1976d2';
    }
    
    const statusReceived = document.querySelector('.status-settled');
    if (statusReceived) {
      statusReceived.style.backgroundColor = '#e8f5e9'; // 绿色
      statusReceived.style.borderLeft = '4px solid #388e3c';
    }
    
    const statusRefunded = document.querySelector('.status-refunded');
    if (statusRefunded) {
      statusRefunded.style.backgroundColor = '#ffebee'; // 红色
      statusRefunded.style.borderLeft = '4px solid #d32f2f';
    }
    
    const statusSettled = document.querySelector('.status-paid');
    if (statusSettled) {
      statusSettled.style.backgroundColor = '#fff8e1'; // 黄色
      statusSettled.style.borderLeft = '4px solid #ffa000';
    }
  }

  // 初始化订单表格
  initOrderTable() {
    this.orderTable = $('#orderTable').DataTable({
      responsive: true,
      language: {
        search: "搜索:",
        lengthMenu: "显示 _MENU_ 条记录",
        info: "显示第 _START_ 至 _END_ 条记录，共 _TOTAL_ 条",
        infoEmpty: "没有记录",
        infoFiltered: "(从 _MAX_ 条记录过滤)",
        paginate: {
          first: "首页",
          last: "末页",
          next: "下一页",
          previous: "上一页"
        }
      },
      order: [[0, 'desc']], // 默认按订单ID降序排列
      dom: 'Blfrtip', // 添加按钮、长度控制、过滤、处理、表格、信息和分页
      buttons: [
        'copy', 'excel', 'csv', 'pdf', 'print'
      ],
      columnDefs: [
        {
          targets: '_all',
          defaultContent: '-'
        }
      ]
    });
  }

  // 初始化店铺表格
  initShopTable() {
    this.shopTable = $('#shopTable').DataTable({
      responsive: true,
      language: {
        search: "搜索:",
        lengthMenu: "显示 _MENU_ 条记录",
        info: "显示第 _START_ 至 _END_ 条记录，共 _TOTAL_ 条",
        infoEmpty: "没有记录",
        infoFiltered: "(从 _MAX_ 条记录过滤)",
        paginate: {
          first: "首页",
          last: "末页",
          next: "下一页",
          previous: "上一页"
        }
      },
      order: [[5, 'desc']], // 默认按店铺交易额降序排列
      dom: 'Blfrtip',
      buttons: [
        'copy', 'excel', 'csv', 'pdf', 'print'
      ],
      columnDefs: [
        {
          targets: '_all',
          defaultContent: '-'
        },
        {
          targets: [1, 2, 3, 4], // 订单状态列
          render: function(data, type, row) {
            // 当类型为'sort'时，返回订单数量
            if (type === 'sort' || type === 'type') {
              const match = data ? data.match(/<span class="order-count">(\d+)<\/span>/) : null;
              return match ? parseFloat(match[1]) : 0;
            }
            return data;
          }
        },
        {
          targets: [5], // 交易额列
          render: function(data, type) {
            if (type === 'sort' || type === 'type') {
              return parseFloat(data);
            }
            return `¥${parseFloat(data).toFixed(2)}`;
          }
        },
        {
          targets: [6, 7, 8], // 佣金率列
          render: function(data, type) {
            if (type === 'sort' || type === 'type') {
              return parseFloat(data);
            }
            return `${parseFloat(data).toFixed(2)}%`;
          }
        }
      ]
    });
  }

  // 显示订单表格
  displayOrderTable(orders) {
    // 清空现有表格数据
    this.orderTable.clear();
    
    // 添加新数据
    orders.forEach(order => {
      this.orderTable.row.add([
        order.orderId,
        order.productId,
        order.productName,
        order.shopName,
        order.orderStatus,
        `¥${order.dealAmount.toFixed(2)}`,
        `${order.commissionRate.toFixed(2)}%`,
        `¥${order.commissionTotal.toFixed(2)}`,
        `¥${order.estimatedCommission.toFixed(2)}`,
        order.orderPayTime,
        order.trafficSource
      ]);
    });
    
    // 重绘表格
    this.orderTable.draw();
    
    // 添加过滤功能
    this.addFilteringToTable(this.orderTable, '#orderTable');
  }

  // 显示店铺数据表格
  displayShopTable(shopSummary, trafficSourceFilter = 'all') {
    // 清空现有表格数据
    this.shopTable.clear();
    
    // 创建或更新流量来源切换按钮
    this.createTrafficSourceToggle();
    
    // 添加新数据
    Object.values(shopSummary).forEach(shop => {
      // 根据流量来源筛选订单
      const filteredOrders = this.orders.filter(order => {
        if (trafficSourceFilter === 'all') {
          return order.shopName === shop.shopName;
        } else if (trafficSourceFilter === 'live') {
          return order.shopName === shop.shopName && order.trafficSource === '直播';
        } else if (trafficSourceFilter === 'showcase') {
          return order.shopName === shop.shopName && order.trafficSource === '橱窗';
        }
        return false;
      });
      
      // 如果没有符合条件的订单，跳过这个店铺
      if (filteredOrders.length === 0) {
        return;
      }
      
      // 计算该店铺在当前筛选条件下的状态计数
      const statusCounts = {
        '订单付款': 0,
        '订单收货': 0,
        '订单退货退款': 0,
        '订单结算': 0
      };
      
      // 计算每个状态的佣金
      const statusCommission = {
        '订单付款': 0,
        '订单收货': 0,
        '订单退货退款': 0,
        '订单结算': 0
      };
      
      // 计算总交易额
      let totalDealAmount = 0;
      let commissionRateSum = 0;
      
      // 遍历筛选后的订单数据计算汇总
      filteredOrders.forEach(order => {
        statusCounts[order.orderStatus]++;
        statusCommission[order.orderStatus] += order.commissionTotal;
        totalDealAmount += order.dealAmount;
        commissionRateSum += order.commissionRate;
      });
      
      // 计算订单总数
      const totalOrders = statusCounts['订单付款'] + 
                         statusCounts['订单收货'] + 
                         statusCounts['订单退货退款'] + 
                         statusCounts['订单结算'];
      
      // 计算每个状态的百分比
      const paidPercent = totalOrders > 0 ? 
        (statusCounts['订单付款'] / totalOrders * 100).toFixed(1) : '0.0';
      const receivedPercent = totalOrders > 0 ? 
        (statusCounts['订单收货'] / totalOrders * 100).toFixed(1) : '0.0';
      const refundedPercent = totalOrders > 0 ? 
        (statusCounts['订单退货退款'] / totalOrders * 100).toFixed(1) : '0.0';
      const settledPercent = totalOrders > 0 ? 
        (statusCounts['订单结算'] / totalOrders * 100).toFixed(1) : '0.0';
      
      // 计算退款率
      const completedOrders = statusCounts['订单结算'] + statusCounts['订单退货退款'];
      const completedRefundRate = completedOrders > 0 ? 
        (statusCounts['订单退货退款'] / completedOrders) * 100 : 0;
      const totalRefundRate = totalOrders > 0 ? 
        (statusCounts['订单退货退款'] / totalOrders) * 100 : 0;
      
      // 计算平均佣金率
      const averageCommissionRate = filteredOrders.length > 0 ? 
        (commissionRateSum / filteredOrders.length) : 0;
      
      // 显示佣金数据
      const paidCommission = statusCommission['订单付款'] || 0;
      const receivedCommission = statusCommission['订单收货'] || 0;
      const refundedCommission = statusCommission['订单退货退款'] || 0;
      const settledCommission = statusCommission['订单结算'] || 0;
      
      this.shopTable.row.add([
        shop.shopName,
        `<div class="order-status-cell">
           <div class="order-status-main">
             <span class="order-count">${statusCounts['订单付款']}</span> 
             <span class="order-percent">(${paidPercent}%)</span>
           </div>
           <span class="order-commission">佣金: ¥${paidCommission.toFixed(2)}</span>
         </div>`,
        `<div class="order-status-cell">
           <div class="order-status-main">
             <span class="order-count">${statusCounts['订单收货']}</span> 
             <span class="order-percent">(${receivedPercent}%)</span>
           </div>
           <span class="order-commission">佣金: ¥${receivedCommission.toFixed(2)}</span>
         </div>`,
        `<div class="order-status-cell">
           <div class="order-status-main">
             <span class="order-count">${statusCounts['订单退货退款']}</span> 
             <span class="order-percent">(${refundedPercent}%)</span>
           </div>
           <span class="order-commission">佣金: ¥${refundedCommission.toFixed(2)}</span>
         </div>`,
        `<div class="order-status-cell">
           <div class="order-status-main">
             <span class="order-count">${statusCounts['订单结算']}</span> 
             <span class="order-percent">(${settledPercent}%)</span>
           </div>
           <span class="order-commission">佣金: ¥${settledCommission.toFixed(2)}</span>
         </div>`,
        totalDealAmount,
        averageCommissionRate,
        completedRefundRate,
        totalRefundRate,
        `<button class="btn btn-sm btn-primary shop-detail-btn" data-shop="${shop.shopName}">详情</button>`
      ]).draw(false);
    });
    
    // 显示店铺数据表格
    document.getElementById('shopTableCard').style.display = 'block';
    
    // 添加店铺详情按钮事件
    this.addShopDetailButtonEvents();
  }
  
  // 创建流量来源切换按钮
  createTrafficSourceToggle() {
    // 检查是否已经创建了切换按钮
    let toggleContainer = document.getElementById('trafficSourceToggle');
    
    if (!toggleContainer) {
      // 获取店铺表格卡片和切换按钮容器
      const toggleContainerParent = document.getElementById('trafficSourceToggleContainer');
      if (!toggleContainerParent) {
        console.error('找不到流量来源切换按钮容器');
        return;
      }
      
      // 创建切换按钮容器
      toggleContainer = document.createElement('div');
      toggleContainer.id = 'trafficSourceToggle';
      toggleContainer.className = 'btn-group';
      toggleContainer.setAttribute('role', 'group');
      toggleContainer.setAttribute('aria-label', '流量来源筛选');
      
      // 创建三个按钮
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'btn btn-primary active';
      allBtn.dataset.filter = 'all';
      allBtn.textContent = '全部';
      
      const liveBtn = document.createElement('button');
      liveBtn.type = 'button';
      liveBtn.className = 'btn btn-outline-primary';
      liveBtn.dataset.filter = 'live';
      liveBtn.textContent = '直播';
      
      const showcaseBtn = document.createElement('button');
      showcaseBtn.type = 'button';
      showcaseBtn.className = 'btn btn-outline-primary';
      showcaseBtn.dataset.filter = 'showcase';
      showcaseBtn.textContent = '橱窗';
      
      // 添加按钮到容器
      toggleContainer.appendChild(allBtn);
      toggleContainer.appendChild(liveBtn);
      toggleContainer.appendChild(showcaseBtn);
      
      // 将切换按钮容器添加到预定义的容器中
      toggleContainerParent.appendChild(toggleContainer);
      
      // 添加点击事件
      toggleContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
          // 更新按钮状态
          toggleContainer.querySelectorAll('button').forEach(btn => {
            btn.className = 'btn btn-outline-primary';
          });
          e.target.className = 'btn btn-primary active';
          
          // 根据选中的筛选条件重新显示数据
          this.displayShopTable(this.summary.shopSummary, e.target.dataset.filter);
        }
      });
    }
  }
  
  // 添加店铺详情按钮事件
  addShopDetailButtonEvents() {
    const buttons = document.querySelectorAll('.shop-detail-btn');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const shopName = e.target.getAttribute('data-shop');
        this.showShopDetail(shopName);
      });
    });
  }
  
  // 显示店铺详情
  showShopDetail(shopName) {
    // 设置店铺名称
    document.getElementById('modalShopName').textContent = shopName;
    
    // 获取店铺订单
    const shopOrders = this.orders.filter(order => order.shopName === shopName);
    
    // 计算商品汇总
    const productSummary = this.calculateProductSummary(shopOrders);
    
    // 显示商品汇总表格
    this.displayProductSummaryTable(productSummary);
    
    // 显示高退款率商品
    this.displayHighRefundProducts(productSummary);
    
    // 显示店铺详情模态框
    const modal = new bootstrap.Modal(document.getElementById('shopDetailModal'));
    modal.show();
  }
  
  // 计算商品汇总
  calculateProductSummary(orders) {
    const productSummary = {};
    
    orders.forEach(order => {
      if (!productSummary[order.productId]) {
        productSummary[order.productId] = {
          productId: order.productId,
          productName: order.productName,
          totalDealAmount: 0,
          orderCount: 0,
          commissionRateSum: 0,
          statusCounts: {
            '订单付款': 0,
            '订单收货': 0,
            '订单退货退款': 0,
            '订单结算': 0
          },
          statusCommission: {
            '订单付款': 0,
            '订单收货': 0,
            '订单退货退款': 0,
            '订单结算': 0
          }
        };
      }
      
      const product = productSummary[order.productId];
      product.totalDealAmount += order.dealAmount;
      product.orderCount++;
      product.commissionRateSum += order.commissionRate;
      product.statusCounts[order.orderStatus]++;
      product.statusCommission[order.orderStatus] += order.commissionTotal;
    });
    
    // 计算商品退款率和平均佣金率
    Object.values(productSummary).forEach(product => {
      const completedOrders = product.statusCounts['订单结算'] + product.statusCounts['订单退货退款'];
      
      product.completedRefundRate = completedOrders > 0 ? 
        (product.statusCounts['订单退货退款'] / completedOrders) * 100 : 0;
      
      product.totalRefundRate = product.orderCount > 0 ? 
        (product.statusCounts['订单退货退款'] / product.orderCount) * 100 : 0;
      
      product.averageCommissionRate = product.orderCount > 0 ? 
        (product.commissionRateSum / product.orderCount) : 0;
    });
    
    return productSummary;
  }
  
  // 显示商品汇总表格
  displayProductSummaryTable(productSummary) {
    // 初始化商品汇总表格
    if (!this.productSummaryTable) {
      this.productSummaryTable = $('#productSummaryTable').DataTable({
        responsive: true,
        language: {
          search: "搜索:",
          lengthMenu: "显示 _MENU_ 条记录",
          info: "显示第 _START_ 至 _END_ 条记录，共 _TOTAL_ 条",
          infoEmpty: "没有记录",
          infoFiltered: "(从 _MAX_ 条记录过滤)",
          paginate: {
            first: "首页",
            last: "末页",
            next: "下一页",
            previous: "上一页"
          }
        },
        order: [[6, 'desc']], // 默认按商品交易额降序排列
        dom: 'Blfrtip',
        buttons: [
          'copy', 'excel', 'csv', 'pdf', 'print'
        ],
        columnDefs: [
          {
            targets: '_all',
            defaultContent: '-'
          },
          {
            targets: [1], // 商品名称列
            render: function(data, type, row) {
              if (type === 'display') {
                const productId = row[0]; // 获取第一列的商品ID
                const productUrl = `https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=${productId}&origin_type=604`;
                return `<a href="${productUrl}" target="_blank">${data}</a>`;
              }
              return data;
            }
          },
          {
            targets: [2, 3, 4, 5], // 订单状态列
            render: function(data, type, row) {
              // 当类型为'sort'时，返回订单数量
              if (type === 'sort' || type === 'type') {
                const match = data ? data.match(/<span class="order-count">(\d+)<\/span>/) : null;
                return match ? parseFloat(match[1]) : 0;
              }
              return data;
            }
          },
          {
            targets: [6], // 交易额列
            render: function(data, type) {
              if (type === 'sort' || type === 'type') {
                return parseFloat(data);
              }
              return `¥${parseFloat(data).toFixed(2)}`;
            }
          },
          {
            targets: [7, 8, 9], // 佣金率列
            render: function(data, type) {
              if (type === 'sort' || type === 'type') {
                return parseFloat(data);
              }
              return `${parseFloat(data).toFixed(2)}%`;
            }
          }
        ]
      });
    } else {
      this.productSummaryTable.clear();
    }
    
    // 添加商品汇总数据
    Object.values(productSummary).forEach(product => {
      // 计算订单状态百分比
      const totalOrders = product.orderCount;
      const paidPercent = totalOrders > 0 ? (product.statusCounts['订单付款'] / totalOrders * 100).toFixed(1) : '0.0';
      const receivedPercent = totalOrders > 0 ? (product.statusCounts['订单收货'] / totalOrders * 100).toFixed(1) : '0.0';
      const refundedPercent = totalOrders > 0 ? (product.statusCounts['订单退货退款'] / totalOrders * 100).toFixed(1) : '0.0';
      const settledPercent = totalOrders > 0 ? (product.statusCounts['订单结算'] / totalOrders * 100).toFixed(1) : '0.0';
      
      this.productSummaryTable.row.add([
        product.productId,
        product.productName,
        `<div class="order-status-cell">
           <div class="order-status-main">
             <span class="order-count">${product.statusCounts['订单付款']}</span> 
             <span class="order-percent">(${paidPercent}%)</span>
           </div>
           <span class="order-commission">佣金: ¥${product.statusCommission['订单付款'].toFixed(2)}</span>
         </div>`,
        `<div class="order-status-cell">
           <div class="order-status-main">
             <span class="order-count">${product.statusCounts['订单收货']}</span> 
             <span class="order-percent">(${receivedPercent}%)</span>
           </div>
           <span class="order-commission">佣金: ¥${product.statusCommission['订单收货'].toFixed(2)}</span>
         </div>`,
        `<div class="order-status-cell">
           <div class="order-status-main">
             <span class="order-count">${product.statusCounts['订单退货退款']}</span> 
             <span class="order-percent">(${refundedPercent}%)</span>
           </div>
           <span class="order-commission">佣金: ¥${product.statusCommission['订单退货退款'].toFixed(2)}</span>
         </div>`,
        `<div class="order-status-cell">
           <div class="order-status-main">
             <span class="order-count">${product.statusCounts['订单结算']}</span> 
             <span class="order-percent">(${settledPercent}%)</span>
           </div>
           <span class="order-commission">佣金: ¥${product.statusCommission['订单结算'].toFixed(2)}</span>
         </div>`,
        product.totalDealAmount,
        product.averageCommissionRate,
        product.completedRefundRate,
        product.totalRefundRate
      ]).draw(false);
    });
  }
  
  // 显示高退款率商品
  displayHighRefundProducts(productSummary) {
    // 选择退款率大于或等于75%且订单数大于或等于20的商品
    const highRefundProducts = Object.values(productSummary)
      .filter(product => product.totalRefundRate >= 75 && product.orderCount >= 20)
      .sort((a, b) => b.orderCount - a.orderCount); // 按订单数降序排列
    
    const highRefundContainer = document.getElementById('highRefundProducts');
    const highRefundList = document.getElementById('highRefundProductsList');
    
    // 清空高退款率商品列表
    highRefundList.innerHTML = '';
    
    if (highRefundProducts.length > 0) {
      // 添加高退款率商品
      highRefundProducts.forEach(product => {
        const li = document.createElement('li');
        const productUrl = `https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=${product.productId}&origin_type=604`;
        li.innerHTML = `<a href="${productUrl}" target="_blank"><strong>${product.productName}</strong></a> (ID: ${product.productId}) - 退款率: <span class="text-danger">${product.totalRefundRate.toFixed(2)}%</span>, 订单数: <strong>${product.orderCount}</strong>`;
        highRefundList.appendChild(li);
      });
      
      // 显示高退款率商品容器
      highRefundContainer.style.display = 'block';
    } else {
      // 隐藏高退款率商品容器
      highRefundContainer.style.display = 'none';
    }
  }
  
  // 为表格添加过滤功能
  addFilteringToTable(table, tableSelector) {
    // 如果已经添加了过滤行，则不再添加
    if (document.querySelector(`${tableSelector} thead tr.filters`)) {
      return;
    }
    
    // 创建过滤行
    const filterRow = document.createElement('tr');
    filterRow.className = 'filters';
    
    // 为每一列添加过滤输入框
    const columnCount = table.columns().count();
    for (let i = 0; i < columnCount; i++) {
      const th = document.createElement('th');
      const input = document.createElement('input');
      input.className = 'form-control form-control-sm';
      input.placeholder = '过滤...';
      input.setAttribute('data-column', i);
      th.appendChild(input);
      filterRow.appendChild(th);
    }
    
    // 添加过滤行到表头
    document.querySelector(`${tableSelector} thead`).appendChild(filterRow);
    
    // 添加过滤事件监听器
    $(`${tableSelector} thead tr.filters th input`).on('keyup change', function() {
      const column = table.column($(this).data('column'));
      if (column.search() !== this.value) {
        column.search(this.value).draw();
      }
    });
  }

  // u8ba1u7b5bu5e97u94fau7279u5b9au72b6u6001u7684u4f63u91d1
  calculateStatusCommissionForShop(shopName, status) {
    return this.orders
      .filter(order => order.shopName === shopName && order.orderStatus === status)
      .reduce((sum, order) => sum + order.commissionTotal, 0);
  }

  // HTML转义
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text ? String(text).replace(/[&<>"']/g, m => map[m]) : '';
  }

  // 更新订单状态图表
  updateStatusChart(statusCounts) {
    const ctx = document.getElementById('orderStatusChart');
    
    // 如果图表已经存在，则销毁
    if (this.statusChart) {
      this.statusChart.destroy();
    }
    
    // 数据处理
    const labels = [
      '订单付款',
      '订单收货',
      '订单退货退款',
      '订单结算'
    ];
    
    const data = [
      statusCounts['订单付款'] || 0,
      statusCounts['订单收货'] || 0,
      statusCounts['订单退货退款'] || 0,
      statusCounts['订单结算'] || 0
    ];
    
    // 颜色配置
    const backgroundColor = [
      '#ffa000', // 订单付款 - 蓝色
      '#1976d2', // 订单收货 - 绿色
      '#d32f2f', // 订单退货退款 - 红色
      '#388e3c'  // 订单结算 - 黄色
    ];
    
    // 创建图表
    this.statusChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColor,
          borderColor: backgroundColor,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: {
                size: 12
              },
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
}

// 订单Excel解析器类
class OrderExcelParser {
  constructor() {
    this.file = null;
  }

  setFile(file) {
    this.file = file;
  }

  // 解析Excel文件
  async parseExcel() {
    return new Promise((resolve, reject) => {
      if (!this.file) {
        reject(new Error('未选择文件'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // 获取第一个工作表
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // 转换为JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // 检查是否有数据
          if (jsonData.length < 2) {
            reject(new Error('Excel文件中没有足够的数据'));
            return;
          }
          
          // 处理数据
          const result = this.processExcelData(jsonData);
          resolve(result);
        } catch (error) {
          console.error('解析Excel文件失败:', error);
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('读取文件失败:', error);
        reject(error);
      };
      
      reader.readAsArrayBuffer(this.file);
    });
  }

  // 处理Excel数据
  processExcelData(jsonData) {
    // 设置列映射
    const columnMappings = {
      orderId: ["订单id", "订单ID", "订单编号"],
      productId: ["商品id", "商品ID", "商品编号"],
      productName: ["商品名称", "商品标题"],
      shopName: ["店铺名称"],
      orderStatus: ["订单状态"],
      dealAmount: ["成交金额"],
      commissionRate: ["佣金率"],
      commissionTotal: ["总佣金收入"],
      estimatedCommission: ["预估佣金收入-达人"],
      orderPayTime: ["订单支付时间"],
      trafficSource: ["流量来源"]
    };
    
    // 如果没有数据或者没有表头，返回空数组
    if (jsonData.length < 2 || !jsonData[0] || !jsonData[0].length) {
      return { orders: [], skippedCount: 0 };
    }
    
    // 获取表头行
    const headers = jsonData[0];
    
    // 创建列索引映射
    const columnIndices = {};
    
    // 遍历每个列标题，查找匹配的字段
    headers.forEach((header, index) => {
      if (!header) return;
      
      const headerText = String(header).trim();
      
      // 遍历所有字段映射
      Object.keys(columnMappings).forEach(field => {
        // 检查当前列标题是否严格匹配任何字段的可能名称
        if (columnMappings[field].some(possibleName => {
          return headerText === possibleName;
        })) {
          columnIndices[field] = index;
        }
      });
    });
    
    console.log('订单列映射结果:', columnIndices);
    
    // 处理数据行
    const orders = [];
    let skippedCount = 0;
    
    // 从第二行开始处理数据
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // 跳过空行
      if (!row || !row.length) {
        skippedCount++;
        continue;
      }
      
      // 初始化订单对象
      const order = {
        orderId: '',
        productId: '',
        productName: '',
        shopName: '', 
        orderStatus: '',
        dealAmount: 0,
        commissionRate: 0,
        commissionTotal: 0,
        estimatedCommission: 0,
        orderPayTime: '',
        trafficSource: ''
      };
      
      // 填充订单对象
      Object.keys(columnIndices).forEach(field => {
        const index = columnIndices[field];
        const value = row[index];
        
        if (value !== undefined && value !== null) {
          // 处理数值字段
          if (field === 'dealAmount' || field === 'commissionTotal' || field === 'estimatedCommission') {
            order[field] = parseFloat(value) || 0;
          } else if (field === 'commissionRate') {
            // 处理百分比
            const cleanValue = String(value).replace('%', '');
            order[field] = parseFloat(cleanValue) || 0;
          } else {
            // 其他字段直接赋值
            order[field] = String(value).trim();
          }
        }
      });
      
      // 如果缺少关键字段，跳过该记录
      if (!order.orderId || !order.productId) {
        skippedCount++;
        continue;
      }
      
      orders.push(order);
    }
    
    console.log(`订单导入完成: 成功 ${orders.length} 条, 跳过 ${skippedCount} 条`);
    return { orders, skippedCount };
  }
}

// 页面加载完成后初始化订单管理器
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否在订单标签页，如果是则初始化订单管理器
  const ordersTab = document.getElementById('orders-tab');
  if (ordersTab) {
    // 监听标签页切换事件
    ordersTab.addEventListener('shown.bs.tab', () => {
      if (!window.orderManager) {
        window.orderManager = new OrderManager();
        window.orderManager.init();
      }
    });
  }
});
