// 订单数据管理类
class OrderManager {
  constructor() {
    this.excelParser = new OrderExcelParser();
    this.orderTable = null;
    this.shopTable = null;
    this.orders = [];
    this.productDb = new ProductDatabase(); // 使用现有的商品数据库
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
      
      // 获取商品店铺名称并更新订单数据
      await this.enrichOrdersWithShopNames();
      
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

  // 根据商品ID获取店铺名称并丰富订单数据
  async enrichOrdersWithShopNames() {
    // 获取所有商品数据
    const products = await this.productDb.getAllProducts();
    
    // 创建商品ID到店铺名称的映射
    const productIdToShopMap = {};
    products.forEach(product => {
      productIdToShopMap[product.productId] = product.shopName;
    });
    
    // 更新订单数据中的店铺名称
    this.orders.forEach(order => {
      order.shopName = productIdToShopMap[order.productId] || '未知店铺';
    });
  }

  // 计算汇总数据
  calculateSummary() {
    // 初始化汇总数据
    const summary = {
      totalDealAmount: 0,
      totalCommission: 0,
      statusCounts: {
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
      summary.totalCommission += order.commissionTotal;
      
      // 统计订单状态
      summary.statusCounts[order.orderStatus] = (summary.statusCounts[order.orderStatus] || 0) + 1;
      
      // 按店铺汇总
      if (!summary.shopSummary[order.shopName]) {
        summary.shopSummary[order.shopName] = {
          shopName: order.shopName,
          totalDealAmount: 0,
          totalCommission: 0,
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
      shopData.totalCommission += order.commissionTotal;
      shopData.orderCount++;
      shopData.commissionRateSum += order.commissionRate;
      shopData.statusCounts[order.orderStatus]++;
    });
    
    // 计算平均佣金率
    const averageCommissionRate = this.orders.length > 0 ? 
      (summary.totalCommission / summary.totalDealAmount) * 100 : 0;
    
    // 计算退货率
    const completedOrders = summary.statusCounts['订单结算'] + summary.statusCounts['订单退货退款'];
    const completedRefundRate = completedOrders > 0 ? 
      (summary.statusCounts['订单退货退款'] / completedOrders) * 100 : 0;
    
    const totalOrders = this.orders.length;
    const totalRefundRate = totalOrders > 0 ? 
      (summary.statusCounts['订单退货退款'] / totalOrders) * 100 : 0;
    
    // 计算店铺退货率
    Object.values(summary.shopSummary).forEach(shop => {
      const shopCompletedOrders = shop.statusCounts['订单结算'] + shop.statusCounts['订单退货退款'];
      shop.completedRefundRate = shopCompletedOrders > 0 ? 
        (shop.statusCounts['订单退货退款'] / shopCompletedOrders) * 100 : 0;
      
      shop.totalRefundRate = shop.orderCount > 0 ? 
        (shop.statusCounts['订单退货退款'] / shop.orderCount) * 100 : 0;
      
      shop.averageCommissionRate = shop.orderCount > 0 ? 
        (shop.totalCommission / shop.totalDealAmount) * 100 : 0;
    });
    
    // 更新UI显示
    document.getElementById('totalDealAmount').textContent = `¥${summary.totalDealAmount.toFixed(2)}`;
    document.getElementById('totalCommission').textContent = `¥${summary.totalCommission.toFixed(2)}`;
    document.getElementById('averageCommissionRate').textContent = `${averageCommissionRate.toFixed(2)}%`;
    
    document.getElementById('statusPaid').textContent = summary.statusCounts['订单付款'] || 0;
    document.getElementById('statusReceived').textContent = summary.statusCounts['订单收货'] || 0;
    document.getElementById('statusRefunded').textContent = summary.statusCounts['订单退货退款'] || 0;
    document.getElementById('statusSettled').textContent = summary.statusCounts['订单结算'] || 0;
    
    document.getElementById('completedRefundRate').textContent = `${completedRefundRate.toFixed(2)}%`;
    document.getElementById('totalRefundRate').textContent = `${totalRefundRate.toFixed(2)}%`;
    
    // 保存汇总数据供后续使用
    this.summary = summary;
  }

  // 应用订单状态卡片样式
  applyStatusCardStyles() {
    // 应用订单状态卡片样式
    const statusPaid = document.querySelector('.status-paid');
    if (statusPaid) {
      statusPaid.style.backgroundColor = '#e3f2fd'; // 蓝色
      statusPaid.style.borderLeft = '4px solid #1976d2';
    }
    
    const statusReceived = document.querySelector('.status-received');
    if (statusReceived) {
      statusReceived.style.backgroundColor = '#e8f5e9'; // 绿色
      statusReceived.style.borderLeft = '4px solid #388e3c';
    }
    
    const statusRefunded = document.querySelector('.status-refunded');
    if (statusRefunded) {
      statusRefunded.style.backgroundColor = '#ffebee'; // 红色
      statusRefunded.style.borderLeft = '4px solid #d32f2f';
    }
    
    const statusSettled = document.querySelector('.status-settled');
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
          targets: [5, 6], // 交易额列
          render: function(data) {
            return `¥${parseFloat(data).toFixed(2)}`;
          }
        },
        {
          targets: [7, 8, 9], // 佣金率列
          render: function(data) {
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
  displayShopTable(shopSummary) {
    // 清空现有表格数据
    this.shopTable.clear();
    
    // 添加新数据
    Object.values(shopSummary).forEach(shop => {
      this.shopTable.row.add([
        shop.shopName,
        shop.statusCounts['订单付款'],
        shop.statusCounts['订单收货'],
        shop.statusCounts['订单退货退款'],
        shop.statusCounts['订单结算'],
        shop.totalDealAmount,
        shop.totalCommission,
        shop.averageCommissionRate,
        shop.completedRefundRate,
        shop.totalRefundRate
      ]);
    });
    
    // 重绘表格
    this.shopTable.draw();
    
    // 添加过滤功能
    this.addFilteringToTable(this.shopTable, '#shopTable');
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
        shopName: '', // 将在后续处理中填充
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
            const rate = parseFloat(value) || 0;
            // 如果值大于1，假设它已经是百分比形式（例如20而不是0.2）
            order[field] = rate > 1 ? rate : rate * 100;
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
