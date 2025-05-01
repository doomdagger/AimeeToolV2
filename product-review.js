// 商品数据库管理类
class ProductDatabase {
  constructor() {
    this.DB_NAME = 'AimeeToolProductDB';
    this.STORE_NAME = 'products';
    this.db = null;
    this.dbVersion = 1;
  }

  // 初始化数据库
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.dbVersion);

      request.onerror = (event) => {
        console.error('数据库打开失败:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('数据库连接成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 如果商品表不存在，则创建
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'productId' });
          
          // 创建索引
          store.createIndex('productName', 'productName', { unique: false });
          store.createIndex('shopName', 'shopName', { unique: false });
          store.createIndex('category1', 'category1', { unique: false });
          store.createIndex('listTime', 'listTime', { unique: false });
          
          console.log('数据库表结构初始化完成');
        }
      };
    });
  }

  // 添加或更新商品
  async addOrUpdateProduct(product) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const request = store.put(product);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        console.error('添加/更新商品失败:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // 批量添加或更新商品
  async bulkAddOrUpdateProducts(products) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      let addedCount = 0;
      let updatedCount = 0;

      transaction.oncomplete = () => {
        resolve({ added: addedCount, updated: updatedCount });
      };

      transaction.onerror = (event) => {
        console.error('批量添加商品失败:', event.target.error);
        reject(event.target.error);
      };

      // 对每个商品先检查是否存在，然后添加或更新
      products.forEach(product => {
        const getRequest = store.get(product.productId);
        
        getRequest.onsuccess = (event) => {
          const existingProduct = event.target.result;
          
          if (existingProduct) {
            // 商品已存在，更新
            const presentFields = product._presentFields || [];
            const updatedProduct = { ...existingProduct };
            
            presentFields.forEach(field => {
              if (field !== '_presentFields') {
                updatedProduct[field] = product[field];
              }
            });
            
            delete updatedProduct._presentFields;
            
            store.put(updatedProduct);
            updatedCount++;
          } else {
            // 商品不存在，添加
            const newProduct = { ...product };
            delete newProduct._presentFields;
            
            store.add(newProduct);
            addedCount++;
          }
        };
      });
    });
  }

  // 获取所有商品
  async getAllProducts() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error('获取所有商品失败:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // 根据ID获取商品
  async getProductById(productId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(productId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error('获取商品失败:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // 删除商品
  async deleteProduct(productId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(productId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        console.error('删除商品失败:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // 批量删除商品
  async bulkDeleteProducts(productIds) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      let deletedCount = 0;

      transaction.oncomplete = () => {
        resolve(deletedCount);
      };

      transaction.onerror = (event) => {
        console.error('批量删除商品失败:', event.target.error);
        reject(event.target.error);
      };

      productIds.forEach(id => {
        const request = store.delete(id);
        request.onsuccess = () => {
          deletedCount++;
        };
      });
    });
  }
}

// Excel解析器类
class ExcelParser {
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
      productName: ["商品标题", "商品名称"],
      productId: ["商品编号", "商品id", "商品ID"],
      shopName: ["小店"],
      imageUrl: ["图片链接", "商品图片"],
      category1: ["一级类目", "一级分类"],
      category2: ["二级类目", "二级分类"],
      category3: ["三级类目", "三级分类"],
      category4: ["四级类目", "四级分类"],
      productUrl: ["商品链接"],
      price: [],
      listTime: ["上架时间", "上新时间"],
      commission: [],
      commissionRate: [],
      commissionTotal: ["预估佣金收入"],
      dealAmount: ["成交金额"],
      dealCount: ["成交件数"]
    };
    
    // 如果没有数据或者没有表头，返回空数组
    if (jsonData.length < 2 || !jsonData[0] || !jsonData[0].length) {
      return [];
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
    
    console.log('列映射结果:', columnIndices);
    
    // 处理数据行
    const products = [];
    let skippedCount = 0;
    
    // 从第二行开始处理数据
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // 跳过空行
      if (!row || !row.length) {
        skippedCount++;
        continue;
      }
      
      // 初始化商品对象 - 只包含本次导入的字段
      const product = {
        productId: '',
        productName: '',
        shopName: '',
        imageUrl: '',
        category1: '',
        category2: '',
        category3: '',
        category4: '',
        price: 0,
        listTime: '',
        commission: 0,
        commissionRate: 0,
        productUrl: ''
      };
      
      // 记录哪些字段在本次导入中存在
      const presentFields = new Set(['productId']);
      
      // 临时变量用于计算
      let dealAmount = 0;
      let dealCount = 0;
      let commissionTotal = 0;
      
      // 填充商品对象，只添加在本次导入中存在的字段
      Object.keys(columnIndices).forEach(field => {
        const index = columnIndices[field];
        const value = row[index];
        
        // 处理特殊字段
        if (field === 'dealAmount') {
          dealAmount = parseFloat(value) || 0;
        } else if (field === 'dealCount') {
          dealCount = parseInt(value) || 0;
        } else if (field === 'commissionTotal') {
          commissionTotal = parseFloat(value) || 0;
        } else if (field === 'price' || field === 'commission' || field === 'commissionRate') {
          // 数值字段转换
          if (value !== undefined && value !== null) {
            product[field] = parseFloat(value) || 0;
            presentFields.add(field);
          }
        } else if (value !== undefined && value !== null) {
          // 其他字段直接赋值
          product[field] = String(value).trim();
          presentFields.add(field);
        }
      });
      
      // 如果没有找到productId，尝试从productUrl提取
      if (!product.productId && product.productUrl) {
        const idMatch = product.productUrl.match(/id=([\d]+)/);
        if (idMatch && idMatch[1]) {
          product.productId = idMatch[1];
        }
      }
      
      // 如果仍然没有productId，跳过这条记录
      if (!product.productId) {
        skippedCount++;
        continue;
      }
      
      // 计算价格（如果没有直接提供）
      if (!presentFields.has('price') && dealCount > 0 && dealAmount > 0) {
        product.price = dealAmount / dealCount;
        presentFields.add('price');
      }
      
      // 计算佣金（如果没有直接提供）
      if (!presentFields.has('commission') && dealCount > 0 && commissionTotal > 0) {
        product.commission = commissionTotal / dealCount;
        presentFields.add('commission');
      }
      
      // 计算佣金率（如果没有直接提供）
      if (!presentFields.has('commissionRate') && presentFields.has('price') && presentFields.has('commission') && 
          product.price > 0 && product.commission > 0) {
        product.commissionRate = (product.commission / product.price) * 100; // 转换为百分比
        presentFields.add('commissionRate');
      }
      
      // 添加字段存在标记，用于数据库更新
      product._presentFields = Array.from(presentFields);
      products.push(product);
    }
    
    console.log(`导入完成: 成功 ${products.length} 条, 跳过 ${skippedCount} 条`);
    return { products, skippedCount };
  }
}

// 商品管理器类
class ProductManager {
  constructor() {
    this.db = new ProductDatabase();
    this.excelParser = new ExcelParser();
    this.productTable = null;
  }

  // 初始化
  async init() {
    try {
      await this.db.init();
      this.setupEventListeners();
      this.initProductTable();
      this.loadProducts();
    } catch (error) {
      console.error('初始化失败:', error);
      alert('初始化失败: ' + error.message);
    }
  }

  // 设置事件监听器
  setupEventListeners() {
    // 文件上传相关
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('excelFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    
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
    
    // 商品列表相关
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    
    // 全选/取消全选
    selectAllCheckbox.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('#productTableBody input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
      });
      
      this.updateDeleteButtonState();
    });
    
    // 删除选中商品
    deleteSelectedBtn.addEventListener('click', () => {
      this.deleteSelectedProducts();
    });
    
    // 保存编辑商品
    document.getElementById('saveProductBtn').addEventListener('click', () => {
      this.saveEditedProduct();
    });
  }

  // 处理文件上传
  async handleFileUpload(file) {
    try {
      // 显示进度条
      const progressBar = document.querySelector('#uploadProgress .progress-bar');
      document.getElementById('uploadProgress').style.display = 'block';
      progressBar.style.width = '30%';
      
      // 解析Excel文件
      this.excelParser.setFile(file);
      const result = await this.excelParser.parseExcel();
      
      progressBar.style.width = '60%';
      
      // 导入到数据库
      const { products, skippedCount } = result;
      const result2 = await this.db.bulkAddOrUpdateProducts(products);
      
      progressBar.style.width = '100%';
      
      // 显示导入结果
      document.getElementById('importSummary').textContent = 
        `成功导入 ${result2.added} 个新商品，更新 ${result2.updated} 个已有商品。跳过 ${skippedCount} 条无效数据。`;
      document.getElementById('uploadResult').style.display = 'block';
      
      // 显示预览表格
      this.displayPreviewTable(products);
      
      // 重新加载商品列表
      this.loadProducts();
      
    } catch (error) {
      console.error('文件上传处理失败:', error);
      alert('文件处理失败: ' + error.message);
      document.getElementById('uploadProgress').style.display = 'none';
    }
  }

  // 显示预览表格
  displayPreviewTable(products) {
    const tableBody = document.getElementById('previewTableBody');
    tableBody.innerHTML = '';
    
    // 最多显示10条记录
    const displayProducts = products.slice(0, 10);
    
    displayProducts.forEach(product => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${product.productId}</td>
        <td>${this.escapeHtml(product.productName)}</td>
        <td>${this.escapeHtml(product.shopName)}</td>
        <td><img src="${product.imageUrl || 'icon48.png'}" class="product-image" onerror="this.src='icon48.png'" /></td>
        <td>${this.escapeHtml(product.category1)}</td>
        <td>${this.escapeHtml(product.category2)}</td>
        <td>${this.escapeHtml(product.category3)}</td>
        <td>${this.escapeHtml(product.category4)}</td>
        <td>${product.price}</td>
        <td>${product.listTime}</td>
        <td>${product.commission}</td>
        <td>${product.commissionRate}</td>
        <td><a href="${product.productUrl}" target="_blank">查看</a></td>
      `;
      
      tableBody.appendChild(row);
    });
  }

  // 初始化商品表格
  initProductTable() {
    this.productTable = $('#productTable').DataTable({
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
      columnDefs: [
        { orderable: false, targets: [0, 1, 13] }
      ],
      order: [[2, 'desc']] // 默认按商品ID降序排列
    });
  }

  // 加载商品列表
  async loadProducts() {
    try {
      const products = await this.db.getAllProducts();
      this.displayProductTable(products);
    } catch (error) {
      console.error('加载商品失败:', error);
      alert('加载商品失败: ' + error.message);
    }
  }

  // 显示商品表格
  displayProductTable(products) {
    // 清空表格
    this.productTable.clear();
    
    // 添加数据
    products.forEach(product => {
      this.productTable.row.add([
        `<input type="checkbox" class="product-checkbox" data-id="${product.productId}">`,
        `<img src="${product.imageUrl || 'icon48.png'}" class="product-image" onerror="this.src='icon48.png'" />`,
        product.productId,
        this.escapeHtml(product.productName),
        this.escapeHtml(product.shopName),
        this.escapeHtml(product.category1),
        this.escapeHtml(product.category2),
        this.escapeHtml(product.category3),
        this.escapeHtml(product.category4),
        product.price,
        product.listTime,
        product.commission,
        product.commissionRate,
        `<button class="btn btn-sm btn-primary btn-action edit-product" data-id="${product.productId}">编辑</button>
         <button class="btn btn-sm btn-danger btn-action delete-product" data-id="${product.productId}">删除</button>`
      ]);
    });
    
    // 绘制表格
    this.productTable.draw();
    
    // 添加事件监听器
    this.addProductTableEventListeners();
  }

  // 添加商品表格事件监听器
  addProductTableEventListeners() {
    // 复选框变更事件
    document.querySelectorAll('#productTableBody .product-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updateDeleteButtonState();
      });
    });
    
    // 编辑按钮点击事件
    document.querySelectorAll('#productTableBody .edit-product').forEach(button => {
      button.addEventListener('click', (e) => {
        const productId = e.target.getAttribute('data-id');
        this.editProduct(productId);
      });
    });
    
    // 删除按钮点击事件
    document.querySelectorAll('#productTableBody .delete-product').forEach(button => {
      button.addEventListener('click', (e) => {
        const productId = e.target.getAttribute('data-id');
        this.deleteProduct(productId);
      });
    });
    
    // 图片加载失败事件
    document.querySelectorAll('#productTableBody .product-image').forEach(image => {
      image.addEventListener('error', () => {
        const fallbackSrc = image.getAttribute('data-fallback');
        image.src = fallbackSrc;
      });
    });
  }

  // 更新删除按钮状态
  updateDeleteButtonState() {
    const checkboxes = document.querySelectorAll('#productTableBody .product-checkbox:checked');
    const deleteButton = document.getElementById('deleteSelectedBtn');
    
    deleteButton.disabled = checkboxes.length === 0;
  }

  // 编辑商品
  async editProduct(productId) {
    try {
      const product = await this.db.getProductById(productId);
      
      if (product) {
        // 填充表单
        document.getElementById('editProductId').value = product.productId;
        document.getElementById('editProductName').value = product.productName;
        document.getElementById('editShopName').value = product.shopName;
        document.getElementById('editImageUrl').value = product.imageUrl;
        document.getElementById('editPrice').value = product.price;
        document.getElementById('editCategory1').value = product.category1;
        document.getElementById('editCategory2').value = product.category2;
        document.getElementById('editCategory3').value = product.category3;
        document.getElementById('editCategory4').value = product.category4;
        document.getElementById('editListTime').value = this.formatDateTimeForInput(product.listTime);
        document.getElementById('editCommission').value = product.commission;
        document.getElementById('editCommissionRate').value = product.commissionRate;
        document.getElementById('editProductUrl').value = product.productUrl;
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
        modal.show();
      } else {
        alert('找不到该商品');
      }
    } catch (error) {
      console.error('获取商品失败:', error);
      alert('获取商品失败: ' + error.message);
    }
  }

  // 保存编辑的商品
  async saveEditedProduct() {
    try {
      const productId = document.getElementById('editProductId').value;
      
      // 创建更新后的商品对象
      const updatedProduct = {
        productId: productId,
        productName: document.getElementById('editProductName').value,
        shopName: document.getElementById('editShopName').value,
        imageUrl: document.getElementById('editImageUrl').value,
        price: parseFloat(document.getElementById('editPrice').value) || 0,
        category1: document.getElementById('editCategory1').value,
        category2: document.getElementById('editCategory2').value,
        category3: document.getElementById('editCategory3').value,
        category4: document.getElementById('editCategory4').value,
        listTime: document.getElementById('editListTime').value,
        commission: parseFloat(document.getElementById('editCommission').value) || 0,
        commissionRate: parseFloat(document.getElementById('editCommissionRate').value) || 0,
        productUrl: document.getElementById('editProductUrl').value
      };
      
      // 更新数据库
      await this.db.addOrUpdateProduct(updatedProduct);
      
      // 关闭模态框
      const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
      modal.hide();
      
      // 重新加载商品列表
      this.loadProducts();
      
      alert('商品更新成功');
    } catch (error) {
      console.error('保存商品失败:', error);
      alert('保存商品失败: ' + error.message);
    }
  }

  // 删除商品
  async deleteProduct(productId) {
    // 显示确认模态框
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    document.getElementById('deleteConfirmMessage').textContent = `您确定要删除这个商品吗？`;
    
    // 设置确认按钮事件监听器
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const confirmHandler = async () => {
      try {
        // 关闭模态框
        modal.hide();
        
        // 删除商品
        await this.db.deleteProduct(productId);
        
        // 重新加载商品列表
        this.loadProducts();
        
        // 显示删除成功提示
        this.showToast('商品删除成功', 'success');
      } catch (error) {
        console.error('删除商品失败:', error);
        this.showToast(`删除商品失败: ${error.message}`, 'danger');
      }
      
      // 移除事件监听器
      confirmBtn.removeEventListener('click', confirmHandler);
    };
    
    // 添加事件监听器
    confirmBtn.addEventListener('click', confirmHandler);
    
    // 显示模态框
    modal.show();
  }

  // 删除选中的商品
  async deleteSelectedProducts() {
    const checkboxes = document.querySelectorAll('#productTableBody .product-checkbox:checked');
    
    if (checkboxes.length === 0) {
      this.showToast('请选择要删除的商品', 'warning');
      return;
    }
    
    // 显示确认模态框
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    document.getElementById('deleteConfirmMessage').textContent = `您确定要删除选中的 ${checkboxes.length} 个商品吗？`;
    
    // 设置确认按钮事件监听器
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const confirmHandler = async () => {
      try {
        // 关闭模态框
        modal.hide();
        
        // 获取选中的商品ID
        const productIds = Array.from(checkboxes).map(checkbox => checkbox.getAttribute('data-id'));
        
        // 批量删除商品
        const deletedCount = await this.db.bulkDeleteProducts(productIds);
        
        // 重新加载商品列表
        this.loadProducts();
        document.getElementById('selectAllCheckbox').checked = false;
        this.updateDeleteButtonState();
        
        // 显示删除成功提示
        this.showToast(`成功删除 ${deletedCount} 个商品`, 'success');
      } catch (error) {
        console.error('批量删除商品失败:', error);
        this.showToast(`批量删除商品失败: ${error.message}`, 'danger');
      }
      
      // 移除事件监听器
      confirmBtn.removeEventListener('click', confirmHandler);
    };
    
    // 添加事件监听器
    confirmBtn.addEventListener('click', confirmHandler);
    
    // 显示模态框
    modal.show();
  }

  // 格式化日期时间为input元素可用的格式
  formatDateTimeForInput(dateTimeStr) {
    if (!dateTimeStr) return '';
    
    // 尝试解析日期
    const date = new Date(dateTimeStr);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) return '';
    
    // 格式化为YYYY-MM-DDThh:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // HTML转义
  escapeHtml(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 显示提示消息
  showToast(message, type = 'success') {
    const toast = document.getElementById('messageToast');
    const toastMessage = document.getElementById('toastMessage');
    
    // 设置提示消息内容
    toastMessage.textContent = message;
    
    // 设置提示消息类型
    toast.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-info');
    toast.classList.add(`bg-${type}`);
    
    // 显示提示消息
    const bsToast = new bootstrap.Toast(toast, {
      autohide: true,
      delay: 3000
    });
    bsToast.show();
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  const productManager = new ProductManager();
  productManager.init();
});
